-- NOXIA Core: explicit Earth vehicle staging to an owned spatial logistics node
-- 2026-09-15
--
-- Staging is deliberately narrow. It is not free travel and it never infers an
-- exact node from the broad Earth location. Only a ready player-owned vehicle
-- with no active transport job may be assigned to an active player-owned
-- tile-entity inventory at the same canonical Earth location.

set search_path to public;

create table if not exists public.vehicle_staging_commands (
  command_id uuid primary key,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_instance_id uuid not null references public.vehicle_instances(id) on delete cascade,
  target_inventory_id uuid not null references public.logistics_inventories(id),
  result jsonb not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  constraint vehicle_staging_commands_result_object_check
    check (jsonb_typeof(result) = 'object')
);

create index if not exists vehicle_staging_commands_actor_idx
  on public.vehicle_staging_commands(actor_profile_id, created_at desc);

alter table public.vehicle_staging_commands enable row level security;
revoke all on table public.vehicle_staging_commands from public, anon, authenticated;
grant select, insert, update, delete on table public.vehicle_staging_commands to service_role;

create or replace function public.noxia_stage_earth_vehicle(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_vehicle_instance_id uuid,
  p_target_inventory_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing_command public.vehicle_staging_commands%rowtype;
  v_vehicle public.vehicle_instances%rowtype;
  v_target public.logistics_inventories%rowtype;
  v_vehicle_inventory public.logistics_inventories%rowtype;
  v_event_id uuid;
  v_snapshot jsonb;
  v_result jsonb;
begin
  if p_command_id is null
    or p_actor_profile_id is null
    or p_vehicle_instance_id is null
    or p_target_inventory_id is null then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_ARGUMENT_REQUIRED' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('noxia_stage_earth_vehicle:' || p_command_id::text, 0)
  );

  select * into v_existing_command
  from public.vehicle_staging_commands
  where command_id = p_command_id;

  if found then
    if v_existing_command.actor_profile_id is distinct from p_actor_profile_id
      or v_existing_command.vehicle_instance_id is distinct from p_vehicle_instance_id
      or v_existing_command.target_inventory_id is distinct from p_target_inventory_id then
      raise exception 'NOXIA_EARTH_VEHICLE_STAGING_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing_command.result || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('noxia_vehicle_instance:' || p_vehicle_instance_id::text, 0)
  );

  select * into v_vehicle
  from public.vehicle_instances
  where id = p_vehicle_instance_id
  for update;

  if not found then
    raise exception 'NOXIA_VEHICLE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_vehicle.owner_profile_id is distinct from p_actor_profile_id then
    raise exception 'NOXIA_VEHICLE_FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_vehicle.status <> 'ready' then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_NOT_READY:%', v_vehicle.status using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.locations l
    where l.id = v_vehicle.location_id and l.slug = 'earth'
  ) then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_LOCATION_UNSUPPORTED' using errcode = 'P0001';
  end if;

  select * into v_target
  from public.logistics_inventories
  where id = p_target_inventory_id
    and active
  for share;

  if not found then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_target.location_id is distinct from v_vehicle.location_id then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_TARGET_WRONG_LOCATION' using errcode = 'P0001';
  end if;
  if v_target.owner_profile_id is distinct from p_actor_profile_id then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_TARGET_FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_target.subject_type <> 'tile_entity' or v_target.subject_id is null then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_TARGET_NOT_SPATIAL' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.tile_entities te
    where te.id = v_target.subject_id
      and te.location_id = v_vehicle.location_id
      and (
        (te.latitude_deg is not null and te.longitude_deg is not null)
        or (te.x_m is not null and te.y_m is not null)
      )
  ) then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_TARGET_POSITION_UNRESOLVED' using errcode = 'P0001';
  end if;

  select * into v_vehicle_inventory
  from public.logistics_inventories
  where active
    and storage_kind = 'native'
    and subject_type = 'vehicle_instance'
    and subject_id = v_vehicle.id
  limit 1;

  if v_vehicle_inventory.id is null then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_VEHICLE_INVENTORY_MISSING' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.transport_jobs tj
    where tj.vehicle_inventory_id = v_vehicle_inventory.id
      and tj.status = any(array['reserved','loading','in_transit','arrived','unloading']::text[])
  ) then
    raise exception 'NOXIA_EARTH_VEHICLE_STAGING_ACTIVE_TRANSPORT' using errcode = 'P0001';
  end if;

  -- Repeating the same semantic placement with a new command id is harmless and
  -- still recorded as an explicit command; no additional movement is invented.
  update public.vehicle_instances
  set current_node_inventory_id = p_target_inventory_id,
      updated_at = now()
  where id = v_vehicle.id;

  update public.logistics_inventories
  set location_id = v_vehicle.location_id,
      updated_at = now()
  where id = v_vehicle_inventory.id;

  insert into public.simulation_events(
    event_type,
    subject_type,
    subject_id,
    actor_id,
    location_id,
    effects,
    metadata,
    occurred_at,
    canonical_event_id
  ) values (
    'vehicle.staged',
    'vehicle_instance',
    v_vehicle.id,
    p_actor_profile_id,
    v_vehicle.location_id,
    jsonb_build_array(jsonb_build_object(
      'type', 'vehicle_staged',
      'target_inventory_id', p_target_inventory_id
    )),
    jsonb_build_object(
      'source', 'earth_vehicle_staging',
      'commandId', p_command_id
    ),
    now(),
    'vehicle.staged:' || p_command_id::text
  ) returning id into v_event_id;

  v_snapshot := public.noxia_vehicle_snapshot(v_vehicle.id);
  v_result := jsonb_build_object(
    'vehicleId', v_vehicle.id,
    'targetInventoryId', p_target_inventory_id,
    'eventId', v_event_id,
    'vehicle', v_snapshot -> 'vehicle',
    'inventory', v_snapshot -> 'inventory'
  );

  insert into public.vehicle_staging_commands(
    command_id,
    actor_profile_id,
    vehicle_instance_id,
    target_inventory_id,
    result
  ) values (
    p_command_id,
    p_actor_profile_id,
    v_vehicle.id,
    p_target_inventory_id,
    v_result
  );

  return v_result || jsonb_build_object('idempotent', false);
end;
$function$;

revoke all on function public.noxia_stage_earth_vehicle(uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.noxia_stage_earth_vehicle(uuid,uuid,uuid,uuid)
  to service_role;

comment on table public.vehicle_staging_commands is
  'Durable idempotency ledger for explicit vehicle-to-node staging commands.';
comment on function public.noxia_stage_earth_vehicle(uuid,uuid,uuid,uuid) is
  'Explicitly stages a ready player-owned Earth vehicle at a player-owned spatial logistics node; never infers or teleports between broad locations.';
