-- Shared NOXIA Core: persistent station docking plus multi-leg logistics handovers.
--
-- This is additive to the existing logistics Core. Docking establishes a physical
-- connection only; it never moves cargo. Cargo movement remains an explicit,
-- atomic logistics command. The older ship_docking_assignments table continues
-- to represent concrete planetary landing-pad attribution and is not reused as
-- orbital/station berth state.

create table if not exists public.docking_ports (
  id text primary key,
  station_slug text not null,
  label text not null,
  port_class text not null,
  role text not null,
  cargo_enabled boolean not null default false,
  crew_enabled boolean not null default false,
  offline boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint docking_ports_class_check check (port_class = any (array['shuttle','standard','heavy','service']::text[]))
);

create table if not exists public.docking_reservations (
  id uuid primary key default gen_random_uuid(),
  port_id text not null references public.docking_ports(id) on delete cascade,
  ship_id uuid not null references public.ships(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active',
  reserved_at timestamptz not null default now(),
  expires_at timestamptz,
  settled_at timestamptz,
  constraint docking_reservations_status_check check (status = any (array['active','consumed','cancelled','expired']::text[]))
);

create table if not exists public.docking_connections (
  id uuid primary key default gen_random_uuid(),
  port_id text not null references public.docking_ports(id) on delete restrict,
  ship_id uuid not null references public.ships(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'docked',
  docked_at timestamptz not null default now(),
  released_at timestamptz,
  constraint docking_connections_status_check check (status = any (array['docked','released']::text[]))
);

create table if not exists public.docking_commands (
  command_id uuid primary key,
  action text not null,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  ship_id uuid not null references public.ships(id) on delete cascade,
  port_id text not null references public.docking_ports(id) on delete restrict,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint docking_commands_action_check check (action = any (array['reserve','dock','undock','cancel_reservation']::text[]))
);

create unique index if not exists docking_reservations_active_port_uidx
  on public.docking_reservations(port_id) where status = 'active';
create unique index if not exists docking_reservations_active_ship_uidx
  on public.docking_reservations(ship_id) where status = 'active';
create unique index if not exists docking_connections_active_port_uidx
  on public.docking_connections(port_id) where status = 'docked';
create unique index if not exists docking_connections_active_ship_uidx
  on public.docking_connections(ship_id) where status = 'docked';
create index if not exists docking_ports_station_idx on public.docking_ports(station_slug);

-- Canonical runtime topology mirrors lib/game/stationDockingTopologies.ts.
insert into public.docking_ports(id, station_slug, label, port_class, role, cargo_enabled, crew_enabled)
values
  ('phobos-a1','phobos','A1 Shuttle Handover','shuttle','shuttle-handover',true,true),
  ('phobos-a2','phobos','A2 Shuttle / Service','shuttle','service-maintenance',true,true),
  ('phobos-b1','phobos','B1 General Cargo','standard','general-cargo',true,true),
  ('phobos-b2','phobos','B2 General Cargo','standard','general-cargo',true,true),
  ('phobos-c1','phobos','C1 Heavy Cargo','heavy','heavy-freighter',true,true),
  ('phobos-s1','phobos','S1 Service Dock','service','service-maintenance',false,true),
  ('kepler-a1','prometheus','A1 Shuttle / Crew','shuttle','crew-passenger',true,true),
  ('kepler-b1','prometheus','B1 Transfer Berth','standard','general-cargo',true,true),
  ('kepler-s1','prometheus','S1 Service Dock','service','service-maintenance',false,true)
on conflict (id) do update set
  station_slug = excluded.station_slug,
  label = excluded.label,
  port_class = excluded.port_class,
  role = excluded.role,
  cargo_enabled = excluded.cargo_enabled,
  crew_enabled = excluded.crew_enabled,
  updated_at = now();

alter table public.docking_ports enable row level security;
alter table public.docking_reservations enable row level security;
alter table public.docking_connections enable row level security;
alter table public.docking_commands enable row level security;

revoke all on table public.docking_ports from public, anon, authenticated;
revoke all on table public.docking_reservations from public, anon, authenticated;
revoke all on table public.docking_connections from public, anon, authenticated;
revoke all on table public.docking_commands from public, anon, authenticated;

grant select, insert, update, delete on table public.docking_ports to service_role;
grant select, insert, update, delete on table public.docking_reservations to service_role;
grant select, insert, update, delete on table public.docking_connections to service_role;
grant select, insert, update, delete on table public.docking_commands to service_role;

create or replace function public.noxia_canonical_station_slug(p_slug text)
returns text
language sql
immutable
as $function$
  select case lower(coalesce(p_slug,'')) when 'kepler' then 'prometheus' else lower(coalesce(p_slug,'')) end;
$function$;

create or replace function public.noxia_ship_docking_class(p_ship_id uuid)
returns text
language plpgsql
set search_path = public
as $function$
declare
  v_ship_type text;
begin
  select ship_type_id into v_ship_type from public.ships where id = p_ship_id;
  if not found then raise exception 'NOXIA_DOCKING_SHIP_NOT_FOUND' using errcode = 'P0001'; end if;
  return case v_ship_type
    when 'heavy_hauler' then 'intersolar-heavy'
    when 'pioneer' then 'intersolar-heavy'
    when 'asce-0.3p' then 'surface-transfer-shuttle'
    when 'service_craft' then 'service-craft'
    when 'service-craft' then 'service-craft'
    else 'intersolar-standard'
  end;
end;
$function$;

create or replace function public.noxia_docking_compatible(p_vessel_class text, p_port_class text)
returns boolean
language sql
immutable
as $function$
  select case p_vessel_class
    when 'surface-transfer-shuttle' then p_port_class = any(array['shuttle','standard','service']::text[])
    when 'intersolar-standard' then p_port_class = any(array['standard','heavy']::text[])
    when 'intersolar-heavy' then p_port_class = 'heavy'
    when 'service-craft' then p_port_class = any(array['service','shuttle','standard']::text[])
    else false
  end;
$function$;

create or replace function public.noxia_cleanup_expired_docking_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count integer;
begin
  update public.docking_reservations
     set status = 'expired', settled_at = now()
   where status = 'active' and expires_at is not null and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function public.noxia_reserve_docking_port(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_port_id text,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing public.docking_commands%rowtype;
  v_ship public.ships%rowtype;
  v_port public.docking_ports%rowtype;
  v_reservation public.docking_reservations%rowtype;
  v_result jsonb;
  v_vessel_class text;
begin
  select * into v_existing from public.docking_commands where command_id = p_command_id;
  if found then
    if v_existing.action <> 'reserve' or v_existing.actor_profile_id <> p_actor_profile_id
       or v_existing.ship_id <> p_ship_id or v_existing.port_id <> p_port_id then
      raise exception 'NOXIA_DOCKING_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  perform public.noxia_cleanup_expired_docking_reservations();
  select * into v_ship from public.ships where id = p_ship_id for update;
  if not found then raise exception 'NOXIA_DOCKING_SHIP_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_ship.profile_id <> p_actor_profile_id then raise exception 'NOXIA_DOCKING_FORBIDDEN' using errcode = 'P0001'; end if;

  select * into v_port from public.docking_ports where id = p_port_id for update;
  if not found then raise exception 'NOXIA_DOCKING_PORT_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_port.offline then raise exception 'NOXIA_DOCKING_PORT_OFFLINE' using errcode = 'P0001'; end if;
  if public.noxia_canonical_station_slug(v_ship.location) <> public.noxia_canonical_station_slug(v_port.station_slug) then
    raise exception 'NOXIA_DOCKING_WRONG_LOCATION' using errcode = 'P0001';
  end if;

  v_vessel_class := public.noxia_ship_docking_class(p_ship_id);
  if not public.noxia_docking_compatible(v_vessel_class, v_port.port_class) then
    raise exception 'NOXIA_DOCKING_INCOMPATIBLE_PORT' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.docking_connections where ship_id = p_ship_id and status = 'docked') then
    raise exception 'NOXIA_DOCKING_SHIP_ALREADY_DOCKED' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.docking_connections where port_id = p_port_id and status = 'docked') then
    raise exception 'NOXIA_DOCKING_PORT_OCCUPIED' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.docking_reservations where port_id = p_port_id and status = 'active') then
    raise exception 'NOXIA_DOCKING_PORT_RESERVED' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.docking_reservations where ship_id = p_ship_id and status = 'active') then
    raise exception 'NOXIA_DOCKING_SHIP_ALREADY_RESERVED' using errcode = 'P0001';
  end if;

  insert into public.docking_reservations(port_id, ship_id, actor_profile_id, expires_at)
  values (p_port_id, p_ship_id, p_actor_profile_id, p_expires_at)
  returning * into v_reservation;

  v_result := jsonb_build_object(
    'reservationId', v_reservation.id,
    'portId', p_port_id,
    'shipId', p_ship_id,
    'status', 'reserved',
    'expiresAt', v_reservation.expires_at,
    'idempotent', false
  );
  insert into public.docking_commands(command_id, action, actor_profile_id, ship_id, port_id, result)
  values (p_command_id, 'reserve', p_actor_profile_id, p_ship_id, p_port_id, v_result);
  return v_result;
