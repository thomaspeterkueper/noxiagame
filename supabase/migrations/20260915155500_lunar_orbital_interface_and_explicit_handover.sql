-- NOXIA Core: Lunar Orbital Interface and explicit-handover transport completion.
--
-- The Moon remains one aggregated runtime location (`moon`). The orbital depot is
-- distinguished by inventory role/metadata and by canonical docking ports.
-- Cargo does not move merely because a shuttle arrives: a connected cargo transfer
-- must happen first, then the transport job can be finalized against that transfer.

set search_path = public;

-- Canonical Lunar Orbital Interface / depot. Reuse the Moon celestial-body UUID as
-- the stable subject id; (storage_kind, subject_type, subject_id) remains unique.
insert into public.logistics_inventories (
  owner_profile_id,
  location_id,
  inventory_kind,
  storage_kind,
  subject_type,
  subject_id,
  label,
  capacity,
  public_deposit,
  public_withdraw,
  active,
  metadata
)
select
  null,
  l.id,
  'station',
  'native',
  'orbital_interface',
  l.celestial_body_id,
  'Lunar Orbital Interface · Depot',
  null,
  true,
  true,
  true,
  jsonb_build_object(
    'role', 'orbital_depot',
    'stationSlug', 'moon',
    'bodySlug', 'moon',
    'handover', 'shuttle_freighter',
    'ownerClass', 'STATE'
  )
from public.locations l
where l.slug = 'moon'
  and l.celestial_body_id is not null
on conflict (storage_kind, subject_type, subject_id)
do update set
  location_id = excluded.location_id,
  inventory_kind = excluded.inventory_kind,
  label = excluded.label,
  public_deposit = true,
  public_withdraw = true,
  active = true,
  metadata = coalesce(public.logistics_inventories.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

-- Moon orbital-interface topology. No heavy berth is introduced: this interface is
-- deliberately shuttle + standard-freighter oriented until Engineering defines more.
insert into public.docking_ports (
  id, station_slug, label, port_class, role, cargo_enabled, crew_enabled, offline, metadata
) values
  ('moon-a1', 'moon', 'A1 Shuttle Handover', 'shuttle', 'shuttle-handover', true, true, false,
   jsonb_build_object('interface', 'lunar-orbital', 'bodySlug', 'moon')),
  ('moon-b1', 'moon', 'B1 Intersolar Transfer', 'standard', 'general-cargo', true, true, false,
   jsonb_build_object('interface', 'lunar-orbital', 'bodySlug', 'moon')),
  ('moon-s1', 'moon', 'S1 Service Dock', 'service', 'service-maintenance', false, true, false,
   jsonb_build_object('interface', 'lunar-orbital', 'bodySlug', 'moon'))
on conflict (id) do update set
  station_slug = excluded.station_slug,
  label = excluded.label,
  port_class = excluded.port_class,
  role = excluded.role,
  cargo_enabled = excluded.cargo_enabled,
  crew_enabled = excluded.crew_enabled,
  metadata = coalesce(public.docking_ports.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

-- Finalize a TransportJob whose cargo has already been moved by an explicit transfer.
-- This is the generic bridge needed when a leg and its handover must remain separate.
create or replace function public.noxia_complete_transport_job_after_handover(
  p_job_id uuid,
  p_actor_profile_id uuid,
  p_transfer_command_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_job public.transport_jobs%rowtype;
  v_transfer public.cargo_transfer_commands%rowtype;
  v_reservation public.logistics_reservations%rowtype;
begin
  if p_job_id is null or p_actor_profile_id is null or p_transfer_command_id is null then
    raise exception 'NOXIA_TRANSPORT_HANDOVER_INVALID_ARGUMENT' using errcode = 'P0001';
  end if;

  select * into v_job
  from public.transport_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then
    raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_job.status = 'completed' then
    return to_jsonb(v_job) || jsonb_build_object('idempotent', true, 'completionMode', 'explicit-handover');
  end if;
  if v_job.status not in ('arrived', 'unloading') then
    raise exception 'NOXIA_TRANSPORT_HANDOVER_STATE_INVALID:%', v_job.status using errcode = 'P0001';
  end if;
  if v_job.vehicle_inventory_id is null then
    raise exception 'NOXIA_TRANSPORT_VEHICLE_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_transfer
  from public.cargo_transfer_commands
  where command_id = p_transfer_command_id
  for update;

  if not found then
    raise exception 'NOXIA_TRANSPORT_HANDOVER_TRANSFER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_transfer.actor_profile_id is distinct from p_actor_profile_id
     or v_transfer.source_inventory_id is distinct from v_job.vehicle_inventory_id
     or v_transfer.target_inventory_id is distinct from v_job.destination_inventory_id
     or v_transfer.resource is distinct from v_job.resource
     or v_transfer.amount is distinct from v_job.amount then
    raise exception 'NOXIA_TRANSPORT_HANDOVER_TRANSFER_MISMATCH' using errcode = 'P0001';
  end if;
  if v_job.arrived_at is not null and v_transfer.completed_at < v_job.arrived_at then
    raise exception 'NOXIA_TRANSPORT_HANDOVER_TRANSFER_TOO_EARLY' using errcode = 'P0001';
  end if;

  select * into v_reservation
  from public.logistics_reservations
  where purpose_type = 'transport_job'
    and purpose_id = v_job.id
    and inventory_id = v_job.destination_inventory_id
    and direction = 'inbound'
    and status = 'active'
  for update;

  if found then
    update public.logistics_reservations
    set status = 'consumed', settled_at = now()
    where id = v_reservation.id;
  end if;

  update public.transport_job_handovers
  set status = 'completed', completed_at = coalesce(completed_at, now())
  where job_id = v_job.id
    and source_inventory_id = v_job.vehicle_inventory_id
    and target_inventory_id = v_job.destination_inventory_id
    and resource = v_job.resource
    and amount = v_job.amount
    and status = 'planned';

  update public.transport_jobs
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return to_jsonb(v_job) || jsonb_build_object(
    'idempotent', false,
    'completionMode', 'explicit-handover',
    'transferCommandId', p_transfer_command_id
  );
end;
$function$;

revoke all on function public.noxia_complete_transport_job_after_handover(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.noxia_complete_transport_job_after_handover(uuid,uuid,uuid) to service_role;

comment on function public.noxia_complete_transport_job_after_handover(uuid,uuid,uuid) is
  'Completes an arrived transport leg only after a separately recorded cargo transfer moved the exact job cargo from vehicle to destination.';
