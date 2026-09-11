-- Shared authoritative vehicle-instance persistence for surface/rail/air/orbital domains.
-- Cargo remains in the shared logistics inventory model; this table owns living vehicle state.

alter table public.logistics_inventories
  drop constraint if exists logistics_capacity_check;

alter table public.logistics_inventories
  add constraint logistics_capacity_check check (capacity is null or capacity >= 0);

create table if not exists public.vehicle_instances (
  id uuid primary key default gen_random_uuid(),
  canonical_key text unique,
  frame_id text not null,
  label text not null,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  current_node_inventory_id uuid references public.logistics_inventories(id) on delete set null,
  status text not null default 'ready',
  condition smallint not null default 100,
  wear smallint not null default 0,
  cargo_capacity_t integer not null default 0,
  energy jsonb not null default '[]'::jsonb,
  crew_ids uuid[] not null default '{}'::uuid[],
  modules jsonb not null default '[]'::jsonb,
  modifications jsonb not null default '{}'::jsonb,
  emergent_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_instances_status_check check (
    status = any (array['inactive','ready','reserved','loading','in_transit','unloading','maintenance','damaged','disabled','lost']::text[])
  ),
  constraint vehicle_instances_condition_check check (condition between 0 and 100),
  constraint vehicle_instances_wear_check check (wear between 0 and 100),
  constraint vehicle_instances_cargo_capacity_check check (cargo_capacity_t >= 0),
  constraint vehicle_instances_energy_array_check check (jsonb_typeof(energy) = 'array'),
  constraint vehicle_instances_modules_array_check check (jsonb_typeof(modules) = 'array'),
  constraint vehicle_instances_modifications_object_check check (jsonb_typeof(modifications) = 'object'),
  constraint vehicle_instances_emergent_state_object_check check (jsonb_typeof(emergent_state) = 'object')
);

create index if not exists vehicle_instances_owner_location_idx
  on public.vehicle_instances(owner_profile_id, location_id, status);
create index if not exists vehicle_instances_location_status_idx
  on public.vehicle_instances(location_id, status);
create index if not exists vehicle_instances_current_node_idx
  on public.vehicle_instances(current_node_inventory_id)
  where current_node_inventory_id is not null;

alter table public.vehicle_instances enable row level security;
revoke all on table public.vehicle_instances from public, anon, authenticated;
grant select, insert, update, delete on table public.vehicle_instances to service_role;

