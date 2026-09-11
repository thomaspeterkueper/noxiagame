-- Logistics Core: shared inventories, reservations, cargo handovers and transport jobs.
-- Production migration version: 20260911060537
--
-- Core owns authoritative stock/reservation/job mutation. World domains only provide
-- route/traversal assessments through transport_jobs.route_snapshot.

create table if not exists public.logistics_inventories (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  inventory_kind text not null,
  storage_kind text not null,
  subject_type text not null,
  subject_id uuid,
  label text not null,
  capacity integer,
  public_deposit boolean not null default false,
  public_withdraw boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint logistics_inventory_kind_check check (
    inventory_kind = any (array['location','facility','depot','surface_port','vehicle','station']::text[])
  ),
  constraint logistics_storage_kind_check check (
    storage_kind = any (array['native','location_resources','ship_cargo']::text[])
  ),
  constraint logistics_capacity_check check (capacity is null or capacity > 0),
  constraint logistics_subject_backing_check check (
    storage_kind = 'native'
    or (storage_kind = 'location_resources' and subject_type = 'location' and subject_id is not null)
    or (storage_kind = 'ship_cargo' and subject_type = 'ship' and subject_id is not null)
  ),
  constraint logistics_inventories_storage_kind_subject_type_subject_id_key
    unique (storage_kind, subject_type, subject_id)
);

create table if not exists public.logistics_inventory_items (
  inventory_id uuid not null references public.logistics_inventories(id) on delete cascade,
  resource public.resource_type not null,
  amount integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (inventory_id, resource),
  constraint logistics_inventory_item_amount_check check (amount >= 0)
);

create table if not exists public.cargo_transfer_commands (
  command_id uuid primary key,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  source_inventory_id uuid not null references public.logistics_inventories(id),
  target_inventory_id uuid not null references public.logistics_inventories(id),
  resource public.resource_type not null,
  amount integer not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  constraint cargo_transfer_amount_check check (amount > 0),
  constraint cargo_transfer_different_nodes check (source_inventory_id <> target_inventory_id)
);

create table if not exists public.transport_jobs (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null unique,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  domain text not null default 'surface',
  source_inventory_id uuid not null references public.logistics_inventories(id),
  destination_inventory_id uuid not null references public.logistics_inventories(id),
  vehicle_inventory_id uuid references public.logistics_inventories(id),
  vehicle_role text,
  resource public.resource_type not null,
  amount integer not null,
  status text not null default 'reserved',
  route_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  arrives_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  failure_code text,
  updated_at timestamptz not null default now(),
  constraint transport_jobs_amount_check check (amount > 0),
  constraint transport_jobs_different_nodes check (source_inventory_id <> destination_inventory_id),
  constraint transport_jobs_domain_check check (
    domain = any (array['surface','surface_to_orbit','orbit','inter_node']::text[])
  ),
  constraint transport_jobs_status_check check (
    status = any (array['reserved','loading','in_transit','arrived','unloading','completed','cancelled','failed']::text[])
  )
);