end;
$function$;

create or replace function public.noxia_dock_vessel(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_port_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing public.docking_commands%rowtype;
  v_ship public.ships%rowtype;
  v_port public.docking_ports%rowtype;
  v_reservation public.docking_reservations%rowtype;
  v_connection public.docking_connections%rowtype;
  v_result jsonb;
  v_vessel_class text;
begin
  select * into v_existing from public.docking_commands where command_id = p_command_id;
  if found then
    if v_existing.action <> 'dock' or v_existing.actor_profile_id <> p_actor_profile_id
       or v_existing.ship_id <> p_ship_id or v_existing.port_id <> p_port_id then
      raise exception 'NOXIA_DOCKING_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  perform public.noxia_cleanup_expired_docking_reservations();
  select * into v_ship from public.ships where id = p_ship_id for update;
  if not found then raise exception 'NOXIA_DOCKING_SHIP_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_ship.profile_id <> p_actor_profile_id then raise exception 'NOXIA_DOCKING_FORBIDDEN' using errcode = 'P0001'; end if;
  select * into v_port from public.docking_ports where id = p_port_id for update;
  if not found then raise exception 'NOXIA_DOCKING_PORT_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_port.offline then raise exception 'NOXIA_DOCKING_PORT_OFFLINE' using errcode = 'P0001'; end if;
  if public.noxia_canonical_station_slug(v_ship.location) <> public.noxia_canonical_station_slug(v_port.station_slug) then
    raise exception 'NOXIA_DOCKING_WRONG_LOCATION' using errcode = 'P0001';
  end if;
  v_vessel_class := public.noxia_ship_docking_class(p_ship_id);
  if not public.noxia_docking_compatible(v_vessel_class, v_port.port_class) then
    raise exception 'NOXIA_DOCKING_INCOMPATIBLE_PORT' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.docking_connections where ship_id = p_ship_id and status = 'docked') then
    raise exception 'NOXIA_DOCKING_SHIP_ALREADY_DOCKED' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.docking_connections where port_id = p_port_id and status = 'docked') then
    raise exception 'NOXIA_DOCKING_PORT_OCCUPIED' using errcode = 'P0001';
  end if;

  select * into v_reservation
    from public.docking_reservations
   where port_id = p_port_id and status = 'active'
   for update;
  if found and v_reservation.ship_id <> p_ship_id then
    raise exception 'NOXIA_DOCKING_PORT_RESERVED' using errcode = 'P0001';
  end if;
  if found then
    update public.docking_reservations
       set status = 'consumed', settled_at = now()
     where id = v_reservation.id;
  end if;

  insert into public.docking_connections(port_id, ship_id, actor_profile_id)
  values (p_port_id, p_ship_id, p_actor_profile_id)
  returning * into v_connection;

  v_result := jsonb_build_object(
    'connectionId', v_connection.id,
    'portId', p_port_id,
    'shipId', p_ship_id,
    'status', 'docked',
    'dockedAt', v_connection.docked_at,
    'idempotent', false
  );
  insert into public.docking_commands(command_id, action, actor_profile_id, ship_id, port_id, result)
  values (p_command_id, 'dock', p_actor_profile_id, p_ship_id, p_port_id, v_result);
  return v_result;
