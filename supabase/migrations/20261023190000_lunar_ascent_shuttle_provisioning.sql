-- NOXIA Moon: provision one real Engineering-bound lunar ascent shuttle per profile.
-- Physical launch-state values deliberately remain unresolved until a trusted mission mass resolver supplies them.
set search_path=public;

create table if not exists public.lunar_ascent_shuttle_slots(
  owner_profile_id uuid primary key references public.profiles(id) on delete cascade,
  ship_id uuid not null unique references public.ships(id) on delete cascade,
  vehicle_instance_id uuid not null unique references public.vehicle_instances(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.lunar_ascent_shuttle_slots enable row level security;
revoke all on table public.lunar_ascent_shuttle_slots from public,anon,authenticated;
grant select,insert,update,delete on table public.lunar_ascent_shuttle_slots to service_role;

create table if not exists public.lunar_ascent_shuttle_commands(
  command_id uuid primary key,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.lunar_ascent_shuttle_commands enable row level security;
revoke all on table public.lunar_ascent_shuttle_commands from public,anon,authenticated;
grant select,insert,update,delete on table public.lunar_ascent_shuttle_commands to service_role;

create or replace function public.noxia_provision_lunar_ascent_shuttle(
  p_command_id uuid,
  p_actor_profile_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path=public
as $function$
declare
  v_existing public.lunar_ascent_shuttle_commands%rowtype;
  v_slot public.lunar_ascent_shuttle_slots%rowtype;
  v_location_id uuid;
  v_ship public.ships%rowtype;
  v_vehicle public.vehicle_instances%rowtype;
  v_inventory public.logistics_inventories%rowtype;
  v_result jsonb;
begin
  if p_command_id is null or p_actor_profile_id is null then
    raise exception 'NOXIA_LUNAR_SHUTTLE_ARGUMENT_REQUIRED' using errcode='P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('noxia_lunar_ascent_shuttle:'||p_command_id::text,0));
  select * into v_existing from public.lunar_ascent_shuttle_commands where command_id=p_command_id;
  if found then
    if v_existing.actor_profile_id is distinct from p_actor_profile_id then
      raise exception 'NOXIA_LUNAR_SHUTTLE_COMMAND_CONFLICT' using errcode='P0001';
    end if;
    return v_existing.result||jsonb_build_object('idempotent',true);
  end if;
  if not exists(select 1 from public.profiles where id=p_actor_profile_id) then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode='P0001';
  end if;
  select id into v_location_id from public.locations where slug='moon';
  if v_location_id is null then raise exception 'NOXIA_MOON_LOCATION_NOT_FOUND' using errcode='P0001'; end if;

  perform pg_advisory_xact_lock(hashtextextended('noxia_lunar_ascent_shuttle_slot:'||p_actor_profile_id::text,0));
  select * into v_slot from public.lunar_ascent_shuttle_slots where owner_profile_id=p_actor_profile_id;
  if found then
    select * into v_ship from public.ships where id=v_slot.ship_id;
    select * into v_vehicle from public.vehicle_instances where id=v_slot.vehicle_instance_id;
    select * into v_inventory from public.logistics_inventories
      where storage_kind='ship_cargo' and subject_type='ship' and subject_id=v_slot.ship_id and active;
    if v_ship.id is null or v_vehicle.id is null or v_inventory.id is null then
      raise exception 'NOXIA_LUNAR_SHUTTLE_SLOT_INVALID' using errcode='P0001';
    end if;
    v_result:=jsonb_build_object('ship',to_jsonb(v_ship),'vehicle',to_jsonb(v_vehicle),'inventory',public.noxia_inventory_snapshot(v_inventory.id),'created',false,'physicalStateResolved',false);
    insert into public.lunar_ascent_shuttle_commands(command_id,actor_profile_id,result) values(p_command_id,p_actor_profile_id,v_result);
    return v_result||jsonb_build_object('idempotent',false);
  end if;

  insert into public.ships(profile_id,name,cargo_max,location,status,ship_type_id,is_active)
  values(p_actor_profile_id,'Lunar Ascent Shuttle Mk.I',2,'moon','docked','lunar_ascent_shuttle_mk1',false)
  returning * into v_ship;

  insert into public.vehicle_instances(
    canonical_key,frame_id,label,owner_profile_id,location_id,status,cargo_capacity_t,energy,modifications
  ) values(
    'lunar-ascent-shuttle:'||p_actor_profile_id::text,
    'ENG-SCV-0002','Lunar Ascent Shuttle Mk.I',p_actor_profile_id,v_location_id,'ready',2,'[]'::jsonb,
    jsonb_build_object('engineeringAuthority','ENG-LUNAR-ASCENT-r1','role','surface-transfer-shuttle')
  ) returning * into v_vehicle;

  insert into public.logistics_inventories(
    owner_profile_id,location_id,inventory_kind,storage_kind,subject_type,subject_id,label,capacity,
    public_deposit,public_withdraw,metadata
  ) values(
    p_actor_profile_id,v_location_id,'vehicle','ship_cargo','ship',v_ship.id,
    'Lunar Ascent Shuttle Mk.I · Fracht',2,false,false,
    jsonb_build_object('vehicleClass','surface-transfer-shuttle','engineeringFrameId','ENG-SCV-0002','vehicleInstanceId',v_vehicle.id)
  ) returning * into v_inventory;

  insert into public.spacecraft_flight_articles(
    ship_id,owner_profile_id,vehicle_instance_id,engineering_frame_id,engineering_authority_ref,
    configuration_ref,actual_start_mass_kg,crew_mass_resolved,cargo_mass_resolved,
    mission_equipment_mass_resolved,crew_cargo_mission_equipment_kg,usable_ascent_propellant_kg,
    propellant_state_ref,departure_site_ref,departure_site_class,target_plane_ref,target_plane_resolved,
    state_status,provenance
  ) values(
    v_ship.id,p_actor_profile_id,v_vehicle.id,'ENG-SCV-0002','ENG-LUNAR-ASCENT-r1',
    'ENG-SCV-0002/lunar-ascent-shuttle-mk1-r1',null,false,false,false,null,null,
    null,null,null,null,false,'configured',
    jsonb_build_object(
      'engineeringSource','kueper-engineering/spacecraft/ENG-SCV-0002-lunar-ascent-shuttle-mk1.md',
      'authoritySource','kueper-engineering/systems/lunar-ascent-authority-r1.json',
      'physicalState','unresolved',
      'note','Vehicle identity is authoritative; launch mass, crew/equipment mass and usable propellant must be resolved from concrete mission state.'
    )
  );

  insert into public.lunar_ascent_shuttle_slots(owner_profile_id,ship_id,vehicle_instance_id)
  values(p_actor_profile_id,v_ship.id,v_vehicle.id);

  v_result:=jsonb_build_object(
    'ship',to_jsonb(v_ship),'vehicle',to_jsonb(v_vehicle),'inventory',public.noxia_inventory_snapshot(v_inventory.id),
    'created',true,'physicalStateResolved',false
  );
  insert into public.lunar_ascent_shuttle_commands(command_id,actor_profile_id,result)
  values(p_command_id,p_actor_profile_id,v_result);
  return v_result||jsonb_build_object('idempotent',false);
end;
$function$;

revoke all on function public.noxia_provision_lunar_ascent_shuttle(uuid,uuid) from public,anon,authenticated;
grant execute on function public.noxia_provision_lunar_ascent_shuttle(uuid,uuid) to service_role;

create or replace function public.noxia_ship_docking_class(p_ship_type_id text) returns text
language sql immutable set search_path=public
as $function$
select case lower(coalesce(p_ship_type_id,''))
  when 'heavy_hauler' then 'intersolar-heavy'
  when 'pioneer' then 'intersolar-heavy'
  when 'asce-0.3p' then 'surface-transfer-shuttle'
  when 'lunar_ascent_shuttle_mk1' then 'surface-transfer-shuttle'
  when 'service_craft' then 'service-craft'
  when 'service-craft' then 'service-craft'
  else 'intersolar-standard'
end
$function$;

create or replace function public.noxia_ship_docking_class(p_ship_id uuid) returns text
language plpgsql set search_path=public
as $function$
declare v_ship_type text;
begin
  select ship_type_id into v_ship_type from public.ships where id=p_ship_id;
  if not found then raise exception 'NOXIA_DOCKING_SHIP_NOT_FOUND' using errcode='P0001'; end if;
  return public.noxia_ship_docking_class(v_ship_type);
end
$function$;