create table if not exists public.logistics_reservations (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.logistics_inventories(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  resource public.resource_type not null,
  amount integer not null,
  direction text not null,
  purpose_type text not null,
  purpose_id uuid not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint logistics_reservation_amount_check check (amount > 0),
  constraint logistics_reservation_direction_check check (direction = any (array['outbound','inbound']::text[])),
  constraint logistics_reservation_status_check check (status = any (array['active','consumed','released']::text[])),
  constraint logistics_reservations_inventory_id_direction_purpose_type__key
    unique (inventory_id, direction, purpose_type, purpose_id, resource)
);

create index if not exists logistics_inventories_location_idx
  on public.logistics_inventories (location_id) where active;

create index if not exists logistics_reservations_active_idx
  on public.logistics_reservations (inventory_id, resource, direction) where status = 'active';

create index if not exists transport_jobs_actor_status_idx
  on public.transport_jobs (actor_profile_id, status, created_at desc);

create index if not exists transport_jobs_location_status_idx
  on public.transport_jobs (location_id, status, created_at desc);

create unique index if not exists transport_jobs_active_vehicle_uidx
  on public.transport_jobs (vehicle_inventory_id)
  where vehicle_inventory_id is not null
    and status = any (array['reserved','loading','in_transit','arrived','unloading']::text[]);

alter table public.logistics_inventories enable row level security;
alter table public.logistics_inventory_items enable row level security;
alter table public.logistics_reservations enable row level security;
alter table public.cargo_transfer_commands enable row level security;
alter table public.transport_jobs enable row level security;

revoke all on table public.logistics_inventories from public, anon, authenticated;
revoke all on table public.logistics_inventory_items from public, anon, authenticated;
revoke all on table public.logistics_reservations from public, anon, authenticated;
revoke all on table public.cargo_transfer_commands from public, anon, authenticated;
revoke all on table public.transport_jobs from public, anon, authenticated;

grant select, insert, update, delete on table public.logistics_inventories to service_role;
grant select, insert, update, delete on table public.logistics_inventory_items to service_role;
grant select, insert, update, delete on table public.logistics_reservations to service_role;
grant select, insert, update, delete on table public.cargo_transfer_commands to service_role;
grant select, insert, update, delete on table public.transport_jobs to service_role;

create or replace function public.noxia_inventory_amount(
  p_inventory_id uuid,
  p_resource public.resource_type
) returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inventory public.logistics_inventories%rowtype;
  v_amount integer;
begin
  select * into v_inventory from public.logistics_inventories where id = p_inventory_id and active;
  if not found then raise exception 'NOXIA_INVENTORY_NOT_FOUND:%', p_inventory_id using errcode = 'P0001'; end if;

  if v_inventory.storage_kind = 'native' then
    select amount into v_amount from public.logistics_inventory_items where inventory_id = p_inventory_id and resource = p_resource;
  elsif v_inventory.storage_kind = 'location_resources' then
    select stock into v_amount from public.location_resources where location_id = v_inventory.subject_id and resource = p_resource;
  elsif v_inventory.storage_kind = 'ship_cargo' then
    select amount into v_amount from public.ship_cargo where ship_id = v_inventory.subject_id and resource = p_resource;
  end if;
  return coalesce(v_amount, 0);
end;
$function$;

create or replace function public.noxia_inventory_total_amount(p_inventory_id uuid)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inventory public.logistics_inventories%rowtype;
  v_amount integer;
begin
  select * into v_inventory from public.logistics_inventories where id = p_inventory_id and active;
  if not found then raise exception 'NOXIA_INVENTORY_NOT_FOUND:%', p_inventory_id using errcode = 'P0001'; end if;

  if v_inventory.storage_kind = 'native' then
    select coalesce(sum(amount), 0)::integer into v_amount from public.logistics_inventory_items where inventory_id = p_inventory_id;
  elsif v_inventory.storage_kind = 'location_resources' then
    select coalesce(sum(stock), 0)::integer into v_amount from public.location_resources where location_id = v_inventory.subject_id;
  elsif v_inventory.storage_kind = 'ship_cargo' then
    select coalesce(sum(amount), 0)::integer into v_amount from public.ship_cargo where ship_id = v_inventory.subject_id;
  end if;
  return coalesce(v_amount, 0);
end;
$function$;

create or replace function public.noxia_inventory_capacity(p_inventory_id uuid)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inventory public.logistics_inventories%rowtype;
  v_capacity integer;
begin
  select * into v_inventory from public.logistics_inventories where id = p_inventory_id and active;
  if not found then raise exception 'NOXIA_INVENTORY_NOT_FOUND:%', p_inventory_id using errcode = 'P0001'; end if;
  if v_inventory.storage_kind = 'ship_cargo' then
    select cargo_max into v_capacity from public.ships where id = v_inventory.subject_id;
    return v_capacity;
  end if;
  return v_inventory.capacity;
end;
$function$;

create or replace function public.noxia_inventory_reserved(
  p_inventory_id uuid,
  p_resource public.resource_type,
  p_direction text
) returns integer
language sql
set search_path to 'public'
as $function$
  select coalesce(sum(amount), 0)::integer
  from public.logistics_reservations
  where inventory_id = p_inventory_id
    and resource = p_resource
    and direction = p_direction
    and status = 'active';
$function$;

create or replace function public.noxia_inventory_snapshot(p_inventory_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inventory public.logistics_inventories%rowtype;
  v_items jsonb;
  v_capacity integer;
begin
  select * into v_inventory from public.logistics_inventories where id=p_inventory_id and active;
  if not found then raise exception 'NOXIA_INVENTORY_NOT_FOUND' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'resource',r.type,
    'label',r.label,
    'unit',r.unit,
    'amount',public.noxia_inventory_amount(p_inventory_id,r.type),
    'reservedOutbound',public.noxia_inventory_reserved(p_inventory_id,r.type,'outbound'),
    'available',greatest(0,public.noxia_inventory_amount(p_inventory_id,r.type)-public.noxia_inventory_reserved(p_inventory_id,r.type,'outbound'))
  ) order by r.type::text),'[]'::jsonb) into v_items from public.resources r;
  v_capacity:=public.noxia_inventory_capacity(p_inventory_id);
  return to_jsonb(v_inventory)||jsonb_build_object('capacity',v_capacity,'totalAmount',public.noxia_inventory_total_amount(p_inventory_id),'items',v_items);
