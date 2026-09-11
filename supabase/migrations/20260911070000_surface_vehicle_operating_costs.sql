-- Settle validated surface-vehicle energy and wear through the existing transport-job lifecycle.
-- World domains supply route multipliers; Vehicle/Engineering supplies absolute operating values.

create or replace function public.noxia_validate_surface_vehicle_operating_budget()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inventory public.logistics_inventories%rowtype;
  v_vehicle public.vehicle_instances%rowtype;
  v_store_id text;
  v_required numeric;
  v_available numeric;
begin
  if new.domain <> 'surface'
     or new.vehicle_inventory_id is null
     or coalesce(new.route_snapshot->>'kind','') <> 'surface-vehicle-route-v1' then
    return new;
  end if;

  if jsonb_typeof(new.route_snapshot->'etaSeconds') <> 'number'
     or (new.route_snapshot->>'etaSeconds')::numeric <= 0
     or jsonb_typeof(new.route_snapshot->'energyRequired') <> 'number'
     or (new.route_snapshot->>'energyRequired')::numeric < 0
     or jsonb_typeof(new.route_snapshot->'wearIncrement') <> 'number'
     or (new.route_snapshot->>'wearIncrement')::numeric < 0
     or coalesce(btrim(new.route_snapshot->>'energyStoreId'),'') = '' then
    raise exception 'NOXIA_SURFACE_ROUTE_BUDGET_INVALID' using errcode='P0001';
  end if;

  v_store_id := btrim(new.route_snapshot->>'energyStoreId');
  v_required := (new.route_snapshot->>'energyRequired')::numeric;

  select * into v_inventory
  from public.logistics_inventories
  where id=new.vehicle_inventory_id and active;

  if not found or v_inventory.subject_type <> 'vehicle_instance' or v_inventory.subject_id is null then
    return new;
  end if;

  select * into v_vehicle
  from public.vehicle_instances
  where id=v_inventory.subject_id
  for update;

  if not found then
    raise exception 'NOXIA_VEHICLE_NOT_FOUND' using errcode='P0001';
  end if;

  select (entry->>'amount')::numeric into v_available
  from jsonb_array_elements(v_vehicle.energy) entry
  where entry->>'storeId'=v_store_id
    and jsonb_typeof(entry->'amount')='number'
  limit 1;

  if v_available is null then
    raise exception 'NOXIA_VEHICLE_ENERGY_STORE_MISSING:%',v_store_id using errcode='P0001';
  end if;
  if v_available < v_required then
    raise exception 'NOXIA_VEHICLE_ENERGY_INSUFFICIENT:%/%',v_available,v_required using errcode='P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists noxia_validate_surface_vehicle_operating_budget_trg on public.transport_jobs;
create trigger noxia_validate_surface_vehicle_operating_budget_trg
before insert or update of route_snapshot,vehicle_inventory_id,domain on public.transport_jobs
for each row execute function public.noxia_validate_surface_vehicle_operating_budget();

create or replace function public.noxia_apply_surface_vehicle_operating_costs()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inventory public.logistics_inventories%rowtype;
  v_vehicle public.vehicle_instances%rowtype;
  v_store_id text;
  v_required numeric;
  v_wear_increment numeric;
  v_wear_remainder numeric;
  v_wear_total numeric;
  v_wear_whole integer;
  v_next_energy jsonb;
  v_next_emergent jsonb;
begin
  if new.status <> 'completed'
     or old.status = 'completed'
     or new.domain <> 'surface'
     or new.vehicle_inventory_id is null
     or coalesce(new.route_snapshot->>'kind','') <> 'surface-vehicle-route-v1' then
    return new;
  end if;

  v_store_id := btrim(new.route_snapshot->>'energyStoreId');
  v_required := (new.route_snapshot->>'energyRequired')::numeric;
  v_wear_increment := (new.route_snapshot->>'wearIncrement')::numeric;

  select * into v_inventory
  from public.logistics_inventories
  where id=new.vehicle_inventory_id;

  if not found or v_inventory.subject_type <> 'vehicle_instance' or v_inventory.subject_id is null then
    return new;
  end if;

  select * into v_vehicle
  from public.vehicle_instances
  where id=v_inventory.subject_id
  for update;

  if not found then
    raise exception 'NOXIA_VEHICLE_NOT_FOUND' using errcode='P0001';
  end if;

  select coalesce(jsonb_agg(
    case
      when entry->>'storeId'=v_store_id then
        jsonb_set(
          entry,
          '{amount}',
          to_jsonb(greatest(0::numeric,(entry->>'amount')::numeric-v_required)),
          false
        )
      else entry
    end
  ),'[]'::jsonb)
  into v_next_energy
  from jsonb_array_elements(v_vehicle.energy) entry;

  begin
    v_wear_remainder := coalesce((v_vehicle.emergent_state->>'surfaceWearRemainder')::numeric,0);
  exception when others then
    v_wear_remainder := 0;
  end;

  v_wear_total := greatest(0,v_wear_remainder+v_wear_increment);
  v_wear_whole := floor(v_wear_total)::integer;
  v_next_emergent := jsonb_set(
    coalesce(v_vehicle.emergent_state,'{}'::jsonb),
    '{surfaceWearRemainder}',
    to_jsonb(v_wear_total-v_wear_whole),
    true
  );

  update public.vehicle_instances
  set energy=v_next_energy,
      wear=least(100,wear+v_wear_whole),
      emergent_state=v_next_emergent,
      updated_at=now()
  where id=v_vehicle.id;

  return new;
end;
$function$;

drop trigger if exists noxia_apply_surface_vehicle_operating_costs_trg on public.transport_jobs;
create trigger noxia_apply_surface_vehicle_operating_costs_trg
after update of status on public.transport_jobs
for each row execute function public.noxia_apply_surface_vehicle_operating_costs();

revoke all on function public.noxia_validate_surface_vehicle_operating_budget() from public,anon,authenticated;
revoke all on function public.noxia_apply_surface_vehicle_operating_costs() from public,anon,authenticated;
