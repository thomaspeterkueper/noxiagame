-- NOXIA Core: idempotent starter Cargo Rover bootstrap provisioning
-- 2026-09-11
--
-- This is deliberately provisioning, not a vehicle purchase flow. It does not
-- debit credits, inspect research/unlocks, or establish later vehicle-economy
-- rules. The starter slot is unique per player while the Cargo Rover frame itself
-- remains unrestricted, so later gameplay may own multiple Cargo Rovers.

set search_path to public;

create table if not exists public.vehicle_provisioning_slots (
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  slot_key text not null,
  vehicle_instance_id uuid not null unique references public.vehicle_instances(id),
  provisioned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (owner_profile_id, slot_key),
  constraint vehicle_provisioning_slots_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.vehicle_provisioning_commands (
  command_id uuid primary key,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  slot_key text not null,
  location_id uuid not null references public.locations(id),
  result jsonb not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  constraint vehicle_provisioning_commands_result_object_check
    check (jsonb_typeof(result) = 'object')
);

create index if not exists vehicle_provisioning_commands_actor_idx
  on public.vehicle_provisioning_commands(actor_profile_id, created_at desc);

alter table public.vehicle_provisioning_slots enable row level security;
alter table public.vehicle_provisioning_commands enable row level security;
revoke all on table public.vehicle_provisioning_slots from public, anon, authenticated;
revoke all on table public.vehicle_provisioning_commands from public, anon, authenticated;
grant select, insert, update, delete on table public.vehicle_provisioning_slots to service_role;
grant select, insert, update, delete on table public.vehicle_provisioning_commands to service_role;

create or replace function public.noxia_provision_starter_cargo_rover(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_location_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  c_slot_key constant text := 'starter_cargo_rover';
  c_frame_id constant text := 'cargo-rover-reference';
  c_label constant text := 'Cargo Rover';
  c_cargo_capacity_t constant integer := 6;
  v_existing_command public.vehicle_provisioning_commands%rowtype;
  v_slot public.vehicle_provisioning_slots%rowtype;
  v_created jsonb;
  v_snapshot jsonb;
  v_vehicle_id uuid;
  v_inventory_id uuid;
  v_event_id uuid;
  v_result jsonb;
begin
  if p_command_id is null or p_actor_profile_id is null or p_location_id is null then
    raise exception 'NOXIA_VEHICLE_PROVISION_ARGUMENT_REQUIRED' using errcode = 'P0001';
  end if;

  -- Same command retries serialize independently from the logical starter slot.
  perform pg_advisory_xact_lock(
    hashtextextended('noxia_provision_starter_cargo_rover:' || p_command_id::text, 0)
  );

  select * into v_existing_command
  from public.vehicle_provisioning_commands
  where command_id = p_command_id;

  if found then
    if v_existing_command.actor_profile_id is distinct from p_actor_profile_id
      or v_existing_command.slot_key is distinct from c_slot_key
      or v_existing_command.location_id is distinct from p_location_id then
      raise exception 'NOXIA_VEHICLE_PROVISION_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing_command.result || jsonb_build_object('idempotent', true);
  end if;

  if not exists (select 1 from public.profiles where id = p_actor_profile_id) then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- The first bootstrap target is the verified Moon/Shackleton world frame.
  -- This validates a canonical location; it does not duplicate Moon geometry.
  if not exists (
    select 1
    from public.world_frames wf
    where wf.location_id = p_location_id
      and wf.body = 'moon'
      and wf.origin_status = 'verified'
  ) then
    raise exception 'NOXIA_STARTER_CARGO_ROVER_LOCATION_UNSUPPORTED' using errcode = 'P0001';
  end if;

  -- Different command IDs for the same player still serialize on the logical
  -- starter slot. The PK below is the final invariant; the lock avoids making a
  -- normal concurrent retry pay for a unique-violation/retry cycle.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'noxia_vehicle_provisioning_slot:' || p_actor_profile_id::text || ':' || c_slot_key,
      0
    )
  );

  select * into v_slot
  from public.vehicle_provisioning_slots
  where owner_profile_id = p_actor_profile_id
    and slot_key = c_slot_key;

  if found then
    v_vehicle_id := v_slot.vehicle_instance_id;
    v_snapshot := public.noxia_vehicle_snapshot(v_vehicle_id);
    v_result := jsonb_build_object(
      'slotKey', c_slot_key,
      'vehicle', v_snapshot -> 'vehicle',
      'inventory', v_snapshot -> 'inventory',
      'created', false,
      'slotExisting', true
    );

    insert into public.vehicle_provisioning_commands(
      command_id, actor_profile_id, slot_key, location_id, result
    ) values (
      p_command_id, p_actor_profile_id, c_slot_key, p_location_id, v_result
    );

    return v_result || jsonb_build_object('idempotent', false);
  end if;

  -- 6 t and cargo-rover-reference come from the existing validated reference
  -- frame. No purchase price or research requirement is introduced here.
  v_created := public.noxia_create_vehicle_instance(
    c_frame_id,
    c_label,
    p_actor_profile_id,
    p_location_id,
    c_cargo_capacity_t,
    null,
    'bootstrap:' || c_slot_key || ':' || p_actor_profile_id::text
  );

  v_vehicle_id := (v_created -> 'vehicle' ->> 'id')::uuid;
  v_inventory_id := (v_created -> 'inventory' ->> 'id')::uuid;

  if v_vehicle_id is null or v_inventory_id is null then
    raise exception 'NOXIA_STARTER_CARGO_ROVER_CREATE_FAILED' using errcode = 'P0001';
  end if;

  insert into public.vehicle_provisioning_slots(
    owner_profile_id, slot_key, vehicle_instance_id, metadata
  ) values (
    p_actor_profile_id,
    c_slot_key,
    v_vehicle_id,
    jsonb_build_object(
      'provisioning', 'starter_bootstrap',
      'frameId', c_frame_id
    )
  );

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
    'vehicle.provisioned',
    'vehicle_instance',
    v_vehicle_id,
    p_actor_profile_id,
    p_location_id,
    jsonb_build_array(jsonb_build_object(
      'type', 'vehicle_provisioned',
      'frame_id', c_frame_id,
      'inventory_id', v_inventory_id,
      'slot_key', c_slot_key
    )),
    jsonb_build_object(
      'source', 'starter_bootstrap',
      'commandId', p_command_id,
      'slotKey', c_slot_key
    ),
    now(),
    'vehicle.provisioned:' || p_command_id::text
  ) returning id into v_event_id;

  v_snapshot := public.noxia_vehicle_snapshot(v_vehicle_id);
  v_result := jsonb_build_object(
    'slotKey', c_slot_key,
    'vehicle', v_snapshot -> 'vehicle',
    'inventory', v_snapshot -> 'inventory',
    'eventId', v_event_id,
    'created', true,
    'slotExisting', false
  );

  insert into public.vehicle_provisioning_commands(
    command_id, actor_profile_id, slot_key, location_id, result
  ) values (
    p_command_id, p_actor_profile_id, c_slot_key, p_location_id, v_result
  );

  return v_result || jsonb_build_object('idempotent', false);
end;
$function$;

revoke all on function public.noxia_provision_starter_cargo_rover(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.noxia_provision_starter_cargo_rover(uuid,uuid,uuid)
  to service_role;

comment on table public.vehicle_provisioning_slots is
  'Logical one-time vehicle provisioning slots. Slot uniqueness is separate from vehicle frame ownership.';
comment on table public.vehicle_provisioning_commands is
  'Durable idempotency ledger for vehicle provisioning commands.';
comment on function public.noxia_provision_starter_cargo_rover(uuid,uuid,uuid) is
  'Race-safe starter Cargo Rover bootstrap at the verified Moon/Shackleton location; no purchase, credit, or research semantics.';