end;
$function$;

create or replace function public.noxia_undock_vessel(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_port_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing public.docking_commands%rowtype;
  v_connection public.docking_connections%rowtype;
  v_result jsonb;
begin
  select * into v_existing from public.docking_commands where command_id = p_command_id;
  if found then
    if v_existing.action <> 'undock' or v_existing.actor_profile_id <> p_actor_profile_id
       or v_existing.ship_id <> p_ship_id or v_existing.port_id <> p_port_id then
      raise exception 'NOXIA_DOCKING_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select c.* into v_connection
    from public.docking_connections c
    join public.ships s on s.id = c.ship_id
   where c.ship_id = p_ship_id and c.port_id = p_port_id and c.status = 'docked'
     and s.profile_id = p_actor_profile_id
   for update of c;
  if not found then raise exception 'NOXIA_DOCKING_CONNECTION_NOT_FOUND' using errcode = 'P0001'; end if;

  update public.docking_connections set status = 'released', released_at = now() where id = v_connection.id;
  v_result := jsonb_build_object(
    'connectionId', v_connection.id,
    'portId', p_port_id,
    'shipId', p_ship_id,
    'status', 'released',
    'releasedAt', now(),
    'idempotent', false
  );
  insert into public.docking_commands(command_id, action, actor_profile_id, ship_id, port_id, result)
  values (p_command_id, 'undock', p_actor_profile_id, p_ship_id, p_port_id, v_result);
  return v_result;
end;
$function$;

create or replace function public.noxia_cancel_docking_reservation(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_ship_id uuid,
  p_port_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing public.docking_commands%rowtype;
  v_reservation public.docking_reservations%rowtype;
  v_result jsonb;
begin
  select * into v_existing from public.docking_commands where command_id = p_command_id;
  if found then
    if v_existing.action <> 'cancel_reservation' or v_existing.actor_profile_id <> p_actor_profile_id
       or v_existing.ship_id <> p_ship_id or v_existing.port_id <> p_port_id then
      raise exception 'NOXIA_DOCKING_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select r.* into v_reservation
    from public.docking_reservations r
    join public.ships s on s.id = r.ship_id
   where r.ship_id = p_ship_id and r.port_id = p_port_id and r.status = 'active'
     and s.profile_id = p_actor_profile_id
   for update of r;
  if not found then raise exception 'NOXIA_DOCKING_RESERVATION_NOT_FOUND' using errcode = 'P0001'; end if;
  update public.docking_reservations set status = 'cancelled', settled_at = now() where id = v_reservation.id;

  v_result := jsonb_build_object('reservationId',v_reservation.id,'portId',p_port_id,'shipId',p_ship_id,'status','cancelled','idempotent',false);
  insert into public.docking_commands(command_id, action, actor_profile_id, ship_id, port_id, result)
  values (p_command_id, 'cancel_reservation', p_actor_profile_id, p_ship_id, p_port_id, v_result);
  return v_result;
end;
$function$;

-- A physical connection can be required by cargo handovers without making
-- docking itself a cargo mutation.
create or replace function public.noxia_transfer_connected_cargo(
  p_command_id uuid,
  p_actor_profile_id uuid,
  p_connection_id uuid,
  p_source_inventory_id uuid,
  p_target_inventory_id uuid,
  p_resource public.resource_type,
  p_amount integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing public.cargo_transfer_commands%rowtype;
  v_connection public.docking_connections%rowtype;
  v_port public.docking_ports%rowtype;
  v_source public.logistics_inventories%rowtype;
  v_target public.logistics_inventories%rowtype;
  v_other public.logistics_inventories%rowtype;
  v_other_slug text;
begin
  -- Replaying a successful transfer must stay idempotent even after undocking.
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

  select * into v_connection from public.docking_connections
   where id = p_connection_id and actor_profile_id = p_actor_profile_id and status = 'docked';
  if not found then raise exception 'NOXIA_CARGO_DOCKING_REQUIRED' using errcode = 'P0001'; end if;
  select * into v_port from public.docking_ports where id = v_connection.port_id;
  if not found or not v_port.cargo_enabled then raise exception 'NOXIA_CARGO_PORT_NOT_ENABLED' using errcode = 'P0001'; end if;

  select * into v_source from public.logistics_inventories where id = p_source_inventory_id and active;
  select * into v_target from public.logistics_inventories where id = p_target_inventory_id and active;
  if v_source.id is null or v_target.id is null then raise exception 'NOXIA_INVENTORY_NOT_FOUND' using errcode = 'P0001'; end if;

  if v_source.storage_kind = 'ship_cargo' and v_source.subject_type = 'ship' and v_source.subject_id = v_connection.ship_id then
    v_other := v_target;
  elsif v_target.storage_kind = 'ship_cargo' and v_target.subject_type = 'ship' and v_target.subject_id = v_connection.ship_id then
    v_other := v_source;
  else
    raise exception 'NOXIA_CARGO_CONNECTION_SHIP_MISMATCH' using errcode = 'P0001';
  end if;

  if v_other.location_id is not null then
    select slug into v_other_slug from public.locations where id = v_other.location_id;
  end if;
  v_other_slug := coalesce(v_other.metadata->>'stationSlug', v_other_slug);
  if public.noxia_canonical_station_slug(v_other_slug) <> public.noxia_canonical_station_slug(v_port.station_slug) then
    raise exception 'NOXIA_CARGO_CONNECTION_LOCATION_MISMATCH' using errcode = 'P0001';
  end if;

  return public.noxia_transfer_cargo(
    p_command_id,
    p_actor_profile_id,
    p_source_inventory_id,
    p_target_inventory_id,
    p_resource,
    p_amount
  );
end;
$function$;

-- Optional decomposition of an existing TransportJob into explicit vehicle legs
-- and explicit cargo handovers. The existing transport_jobs row remains the
-- shipment/lifecycle aggregate and therefore stays compatible with Surface v1.
create table if not exists public.transport_job_legs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.transport_jobs(id) on delete cascade,
  sequence_no integer not null,
  domain text not null,
  source_inventory_id uuid not null references public.logistics_inventories(id),
  destination_inventory_id uuid not null references public.logistics_inventories(id),
  vehicle_inventory_id uuid references public.logistics_inventories(id),
  route_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(job_id, sequence_no),
  constraint transport_job_legs_sequence_check check (sequence_no >= 0),
  constraint transport_job_legs_domain_check check (domain = any(array['surface','surface_to_orbit','orbit','inter_node']::text[])),
  constraint transport_job_legs_status_check check (status = any(array['planned','in_transit','completed','cancelled']::text[]))
);

create table if not exists public.transport_job_handovers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.transport_jobs(id) on delete cascade,
  sequence_no integer not null,
  source_inventory_id uuid not null references public.logistics_inventories(id),
  target_inventory_id uuid not null references public.logistics_inventories(id),
  resource public.resource_type not null,
  amount integer not null,
  requires_docking boolean not null default false,
  docking_connection_id uuid references public.docking_connections(id) on delete set null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(job_id, sequence_no),
  constraint transport_job_handovers_sequence_check check (sequence_no >= 0),
  constraint transport_job_handovers_amount_check check (amount > 0),
  constraint transport_job_handovers_status_check check (status = any(array['planned','completed','cancelled']::text[])),
  constraint transport_job_handovers_docking_check check (not requires_docking or docking_connection_id is not null)
);

alter table public.transport_job_legs enable row level security;
alter table public.transport_job_handovers enable row level security;
revoke all on table public.transport_job_legs from public, anon, authenticated;
revoke all on table public.transport_job_handovers from public, anon, authenticated;
grant select, insert, update, delete on table public.transport_job_legs to service_role;
grant select, insert, update, delete on table public.transport_job_handovers to service_role;

create index if not exists transport_job_legs_job_idx on public.transport_job_legs(job_id, sequence_no);
create index if not exists transport_job_handovers_job_idx on public.transport_job_handovers(job_id, sequence_no);

-- RPC/function execution remains server-only.
revoke all on function public.noxia_cleanup_expired_docking_reservations() from public, anon, authenticated;
revoke all on function public.noxia_reserve_docking_port(uuid,uuid,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.noxia_dock_vessel(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_undock_vessel(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_cancel_docking_reservation(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.noxia_transfer_connected_cargo(uuid,uuid,uuid,uuid,uuid,public.resource_type,integer) from public, anon, authenticated;

grant execute on function public.noxia_cleanup_expired_docking_reservations() to service_role;
grant execute on function public.noxia_reserve_docking_port(uuid,uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.noxia_dock_vessel(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_undock_vessel(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_cancel_docking_reservation(uuid,uuid,uuid,text) to service_role;
grant execute on function public.noxia_transfer_connected_cargo(uuid,uuid,uuid,uuid,uuid,public.resource_type,integer) to service_role;
