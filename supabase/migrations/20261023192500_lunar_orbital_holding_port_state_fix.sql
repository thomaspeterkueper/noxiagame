create or replace function public.noxia_orbital_presence_to_station_holding()
returns trigger
language plpgsql
set search_path=public
as $function$
declare
  v_class text;
  v_zone text;
begin
  if lower(new.body_slug) not in ('moon','phobos','earth','mars') then return new; end if;
  if not exists(select 1 from public.docking_ports where station_slug=lower(new.body_slug) and not offline) then return new; end if;

  v_class:=public.noxia_ship_docking_class(new.ship_id);
  v_zone:=case v_class
    when 'surface-transfer-shuttle' then lower(new.body_slug)||'-h-light'
    when 'intersolar-heavy' then lower(new.body_slug)||'-h-heavy'
    else lower(new.body_slug)||'-h-standard'
  end;

  insert into public.ship_arrival_states(
    ship_id,station_slug,phase,holding_zone_id,holding_reason,queue_entered_at,target_port_id,updated_at
  ) values(
    new.ship_id,lower(new.body_slug),'holding',v_zone,'orbital-rendezvous-awaiting-port',now(),null,now()
  )
  on conflict(ship_id) do update set
    station_slug=excluded.station_slug,
    phase='holding',
    holding_zone_id=excluded.holding_zone_id,
    holding_reason=excluded.holding_reason,
    queue_entered_at=now(),
    target_port_id=null,
    updated_at=now();

  update public.vehicle_instances vi
     set current_node_inventory_id=null, location_id=(select id from public.locations where slug=lower(new.body_slug)), updated_at=now()
   where vi.id=(select vehicle_instance_id from public.spacecraft_flight_articles where ship_id=new.ship_id);

  return new;
end;
$function$;