end;
$function$;

create or replace function public.noxia_adjust_inventory_amount(
  p_inventory_id uuid,
  p_resource public.resource_type,
  p_delta integer
) returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inventory public.logistics_inventories%rowtype;
  v_current integer;
  v_next integer;
begin
  select * into v_inventory from public.logistics_inventories where id = p_inventory_id and active for update;
  if not found then raise exception 'NOXIA_INVENTORY_NOT_FOUND:%', p_inventory_id using errcode = 'P0001'; end if;
  v_current := public.noxia_inventory_amount(p_inventory_id, p_resource);
  v_next := v_current + p_delta;
  if v_next < 0 then raise exception 'NOXIA_INVENTORY_STOCK_INSUFFICIENT:%:%', p_resource, v_current using errcode = 'P0001'; end if;

  if v_inventory.storage_kind = 'native' then
    insert into public.logistics_inventory_items(inventory_id, resource, amount, updated_at)
    values (p_inventory_id, p_resource, v_next, now())
    on conflict (inventory_id, resource) do update set amount = excluded.amount, updated_at = now();
  elsif v_inventory.storage_kind = 'location_resources' then
    insert into public.location_resources(location_id, resource, stock, consumption, production, updated_at)
    values (v_inventory.subject_id, p_resource, v_next, 0, 0, now())
    on conflict (location_id, resource) do update set stock = excluded.stock, updated_at = now();
  elsif v_inventory.storage_kind = 'ship_cargo' then
    if v_next = 0 then
      delete from public.ship_cargo where ship_id = v_inventory.subject_id and resource = p_resource;
    else
      insert into public.ship_cargo(ship_id, resource, amount)
      values (v_inventory.subject_id, p_resource, v_next)
      on conflict (ship_id, resource) do update set amount = excluded.amount;
    end if;
  end if;
  return v_next;
end;
$function$;

create or replace function public.noxia_transfer_cargo(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_source_inventory_id uuid,
  p_target_inventory_id uuid,
  p_resource public.resource_type,
  p_amount integer
) returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_existing public.cargo_transfer_commands%rowtype;
  v_source public.logistics_inventories%rowtype;
  v_target public.logistics_inventories%rowtype;
  v_source_amount integer;
  v_source_reserved integer;
  v_target_total integer;
  v_target_reserved integer;
  v_target_capacity integer;
  v_source_after integer;
  v_target_after integer;
  v_result jsonb;