create or replace function public.noxia_create_vehicle_instance(
  p_frame_id text,
  p_label text,
  p_owner_profile_id uuid,
  p_location_id uuid,
  p_cargo_capacity_t integer,
  p_current_node_inventory_id uuid default null,
  p_canonical_key text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_vehicle public.vehicle_instances%rowtype;
  v_inventory public.logistics_inventories%rowtype;
begin
  if coalesce(btrim(p_frame_id),'') = '' or coalesce(btrim(p_label),'') = '' then
    raise exception 'NOXIA_VEHICLE_FRAME_OR_LABEL_REQUIRED' using errcode='P0001';
  end if;
  if p_cargo_capacity_t is null or p_cargo_capacity_t < 0 then
    raise exception 'NOXIA_VEHICLE_CAPACITY_INVALID' using errcode='P0001';
  end if;

  if p_canonical_key is not null then
    select * into v_vehicle from public.vehicle_instances where canonical_key=p_canonical_key;
    if found then
      select * into v_inventory
      from public.logistics_inventories
      where storage_kind='native' and subject_type='vehicle_instance' and subject_id=v_vehicle.id;
      return jsonb_build_object('vehicle',to_jsonb(v_vehicle),'inventory',to_jsonb(v_inventory),'idempotent',true);
    end if;
  end if;

  if p_current_node_inventory_id is not null and not exists (
    select 1 from public.logistics_inventories where id=p_current_node_inventory_id and active
  ) then
    raise exception 'NOXIA_VEHICLE_NODE_NOT_FOUND' using errcode='P0001';
  end if;

  insert into public.vehicle_instances(
    canonical_key,frame_id,label,owner_profile_id,location_id,current_node_inventory_id,cargo_capacity_t
  ) values (
    p_canonical_key,btrim(p_frame_id),btrim(p_label),p_owner_profile_id,p_location_id,p_current_node_inventory_id,p_cargo_capacity_t
  ) returning * into v_vehicle;

  insert into public.logistics_inventories(
    owner_profile_id,location_id,inventory_kind,storage_kind,subject_type,subject_id,label,capacity,
    public_deposit,public_withdraw,metadata
  ) values (
    p_owner_profile_id,p_location_id,'vehicle','native','vehicle_instance',v_vehicle.id,
    v_vehicle.label || ' · Fracht',p_cargo_capacity_t,false,false,
    jsonb_build_object('vehicleInstanceId',v_vehicle.id,'frameId',v_vehicle.frame_id)
  ) returning * into v_inventory;

  return jsonb_build_object('vehicle',to_jsonb(v_vehicle),'inventory',to_jsonb(v_inventory),'idempotent',false);
end;
$function$;

create or replace function public.noxia_vehicle_snapshot(p_vehicle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_vehicle public.vehicle_instances%rowtype;
  v_inventory public.logistics_inventories%rowtype;
  v_job public.transport_jobs%rowtype;
begin
  select * into v_vehicle from public.vehicle_instances where id=p_vehicle_id;
  if not found then raise exception 'NOXIA_VEHICLE_NOT_FOUND' using errcode='P0001'; end if;

  select * into v_inventory
  from public.logistics_inventories
  where storage_kind='native' and subject_type='vehicle_instance' and subject_id=v_vehicle.id and active;

  if v_inventory.id is not null then
    select * into v_job
    from public.transport_jobs
    where vehicle_inventory_id=v_inventory.id
      and status = any(array['reserved','loading','in_transit','arrived','unloading']::text[])
    order by created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'vehicle',to_jsonb(v_vehicle),
    'inventory',case when v_inventory.id is null then null else public.noxia_inventory_snapshot(v_inventory.id) end,
    'activeTransportJob',case when v_job.id is null then null else to_jsonb(v_job) end
  );
end;
$function$;

create or replace function public.noxia_validate_vehicle_transport_assignment()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inventory public.logistics_inventories%rowtype;
  v_vehicle public.vehicle_instances%rowtype;
begin
  if new.vehicle_inventory_id is null then return new; end if;

  select * into v_inventory from public.logistics_inventories where id=new.vehicle_inventory_id and active;
  if not found then raise exception 'NOXIA_TRANSPORT_VEHICLE_INVALID' using errcode='P0001'; end if;

  if v_inventory.subject_type='vehicle_instance' then
    select * into v_vehicle from public.vehicle_instances where id=v_inventory.subject_id for update;
    if not found then raise exception 'NOXIA_VEHICLE_NOT_FOUND' using errcode='P0001'; end if;
    if v_vehicle.status <> 'ready' then
      raise exception 'NOXIA_TRANSPORT_VEHICLE_UNAVAILABLE:%',v_vehicle.status using errcode='P0001';
    end if;
    if v_vehicle.location_id is distinct from new.location_id and new.location_id is not null then
      raise exception 'NOXIA_TRANSPORT_VEHICLE_WRONG_LOCATION' using errcode='P0001';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists noxia_validate_vehicle_transport_assignment_trg on public.transport_jobs;
create trigger noxia_validate_vehicle_transport_assignment_trg
before insert on public.transport_jobs
for each row execute function public.noxia_validate_vehicle_transport_assignment();

create or replace function public.noxia_sync_vehicle_transport_state()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inventory public.logistics_inventories%rowtype;
  v_target_location uuid;
  v_source_location uuid;
begin
  if new.vehicle_inventory_id is null then return new; end if;
  select * into v_inventory from public.logistics_inventories where id=new.vehicle_inventory_id;
  if not found or v_inventory.subject_type <> 'vehicle_instance' then return new; end if;

  select location_id into v_source_location from public.logistics_inventories where id=new.source_inventory_id;
  select location_id into v_target_location from public.logistics_inventories where id=new.destination_inventory_id;

  if new.status='reserved' then
    update public.vehicle_instances
    set status='reserved',
        current_node_inventory_id=coalesce(current_node_inventory_id,new.source_inventory_id),
        location_id=coalesce(location_id,v_source_location),
        updated_at=now()
    where id=v_inventory.subject_id;
  elsif new.status='loading' then
    update public.vehicle_instances set status='loading',updated_at=now() where id=v_inventory.subject_id;
  elsif new.status='in_transit' then
    update public.vehicle_instances
    set status='in_transit',current_node_inventory_id=null,updated_at=now()
    where id=v_inventory.subject_id;
  elsif new.status in ('arrived','unloading') then
    update public.vehicle_instances
    set status='unloading',current_node_inventory_id=new.destination_inventory_id,
        location_id=coalesce(v_target_location,location_id),updated_at=now()
    where id=v_inventory.subject_id;
  elsif new.status='completed' then
    update public.vehicle_instances
    set status='ready',current_node_inventory_id=new.destination_inventory_id,
        location_id=coalesce(v_target_location,location_id),updated_at=now()
    where id=v_inventory.subject_id;
  elsif new.status='cancelled' then
    update public.vehicle_instances
    set status='ready',current_node_inventory_id=new.source_inventory_id,
        location_id=coalesce(v_source_location,location_id),updated_at=now()
    where id=v_inventory.subject_id;
  end if;

  update public.logistics_inventories
  set owner_profile_id=(select owner_profile_id from public.vehicle_instances where id=v_inventory.subject_id),
      location_id=(select location_id from public.vehicle_instances where id=v_inventory.subject_id),
      capacity=(select cargo_capacity_t from public.vehicle_instances where id=v_inventory.subject_id),
      label=(select label || ' · Fracht' from public.vehicle_instances where id=v_inventory.subject_id),
      updated_at=now()
  where id=v_inventory.id;

  return new;
end;
$function$;

drop trigger if exists noxia_sync_vehicle_transport_state_trg on public.transport_jobs;
create trigger noxia_sync_vehicle_transport_state_trg
after insert or update of status on public.transport_jobs
for each row execute function public.noxia_sync_vehicle_transport_state();

revoke all on function public.noxia_create_vehicle_instance(text,text,uuid,uuid,integer,uuid,text) from public,anon,authenticated;
revoke all on function public.noxia_vehicle_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.noxia_create_vehicle_instance(text,text,uuid,uuid,integer,uuid,text) to service_role;
grant execute on function public.noxia_vehicle_snapshot(uuid) to service_role;
