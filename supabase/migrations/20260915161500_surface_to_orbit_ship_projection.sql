-- Project existing surface_to_orbit TransportJob lifecycle onto a shuttle represented
-- by a canonical `ships` row / ship_cargo inventory. TransportJob remains the movement
-- authority; this trigger only updates the legacy ship movement projection so Arrival
-- Control and Docking can take over at the orbital interface.

set search_path = public;

create or replace function public.noxia_sync_surface_to_orbit_ship_from_transport_job()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_vehicle public.logistics_inventories%rowtype;
  v_ship public.ships%rowtype;
  v_target public.logistics_inventories%rowtype;
  v_station_slug text;
begin
  if new.domain <> 'surface_to_orbit'
     or new.vehicle_inventory_id is null
     or new.status is not distinct from old.status then
    return new;
  end if;

  select * into v_vehicle
  from public.logistics_inventories
  where id = new.vehicle_inventory_id and active;

  if not found
     or v_vehicle.storage_kind <> 'ship_cargo'
     or v_vehicle.subject_type <> 'ship'
     or v_vehicle.subject_id is null then
    return new;
  end if;

  select * into v_ship
  from public.ships
  where id = v_vehicle.subject_id;
  if not found then
    return new;
  end if;

  -- Only surface-transfer shuttles belong to this bridge. Intersolar craft use the
  -- canonical ship transit commands and must not be moved by a surface job.
  if public.noxia_ship_docking_class(v_ship.id) <> 'surface-transfer-shuttle' then
    raise exception 'NOXIA_SURFACE_TO_ORBIT_SHUTTLE_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_target
  from public.logistics_inventories
  where id = new.destination_inventory_id and active;
  if not found then
    raise exception 'NOXIA_INVENTORY_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_target.location_id is not null then
    select slug into v_station_slug
    from public.locations
    where id = v_target.location_id;
  end if;
  v_station_slug := public.noxia_canonical_station_slug(
    coalesce(v_target.metadata ->> 'stationSlug', v_station_slug)
  );

  if v_station_slug is null
     or not exists (select 1 from public.docking_ports where station_slug = v_station_slug) then
    raise exception 'NOXIA_SURFACE_TO_ORBIT_DESTINATION_NOT_ORBITAL' using errcode = 'P0001';
  end if;

  if new.status = 'in_transit' then
    update public.ships
    set status = 'transit',
        dest_location = v_station_slug,
        transit_started_at = coalesce(new.started_at, now()),
        arrives_at = new.arrives_at
    where id = v_ship.id;
  elsif new.status in ('arrived', 'unloading', 'completed')
        and old.status = 'in_transit' then
    update public.ships
    set location = v_station_slug,
        status = 'docked',
        dest_location = null,
        arrives_at = null
    where id = v_ship.id;
  elsif new.status = 'cancelled' and old.status in ('reserved', 'loading') then
    -- Cargo has not departed; no ship movement projection is needed.
    null;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_noxia_surface_to_orbit_ship_projection on public.transport_jobs;
create trigger trg_noxia_surface_to_orbit_ship_projection
after update of status on public.transport_jobs
for each row
execute function public.noxia_sync_surface_to_orbit_ship_from_transport_job();

revoke all on function public.noxia_sync_surface_to_orbit_ship_from_transport_job() from public, anon, authenticated;
grant execute on function public.noxia_sync_surface_to_orbit_ship_from_transport_job() to service_role;
