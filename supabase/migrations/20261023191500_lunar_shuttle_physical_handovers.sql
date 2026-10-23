-- Moon shuttle physical handovers: surface-port cargo requires staged shuttle;
-- completed ascent becomes orbital-interface holding, never implicit docking.
set search_path=public;

create or replace function public.noxia_transfer_staged_surface_shuttle_cargo(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_surface_port_inventory_id uuid,
  p_resource public.resource_type,
  p_amount integer,
  p_direction text
) returns jsonb
language plpgsql
security invoker
set search_path=public
as $function$
declare
  v_ship public.ships%rowtype;
  v_article public.spacecraft_flight_articles%rowtype;
  v_vehicle public.vehicle_instances%rowtype;
  v_port public.logistics_inventories%rowtype;
  v_ship_inventory public.logistics_inventories%rowtype;
begin
  if p_direction not in ('port-to-shuttle','shuttle-to-port') then
    raise exception 'NOXIA_SHUTTLE_CARGO_DIRECTION_INVALID' using errcode='P0001';
  end if;
  select * into v_ship from public.ships where id=p_ship_id for update;
  if not found then raise exception 'NOXIA_SHUTTLE_NOT_FOUND' using errcode='P0001'; end if;
  if v_ship.profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_SHUTTLE_CARGO_FORBIDDEN' using errcode='P0001'; end if;
  if public.noxia_ship_docking_class(v_ship.id)<>'surface-transfer-shuttle' then raise exception 'NOXIA_SHUTTLE_CLASS_REQUIRED' using errcode='P0001'; end if;

  select * into v_article from public.spacecraft_flight_articles where ship_id=p_ship_id;
  if not found or v_article.vehicle_instance_id is null then raise exception 'NOXIA_SHUTTLE_FLIGHT_ARTICLE_REQUIRED' using errcode='P0001'; end if;
  select * into v_vehicle from public.vehicle_instances where id=v_article.vehicle_instance_id for update;
  if not found then raise exception 'NOXIA_VEHICLE_NOT_FOUND' using errcode='P0001'; end if;

  select * into v_port from public.logistics_inventories where id=p_surface_port_inventory_id and active for update;
  if not found or v_port.inventory_kind<>'surface_port' or v_port.subject_type<>'tile_entity' then
    raise exception 'NOXIA_SHUTTLE_SURFACE_PORT_REQUIRED' using errcode='P0001';
  end if;
  if v_vehicle.current_node_inventory_id is distinct from v_port.id then
    raise exception 'NOXIA_SHUTTLE_NOT_STAGED_AT_PORT' using errcode='P0001';
  end if;

  select * into v_ship_inventory from public.logistics_inventories
  where storage_kind='ship_cargo' and subject_type='ship' and subject_id=p_ship_id and active
  for update;
  if not found then raise exception 'NOXIA_SHUTTLE_CARGO_INVENTORY_REQUIRED' using errcode='P0001'; end if;
  if v_ship_inventory.location_id is distinct from v_port.location_id then
    raise exception 'NOXIA_SHUTTLE_CARGO_LOCATION_MISMATCH' using errcode='P0001';
  end if;

  if p_direction='port-to-shuttle' then
    return public.noxia_transfer_cargo(p_command_id,p_actor_profile_id,v_port.id,v_ship_inventory.id,p_resource,p_amount);
  end if;
  return public.noxia_transfer_cargo(p_command_id,p_actor_profile_id,v_ship_inventory.id,v_port.id,p_resource,p_amount);
end;
$function$;

revoke all on function public.noxia_transfer_staged_surface_shuttle_cargo(uuid,uuid,uuid,uuid,public.resource_type,integer,text) from public,anon,authenticated;
grant execute on function public.noxia_transfer_staged_surface_shuttle_cargo(uuid,uuid,uuid,uuid,public.resource_type,integer,text) to service_role;

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
  if not exists(select 1 from public.docking_ports where station_slug=lower(new.body_slug) and active) then return new; end if;

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

drop trigger if exists trg_noxia_orbital_presence_to_station_holding on public.orbital_presence;
create trigger trg_noxia_orbital_presence_to_station_holding
after insert or update of orbit_node_slug,source_ascent_mission_id on public.orbital_presence
for each row execute function public.noxia_orbital_presence_to_station_holding();
