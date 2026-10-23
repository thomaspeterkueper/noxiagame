-- Shared NOXIA Core: explicit staging of player-owned surface vehicles at a physical logistics node.
-- This is not travel. It only establishes the initial/current node before a real surface TransportJob.
set search_path = public;

create table if not exists public.surface_vehicle_staging_commands (
  command_id uuid primary key,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_instance_id uuid not null references public.vehicle_instances(id) on delete cascade,
  target_inventory_id uuid not null references public.logistics_inventories(id) on delete restrict,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.surface_vehicle_staging_commands enable row level security;
revoke all on table public.surface_vehicle_staging_commands from public, anon, authenticated;
grant select,insert,update,delete on table public.surface_vehicle_staging_commands to service_role;

create or replace function public.noxia_stage_surface_vehicle(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_vehicle_instance_id uuid,
  p_target_inventory_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path=public
as $function$
declare
  v_existing public.surface_vehicle_staging_commands%rowtype;
  v_vehicle public.vehicle_instances%rowtype;
  v_target public.logistics_inventories%rowtype;
  v_snapshot jsonb;
  v_result jsonb;
begin
  if p_command_id is null or p_actor_profile_id is null or p_vehicle_instance_id is null or p_target_inventory_id is null then
    raise exception 'NOXIA_SURFACE_VEHICLE_STAGING_INVALID_ARGUMENT' using errcode='P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('noxia_stage_surface_vehicle:'||p_command_id::text,0));
  select * into v_existing from public.surface_vehicle_staging_commands where command_id=p_command_id;
  if found then
    if v_existing.actor_profile_id is distinct from p_actor_profile_id
       or v_existing.vehicle_instance_id is distinct from p_vehicle_instance_id
       or v_existing.target_inventory_id is distinct from p_target_inventory_id then
      raise exception 'NOXIA_SURFACE_VEHICLE_STAGING_COMMAND_CONFLICT' using errcode='P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent',true);
  end if;

  select * into v_vehicle from public.vehicle_instances where id=p_vehicle_instance_id for update;
  if not found then raise exception 'NOXIA_VEHICLE_NOT_FOUND' using errcode='P0001'; end if;
  if v_vehicle.owner_profile_id is distinct from p_actor_profile_id then
    raise exception 'NOXIA_SURFACE_VEHICLE_STAGING_FORBIDDEN' using errcode='P0001';
  end if;
  if v_vehicle.status <> 'ready' then
    raise exception 'NOXIA_SURFACE_VEHICLE_STAGING_NOT_READY' using errcode='P0001';
  end if;
  if exists (
    select 1 from public.transport_jobs
    where vehicle_inventory_id=(select id from public.logistics_inventories where subject_type='vehicle_instance' and subject_id=v_vehicle.id limit 1)
      and status not in ('completed','cancelled','failed')
  ) then
    raise exception 'NOXIA_SURFACE_VEHICLE_STAGING_ACTIVE_TRANSPORT' using errcode='P0001';
  end if;

  select * into v_target from public.logistics_inventories where id=p_target_inventory_id and active for update;
  if not found then raise exception 'NOXIA_SURFACE_VEHICLE_STAGING_TARGET_NOT_FOUND' using errcode='P0001'; end if;
  if v_target.location_id is distinct from v_vehicle.location_id then
    raise exception 'NOXIA_SURFACE_VEHICLE_STAGING_TARGET_WRONG_LOCATION' using errcode='P0001';
  end if;
  if v_target.inventory_kind='vehicle' or v_target.subject_type <> 'tile_entity' then
    raise exception 'NOXIA_SURFACE_VEHICLE_STAGING_TARGET_NOT_SPATIAL' using errcode='P0001';
  end if;
  if not (
    v_target.owner_profile_id is null
    or v_target.owner_profile_id=p_actor_profile_id
    or v_target.public_deposit
    or v_target.public_withdraw
  ) then
    raise exception 'NOXIA_SURFACE_VEHICLE_STAGING_TARGET_FORBIDDEN' using errcode='P0001';
  end if;

  update public.vehicle_instances
  set current_node_inventory_id=p_target_inventory_id, updated_at=now()
  where id=p_vehicle_instance_id;

  v_snapshot:=public.noxia_vehicle_snapshot(p_vehicle_instance_id);
  v_result:=jsonb_build_object(
    'vehicleId',p_vehicle_instance_id,
    'targetInventoryId',p_target_inventory_id,
    'vehicle',v_snapshot->'vehicle',
    'inventory',v_snapshot->'inventory',
    'idempotent',false
  );
  insert into public.surface_vehicle_staging_commands(command_id,actor_profile_id,vehicle_instance_id,target_inventory_id,result)
  values(p_command_id,p_actor_profile_id,p_vehicle_instance_id,p_target_inventory_id,v_result);
  return v_result;
end;
$function$;

revoke all on function public.noxia_stage_surface_vehicle(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.noxia_stage_surface_vehicle(uuid,uuid,uuid,uuid) to service_role;