begin
  if p_command_id is null or p_actor_profile_id is null or p_source_inventory_id is null or p_target_inventory_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'NOXIA_CARGO_TRANSFER_INVALID_ARGUMENT' using errcode = 'P0001';
  end if;
  if p_source_inventory_id = p_target_inventory_id then raise exception 'NOXIA_CARGO_TRANSFER_SAME_INVENTORY' using errcode = 'P0001'; end if;

  select * into v_existing from public.cargo_transfer_commands where command_id = p_command_id;
  if found then
    if v_existing.actor_profile_id is distinct from p_actor_profile_id
       or v_existing.source_inventory_id is distinct from p_source_inventory_id
       or v_existing.target_inventory_id is distinct from p_target_inventory_id
       or v_existing.resource is distinct from p_resource
       or v_existing.amount is distinct from p_amount then
      raise exception 'NOXIA_CARGO_TRANSFER_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  perform id from public.logistics_inventories where id in (p_source_inventory_id, p_target_inventory_id) order by id for update;
  select * into v_source from public.logistics_inventories where id = p_source_inventory_id and active;
  select * into v_target from public.logistics_inventories where id = p_target_inventory_id and active;
  if v_source.id is null or v_target.id is null then raise exception 'NOXIA_INVENTORY_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_source.owner_profile_id is distinct from p_actor_profile_id and not v_source.public_withdraw then raise exception 'NOXIA_INVENTORY_SOURCE_FORBIDDEN' using errcode = 'P0001'; end if;
  if v_target.owner_profile_id is distinct from p_actor_profile_id and not v_target.public_deposit then raise exception 'NOXIA_INVENTORY_TARGET_FORBIDDEN' using errcode = 'P0001'; end if;

  v_source_amount := public.noxia_inventory_amount(p_source_inventory_id, p_resource);
  v_source_reserved := public.noxia_inventory_reserved(p_source_inventory_id, p_resource, 'outbound');
  if v_source_amount - v_source_reserved < p_amount then raise exception 'NOXIA_INVENTORY_AVAILABLE_INSUFFICIENT:%:%', p_resource, greatest(0, v_source_amount - v_source_reserved) using errcode = 'P0001'; end if;

  v_target_capacity := public.noxia_inventory_capacity(p_target_inventory_id);
  if v_target_capacity is not null then
    v_target_total := public.noxia_inventory_total_amount(p_target_inventory_id);
    select coalesce(sum(amount),0)::integer into v_target_reserved from public.logistics_reservations where inventory_id=p_target_inventory_id and direction='inbound' and status='active';
    if v_target_total + v_target_reserved + p_amount > v_target_capacity then raise exception 'NOXIA_INVENTORY_CAPACITY_INSUFFICIENT:%:%', v_target_capacity, v_target_total + v_target_reserved using errcode = 'P0001'; end if;
  end if;

  v_source_after := public.noxia_adjust_inventory_amount(p_source_inventory_id, p_resource, -p_amount);
  v_target_after := public.noxia_adjust_inventory_amount(p_target_inventory_id, p_resource, p_amount);
  v_result := jsonb_build_object('commandId',p_command_id,'sourceInventoryId',p_source_inventory_id,'targetInventoryId',p_target_inventory_id,'resource',p_resource,'amount',p_amount,'sourceAmount',v_source_after,'targetAmount',v_target_after,'idempotent',false);
  insert into public.cargo_transfer_commands(command_id,actor_profile_id,source_inventory_id,target_inventory_id,resource,amount,result)
  values (p_command_id,p_actor_profile_id,p_source_inventory_id,p_target_inventory_id,p_resource,p_amount,v_result);
  return v_result;
end;
$function$;

