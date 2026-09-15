-- NOXIA Core: Earth starter Cargo Rover provisioning bound to Engineering r1
-- 2026-09-15
--
-- This is intentionally separate from the existing Moon/Shackleton bootstrap.
-- Existing Moon slots and cargo-rover-reference instances remain untouched.

set search_path to public;

create or replace function public.noxia_provision_earth_starter_cargo_rover(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_location_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  c_slot_key constant text := 'earth_starter_cargo_rover';
  c_frame_id constant text := 'eng-earth-cargo-rover-r1';
  c_label constant text := 'Earth Cargo Rover ECR-8';
  c_cargo_capacity_t constant integer := 8;
  c_energy_store_id constant text := 'battery';
  c_energy_capacity_kwh constant numeric := 280;
  c_engineering_source constant text := 'ENG-EARTH-SURFACE-LOGISTICS-r1:ENG-VEH-0001';
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
    raise exception 'NOXIA_EARTH_VEHICLE_PROVISION_ARGUMENT_REQUIRED' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('noxia_provision_earth_starter_cargo_rover:' || p_command_id::text, 0)
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

  if not exists (
    select 1
    from public.locations l
    where l.id = p_location_id
      and l.slug = 'earth'
  ) then
    raise exception 'NOXIA_EARTH_STARTER_CARGO_ROVER_LOCATION_UNSUPPORTED' using errcode = 'P0001';
  end if;

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
      'engineeringSource', c_engineering_source,
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
    raise exception 'NOXIA_EARTH_STARTER_CARGO_ROVER_CREATE_FAILED' using errcode = 'P0001';
  end if;

  update public.vehicle_instances
  set energy = jsonb_build_array(jsonb_build_object(
        'storeId', c_energy_store_id,
        'amount', c_energy_capacity_kwh
      )),
      modifications = coalesce(modifications, '{}'::jsonb) || jsonb_build_object(
        'engineeringSource', c_engineering_source
      ),
      updated_at = now()
  where id = v_vehicle_id;

  insert into public.vehicle_provisioning_slots(
    owner_profile_id, slot_key, vehicle_instance_id, metadata
  ) values (
    p_actor_profile_id,
    c_slot_key,
    v_vehicle_id,
    jsonb_build_object(
      'provisioning', 'earth_starter_bootstrap',
      'frameId', c_frame_id,
      'engineeringSource', c_engineering_source,
      'energyStoreId', c_energy_store_id,
      'energyCapacityKWh', c_energy_capacity_kwh
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
      'slot_key', c_slot_key,
      'energy_store_id', c_energy_store_id,
      'energy_amount', c_energy_capacity_kwh
    )),
    jsonb_build_object(
      'source', 'earth_starter_bootstrap',
      'engineeringSource', c_engineering_source,
      'commandId', p_command_id,
      'slotKey', c_slot_key
    ),
    now(),
    'vehicle.provisioned:' || p_command_id::text
  ) returning id into v_event_id;

  v_snapshot := public.noxia_vehicle_snapshot(v_vehicle_id);
  v_result := jsonb_build_object(
    'slotKey', c_slot_key,
    'engineeringSource', c_engineering_source,
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

revoke all on function public.noxia_provision_earth_starter_cargo_rover(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.noxia_provision_earth_starter_cargo_rover(uuid,uuid,uuid)
  to service_role;

comment on function public.noxia_provision_earth_starter_cargo_rover(uuid,uuid,uuid) is
  'Race-safe Earth starter ECR-8 bootstrap using Engineering revision ENG-EARTH-SURFACE-LOGISTICS-r1; separate from Moon starter provisioning.';
