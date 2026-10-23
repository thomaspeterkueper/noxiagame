-- NOXIA Core: bind Moon starter Cargo Rover to KUEPER Engineering lunar r1
-- 2026-10-23
--
-- Source of truth:
-- kueper-engineering/vehicles/lunar-surface-logistics-r1.json
-- ENG-LUNAR-SURFACE-LOGISTICS-r1 / ENG-VEH-0003
--
-- The historical cargo-rover-reference bootstrap identity is migrated only when
-- it is already bound to the logical starter_cargo_rover slot. Unrelated legacy
-- vehicle instances are deliberately left untouched.

set search_path to public;

do $migration$
declare
  c_slot_key constant text := 'starter_cargo_rover';
  c_legacy_frame_id constant text := 'cargo-rover-reference';
  c_frame_id constant text := 'eng-lunar-cargo-rover-r1';
  c_label constant text := 'Lunar Cargo Rover LCR-6';
  c_engineering_source constant text := 'ENG-LUNAR-SURFACE-LOGISTICS-r1:ENG-VEH-0003';
begin
  update public.vehicle_instances v
  set frame_id = c_frame_id,
      label = c_label,
      energy = case
        when v.energy is null or v.energy = '[]'::jsonb
          then jsonb_build_array(jsonb_build_object('storeId', 'battery', 'amount', 240))
        else v.energy
      end,
      modifications = coalesce(v.modifications, '{}'::jsonb) || jsonb_build_object(
        'engineeringSource', c_engineering_source,
        'legacyStarterFrameMigratedFrom', c_legacy_frame_id
      ),
      updated_at = now()
  from public.vehicle_provisioning_slots s
  where s.vehicle_instance_id = v.id
    and s.slot_key = c_slot_key
    and v.frame_id = c_legacy_frame_id;

  update public.vehicle_provisioning_slots s
  set metadata = coalesce(s.metadata, '{}'::jsonb) || jsonb_build_object(
        'provisioning', 'starter_bootstrap',
        'frameId', c_frame_id,
        'engineeringSource', c_engineering_source,
        'energyStoreId', 'battery',
        'energyCapacityKWh', 240
      )
  where s.slot_key = c_slot_key
    and exists (
      select 1
      from public.vehicle_instances v
      where v.id = s.vehicle_instance_id
        and v.frame_id = c_frame_id
    );

  -- Durable command replays must not return the stale legacy frame snapshot after
  -- a slot-bound starter has been migrated.
  update public.vehicle_provisioning_commands c
  set result = (c.result - 'vehicle' - 'inventory')
      || jsonb_build_object(
        'engineeringSource', c_engineering_source,
        'vehicle', snapshot.value -> 'vehicle',
        'inventory', snapshot.value -> 'inventory'
      )
  from public.vehicle_provisioning_slots s
  cross join lateral (
    select public.noxia_vehicle_snapshot(s.vehicle_instance_id) as value
  ) snapshot
  where c.actor_profile_id = s.owner_profile_id
    and c.slot_key = c_slot_key
    and s.slot_key = c_slot_key
    and exists (
      select 1
      from public.vehicle_instances v
      where v.id = s.vehicle_instance_id
        and v.frame_id = c_frame_id
    );
end
$migration$;

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
  c_frame_id constant text := 'eng-lunar-cargo-rover-r1';
  c_label constant text := 'Lunar Cargo Rover LCR-6';
  c_cargo_capacity_t constant integer := 6;
  c_energy_store_id constant text := 'battery';
  c_energy_capacity_kwh constant numeric := 240;
  c_engineering_source constant text := 'ENG-LUNAR-SURFACE-LOGISTICS-r1:ENG-VEH-0003';
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

  if not exists (
    select 1
    from public.world_frames wf
    where wf.location_id = p_location_id
      and wf.body = 'moon'
      and wf.origin_status = 'verified'
  ) then
    raise exception 'NOXIA_STARTER_CARGO_ROVER_LOCATION_UNSUPPORTED' using errcode = 'P0001';
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

    if v_snapshot -> 'vehicle' ->> 'frame_id' is distinct from c_frame_id then
      raise exception 'NOXIA_STARTER_CARGO_ROVER_FRAME_MISMATCH' using errcode = 'P0001';
    end if;

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
    raise exception 'NOXIA_STARTER_CARGO_ROVER_CREATE_FAILED' using errcode = 'P0001';
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
      'provisioning', 'starter_bootstrap',
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
      'source', 'moon_starter_bootstrap',
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

revoke all on function public.noxia_provision_starter_cargo_rover(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.noxia_provision_starter_cargo_rover(uuid,uuid,uuid)
  to service_role;

comment on function public.noxia_provision_starter_cargo_rover(uuid,uuid,uuid) is
  'Race-safe Moon starter LCR-6 bootstrap using KUEPER Engineering ENG-LUNAR-SURFACE-LOGISTICS-r1 / ENG-VEH-0003.';