create or replace function public.noxia_create_transport_job(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_location_id uuid,
  p_domain text,
  p_source_inventory_id uuid,
  p_destination_inventory_id uuid,
  p_vehicle_inventory_id uuid,
  p_vehicle_role text,
  p_resource public.resource_type,
  p_amount integer,
  p_route_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_existing public.transport_jobs%rowtype;
  v_source public.logistics_inventories%rowtype;
  v_target public.logistics_inventories%rowtype;
  v_vehicle public.logistics_inventories%rowtype;
  v_job_id uuid := gen_random_uuid();
  v_available integer;
  v_capacity integer;
  v_total integer;
  v_inbound integer;
begin
  if p_command_id is null or p_actor_profile_id is null or p_source_inventory_id is null or p_destination_inventory_id is null or p_amount is null or p_amount <= 0 then raise exception 'NOXIA_TRANSPORT_JOB_INVALID_ARGUMENT' using errcode='P0001'; end if;
  select * into v_existing from public.transport_jobs where command_id = p_command_id;
  if found then
    if v_existing.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_COMMAND_CONFLICT' using errcode='P0001'; end if;
    return to_jsonb(v_existing) || jsonb_build_object('idempotent',true);
  end if;

  perform id from public.logistics_inventories where id in (p_source_inventory_id,p_destination_inventory_id,p_vehicle_inventory_id) order by id for update;
  select * into v_source from public.logistics_inventories where id=p_source_inventory_id and active;
  select * into v_target from public.logistics_inventories where id=p_destination_inventory_id and active;
  if v_source.id is null or v_target.id is null then raise exception 'NOXIA_INVENTORY_NOT_FOUND' using errcode='P0001'; end if;
  if v_source.owner_profile_id is distinct from p_actor_profile_id and not v_source.public_withdraw then raise exception 'NOXIA_INVENTORY_SOURCE_FORBIDDEN' using errcode='P0001'; end if;
  if v_target.owner_profile_id is distinct from p_actor_profile_id and not v_target.public_deposit then raise exception 'NOXIA_INVENTORY_TARGET_FORBIDDEN' using errcode='P0001'; end if;
  if p_domain='surface' and coalesce((p_route_snapshot->>'passable')::boolean,false) is not true then raise exception 'NOXIA_TRANSPORT_ROUTE_NOT_PASSABLE' using errcode='P0001'; end if;

  v_available := public.noxia_inventory_amount(p_source_inventory_id,p_resource) - public.noxia_inventory_reserved(p_source_inventory_id,p_resource,'outbound');
  if v_available < p_amount then raise exception 'NOXIA_INVENTORY_AVAILABLE_INSUFFICIENT:%:%',p_resource,greatest(0,v_available) using errcode='P0001'; end if;

  v_capacity := public.noxia_inventory_capacity(p_destination_inventory_id);
  if v_capacity is not null then
    v_total := public.noxia_inventory_total_amount(p_destination_inventory_id);
    select coalesce(sum(amount),0)::integer into v_inbound from public.logistics_reservations where inventory_id=p_destination_inventory_id and direction='inbound' and status='active';
    if v_total+v_inbound+p_amount > v_capacity then raise exception 'NOXIA_INVENTORY_CAPACITY_INSUFFICIENT:%:%',v_capacity,v_total+v_inbound using errcode='P0001'; end if;
  end if;

  if p_vehicle_inventory_id is not null then
    select * into v_vehicle from public.logistics_inventories where id=p_vehicle_inventory_id and active;
    if not found or v_vehicle.inventory_kind <> 'vehicle' then raise exception 'NOXIA_TRANSPORT_VEHICLE_INVALID' using errcode='P0001'; end if;
    if v_vehicle.owner_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_VEHICLE_FORBIDDEN' using errcode='P0001'; end if;
    v_capacity := public.noxia_inventory_capacity(p_vehicle_inventory_id);
    if v_capacity is not null and public.noxia_inventory_total_amount(p_vehicle_inventory_id)+p_amount > v_capacity then raise exception 'NOXIA_TRANSPORT_VEHICLE_CAPACITY_INSUFFICIENT' using errcode='P0001'; end if;
  end if;

  begin
    insert into public.transport_jobs(id,command_id,actor_profile_id,location_id,domain,source_inventory_id,destination_inventory_id,vehicle_inventory_id,vehicle_role,resource,amount,status,route_snapshot)
    values(v_job_id,p_command_id,p_actor_profile_id,p_location_id,coalesce(nullif(p_domain,''),'surface'),p_source_inventory_id,p_destination_inventory_id,p_vehicle_inventory_id,p_vehicle_role,p_resource,p_amount,'reserved',coalesce(p_route_snapshot,'{}'::jsonb));
  exception when unique_violation then
    raise exception 'NOXIA_TRANSPORT_VEHICLE_BUSY' using errcode='P0001';
  end;

  insert into public.logistics_reservations(inventory_id,actor_profile_id,resource,amount,direction,purpose_type,purpose_id)
  values
    (p_source_inventory_id,p_actor_profile_id,p_resource,p_amount,'outbound','transport_job',v_job_id),
    (p_destination_inventory_id,p_actor_profile_id,p_resource,p_amount,'inbound','transport_job',v_job_id);

  return (select to_jsonb(j) from public.transport_jobs j where j.id=v_job_id) || jsonb_build_object('idempotent',false);
end;
$function$;

create or replace function public.noxia_start_transport_job(p_job_id uuid, p_actor_profile_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_job public.transport_jobs%rowtype;
  v_capacity integer;
  v_eta integer;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status='in_transit' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status<>'reserved' then raise exception 'NOXIA_TRANSPORT_JOB_STATE_INVALID:%',v_job.status using errcode='P0001'; end if;
  if v_job.vehicle_inventory_id is null then raise exception 'NOXIA_TRANSPORT_VEHICLE_REQUIRED' using errcode='P0001'; end if;
  if v_job.domain='surface' and coalesce((v_job.route_snapshot->>'passable')::boolean,false) is not true then raise exception 'NOXIA_TRANSPORT_ROUTE_NOT_PASSABLE' using errcode='P0001'; end if;
  if public.noxia_inventory_amount(v_job.source_inventory_id,v_job.resource) < v_job.amount then raise exception 'NOXIA_INVENTORY_STOCK_INSUFFICIENT' using errcode='P0001'; end if;
  v_capacity:=public.noxia_inventory_capacity(v_job.vehicle_inventory_id);
  if v_capacity is not null and public.noxia_inventory_total_amount(v_job.vehicle_inventory_id)+v_job.amount>v_capacity then raise exception 'NOXIA_TRANSPORT_VEHICLE_CAPACITY_INSUFFICIENT' using errcode='P0001'; end if;

  perform public.noxia_adjust_inventory_amount(v_job.source_inventory_id,v_job.resource,-v_job.amount);
  perform public.noxia_adjust_inventory_amount(v_job.vehicle_inventory_id,v_job.resource,v_job.amount);
  update public.logistics_reservations set status='consumed',settled_at=now() where purpose_type='transport_job' and purpose_id=v_job.id and direction='outbound' and status='active';
  if coalesce(v_job.route_snapshot->>'etaSeconds','') ~ '^[0-9]+$' then v_eta:=(v_job.route_snapshot->>'etaSeconds')::integer; end if;
  update public.transport_jobs set status='in_transit',started_at=coalesce(started_at,now()),arrives_at=case when v_eta is not null and v_eta>0 then now()+make_interval(secs=>v_eta) else arrives_at end,updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

create or replace function public.noxia_arrive_transport_job(p_job_id uuid, p_actor_profile_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare v_job public.transport_jobs%rowtype;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status in ('arrived','unloading','completed') then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status<>'in_transit' then raise exception 'NOXIA_TRANSPORT_JOB_STATE_INVALID:%',v_job.status using errcode='P0001'; end if;
  if v_job.arrives_at is not null and v_job.arrives_at>now() then raise exception 'NOXIA_TRANSPORT_NOT_ARRIVED:%',extract(epoch from (v_job.arrives_at-now()))::integer using errcode='P0001'; end if;
  update public.transport_jobs set status='arrived',arrived_at=coalesce(arrived_at,now()),updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

create or replace function public.noxia_complete_transport_job(p_job_id uuid, p_actor_profile_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_job public.transport_jobs%rowtype;
  v_capacity integer;
  v_total integer;
  v_other_inbound integer;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status='completed' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status='in_transit' and v_job.arrives_at is not null and v_job.arrives_at<=now() then
    update public.transport_jobs set status='arrived',arrived_at=coalesce(arrived_at,now()),updated_at=now() where id=v_job.id returning * into v_job;
  end if;
  if v_job.status<>'arrived' then raise exception 'NOXIA_TRANSPORT_JOB_STATE_INVALID:%',v_job.status using errcode='P0001'; end if;
  if v_job.vehicle_inventory_id is null then raise exception 'NOXIA_TRANSPORT_VEHICLE_REQUIRED' using errcode='P0001'; end if;
  if public.noxia_inventory_amount(v_job.vehicle_inventory_id,v_job.resource)<v_job.amount then raise exception 'NOXIA_TRANSPORT_VEHICLE_CARGO_MISSING' using errcode='P0001'; end if;

  update public.logistics_reservations set status='consumed',settled_at=now() where purpose_type='transport_job' and purpose_id=v_job.id and direction='inbound' and status='active';
  v_capacity:=public.noxia_inventory_capacity(v_job.destination_inventory_id);
  if v_capacity is not null then
    v_total:=public.noxia_inventory_total_amount(v_job.destination_inventory_id);
    select coalesce(sum(amount),0)::integer into v_other_inbound from public.logistics_reservations where inventory_id=v_job.destination_inventory_id and direction='inbound' and status='active';
    if v_total+v_other_inbound+v_job.amount>v_capacity then raise exception 'NOXIA_INVENTORY_CAPACITY_INSUFFICIENT' using errcode='P0001'; end if;
  end if;
  perform public.noxia_adjust_inventory_amount(v_job.vehicle_inventory_id,v_job.resource,-v_job.amount);
  perform public.noxia_adjust_inventory_amount(v_job.destination_inventory_id,v_job.resource,v_job.amount);
  update public.transport_jobs set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

create or replace function public.noxia_cancel_transport_job(p_job_id uuid, p_actor_profile_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare v_job public.transport_jobs%rowtype;
begin
  select * into v_job from public.transport_jobs where id=p_job_id for update;
  if not found then raise exception 'NOXIA_TRANSPORT_JOB_NOT_FOUND' using errcode='P0001'; end if;
  if v_job.actor_profile_id is distinct from p_actor_profile_id then raise exception 'NOXIA_TRANSPORT_JOB_FORBIDDEN' using errcode='P0001'; end if;
  if v_job.status='cancelled' then return to_jsonb(v_job)||jsonb_build_object('idempotent',true); end if;
  if v_job.status<>'reserved' then raise exception 'NOXIA_TRANSPORT_CANCEL_REQUIRES_RESERVED:%',v_job.status using errcode='P0001'; end if;
  update public.logistics_reservations set status='released',settled_at=now() where purpose_type='transport_job' and purpose_id=v_job.id and status='active';
  update public.transport_jobs set status='cancelled',cancelled_at=now(),updated_at=now() where id=v_job.id returning * into v_job;
  return to_jsonb(v_job)||jsonb_build_object('idempotent',false);
end;
$function$;

revoke all on function public.noxia_inventory_amount(uuid, public.resource_type) from public, anon, authenticated;
revoke all on function public.noxia_inventory_total_amount(uuid) from public, anon, authenticated;
revoke all on function public.noxia_inventory_capacity(uuid) from public, anon, authenticated;
revoke all on function public.noxia_inventory_reserved(uuid, public.resource_type, text) from public, anon, authenticated;
revoke all on function public.noxia_inventory_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.noxia_adjust_inventory_amount(uuid, public.resource_type, integer) from public, anon, authenticated;
revoke all on function public.noxia_transfer_cargo(uuid, uuid, uuid, uuid, public.resource_type, integer) from public, anon, authenticated;
revoke all on function public.noxia_create_transport_job(uuid, uuid, uuid, text, uuid, uuid, uuid, text, public.resource_type, integer, jsonb) from public, anon, authenticated;
revoke all on function public.noxia_start_transport_job(uuid, uuid) from public, anon, authenticated;
revoke all on function public.noxia_arrive_transport_job(uuid, uuid) from public, anon, authenticated;
revoke all on function public.noxia_complete_transport_job(uuid, uuid) from public, anon, authenticated;
revoke all on function public.noxia_cancel_transport_job(uuid, uuid) from public, anon, authenticated;

grant execute on function public.noxia_inventory_amount(uuid, public.resource_type) to service_role;
grant execute on function public.noxia_inventory_total_amount(uuid) to service_role;
grant execute on function public.noxia_inventory_capacity(uuid) to service_role;
grant execute on function public.noxia_inventory_reserved(uuid, public.resource_type, text) to service_role;
grant execute on function public.noxia_inventory_snapshot(uuid) to service_role;
grant execute on function public.noxia_adjust_inventory_amount(uuid, public.resource_type, integer) to service_role;
grant execute on function public.noxia_transfer_cargo(uuid, uuid, uuid, uuid, public.resource_type, integer) to service_role;
grant execute on function public.noxia_create_transport_job(uuid, uuid, uuid, text, uuid, uuid, uuid, text, public.resource_type, integer, jsonb) to service_role;
grant execute on function public.noxia_start_transport_job(uuid, uuid) to service_role;
grant execute on function public.noxia_arrive_transport_job(uuid, uuid) to service_role;
grant execute on function public.noxia_complete_transport_job(uuid, uuid) to service_role;
grant execute on function public.noxia_cancel_transport_job(uuid, uuid) to service_role;

-- Adapter inventories keep current aggregate tables usable while the rest of the
-- game migrates incrementally to addressable logistics nodes.
insert into public.logistics_inventories (
  owner_profile_id, location_id, inventory_kind, storage_kind, subject_type,
  subject_id, label, capacity, public_deposit, public_withdraw, metadata
)
select
  null,
  l.id,
  'location',
  'location_resources',
  'location',
  l.id,
  l.name || ' · Standortbestand',
  null,
  false,
  false,
  jsonb_build_object('legacyAggregate', true)
from public.locations l
on conflict (storage_kind, subject_type, subject_id) do update
set location_id = excluded.location_id,
    label = excluded.label,
    updated_at = now();

insert into public.logistics_inventories (
  owner_profile_id, location_id, inventory_kind, storage_kind, subject_type,
  subject_id, label, capacity, public_deposit, public_withdraw, metadata
)
select
  s.profile_id,
  l.id,
  'vehicle',
  'ship_cargo',
  'ship',
  s.id,
  s.name,
  s.cargo_max,
  false,
  false,
  jsonb_build_object('vehicleClass', 'ship')
from public.ships s
left join public.locations l on l.slug = s.location
on conflict (storage_kind, subject_type, subject_id) do update
set owner_profile_id = excluded.owner_profile_id,
    location_id = excluded.location_id,
    label = excluded.label,
    capacity = excluded.capacity,
    metadata = excluded.metadata,
    active = true,
    updated_at = now();

-- Shackleton reference facilities are real inventory nodes, while their stock is
-- still intentionally empty until production/gameplay fills it.
insert into public.logistics_inventories (
  owner_profile_id, location_id, inventory_kind, storage_kind, subject_type,
  subject_id, label, capacity, public_deposit, public_withdraw, metadata
)
select
  coalesce(te.owner_id, te.profile_id),
  te.location_id,
  case
    when te.entity_id = 'warehouse' then 'depot'
    when te.entity_id = 'landing_pad' then 'surface_port'
    else 'facility'
  end,
  'native',
  'tile_entity',
  te.id,
  case
    when te.entity_id = 'warehouse' then 'Warenhaus · Logistik-Hub'
    when te.entity_id = 'landing_pad' then 'Shuttle-Port-Lager'
    else 'Mine · Minenpuffer'
  end,
  null,
  te.entity_id in ('warehouse','landing_pad'),
  te.entity_id in ('warehouse','landing_pad'),
  jsonb_build_object('ownerClass', te.owner_class, 'buildingType', te.entity_id)
from public.tile_entities te
join public.locations l on l.id = te.location_id and l.slug = 'moon'
where te.status = 'active'
  and te.entity_id in ('mine','warehouse','landing_pad')
on conflict (storage_kind, subject_type, subject_id) do update
set owner_profile_id = excluded.owner_profile_id,
    location_id = excluded.location_id,
    inventory_kind = excluded.inventory_kind,
    label = excluded.label,
    public_deposit = excluded.public_deposit,
    public_withdraw = excluded.public_withdraw,
    metadata = excluded.metadata,
    active = true,
    updated_at = now();
