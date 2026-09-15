-- NOXIA Arrival Control / Holding Core v1
-- 2026-09-15
--
-- Extends the existing transit + docking Core without widening the legacy
-- public.ship_status enum. ships.status remains the movement state
-- (docked|transit); physical station arrival/docking is projected separately.

set search_path to public;

create table if not exists public.ship_arrival_states (
  ship_id uuid primary key references public.ships(id) on delete cascade,
  station_slug text not null,
  phase text not null check (phase in ('arrival-rendezvous','holding','approach','docked','departing')),
  holding_zone_id text,
  holding_reason text,
  queue_entered_at timestamptz,
  target_port_id text references public.docking_ports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ship_arrival_states_queue_idx
  on public.ship_arrival_states(station_slug, holding_zone_id, queue_entered_at, ship_id)
  where phase = 'holding';

alter table public.ship_arrival_states enable row level security;
revoke all on table public.ship_arrival_states from public, anon, authenticated;
grant select, insert, update, delete on table public.ship_arrival_states to service_role;

comment on table public.ship_arrival_states is
  'Server-authoritative station-arrival state between intersolar transit completion and physical docking. Separate from legacy ships.status movement state.';

create or replace function public.noxia_canonical_station_slug(p_slug text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_slug, '')) when 'kepler' then 'prometheus' else lower(coalesce(p_slug, '')) end
$$;

create or replace function public.noxia_arrival_holding_zone(
  p_station_slug text,
  p_ship_type_id text
) returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_station text := public.noxia_canonical_station_slug(p_station_slug);
  v_class text := public.noxia_ship_docking_class(p_ship_type_id);
begin
  if v_station = 'phobos' then
    return case v_class
      when 'intersolar-heavy' then 'phobos-h-heavy'
      when 'intersolar-standard' then 'phobos-h-standard'
      else 'phobos-h-light'
    end;
  end if;

  if v_station = 'prometheus' then
    return case v_class
      when 'intersolar-heavy' then 'kepler-h-heavy'
      when 'intersolar-standard' then 'kepler-h-standard'
      else 'kepler-h-light'
    end;
  end if;

  return v_station || '-holding';
end;
$$;

-- Synchronize movement-state completion with station Arrival Control.
-- The existing transit RPC still moves the ship to the destination and sets
-- the legacy movement status to docked. This trigger prevents that legacy word
-- from being interpreted as physical docking at a station: a station arrival
-- gets an explicit persistent holding state until a docking connection exists.
create or replace function public.noxia_sync_ship_arrival_from_movement()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_station text;
begin
  if new.status = 'transit'::public.ship_status then
    delete from public.ship_arrival_states where ship_id = new.id;
    return new;
  end if;

  if old.status = 'transit'::public.ship_status
     and new.status = 'docked'::public.ship_status then
    v_station := public.noxia_canonical_station_slug(new.location);

    if exists (select 1 from public.docking_ports p where p.station_slug = v_station) then
      insert into public.ship_arrival_states(
        ship_id, station_slug, phase, holding_zone_id, holding_reason,
        queue_entered_at, target_port_id, created_at, updated_at
      ) values (
        new.id,
        v_station,
        'holding',
        public.noxia_arrival_holding_zone(v_station, new.ship_type_id),
        'awaiting-port-clearance',
        clock_timestamp(),
        null,
        clock_timestamp(),
        clock_timestamp()
      )
      on conflict (ship_id) do update set
        station_slug = excluded.station_slug,
        phase = 'holding',
        holding_zone_id = excluded.holding_zone_id,
        holding_reason = excluded.holding_reason,
        queue_entered_at = coalesce(public.ship_arrival_states.queue_entered_at, excluded.queue_entered_at),
        target_port_id = null,
        updated_at = excluded.updated_at;
    else
      delete from public.ship_arrival_states where ship_id = new.id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_noxia_sync_ship_arrival_from_movement on public.ships;
create trigger trg_noxia_sync_ship_arrival_from_movement
after update of status, location on public.ships
for each row execute function public.noxia_sync_ship_arrival_from_movement();

-- A successful persistent port reservation is the clearance to approach.
create or replace function public.noxia_sync_arrival_from_reservation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_station text;
  v_has_connection boolean;
begin
  select station_slug into v_station
  from public.docking_ports
  where id = new.port_id;

  if new.status = 'active' then
    update public.ship_arrival_states
    set phase = 'approach',
        target_port_id = new.port_id,
        holding_reason = null,
        updated_at = clock_timestamp()
    where ship_id = new.ship_id
      and station_slug = v_station;
  elsif tg_op = 'UPDATE' and old.status = 'active' and new.status <> 'active' then
    select exists (
      select 1 from public.docking_connections c
      where c.ship_id = new.ship_id and c.status = 'docked'
    ) into v_has_connection;

    if not v_has_connection then
      update public.ship_arrival_states
      set phase = 'holding',
          target_port_id = null,
          holding_reason = 'awaiting-port-clearance',
          queue_entered_at = coalesce(queue_entered_at, clock_timestamp()),
          updated_at = clock_timestamp()
      where ship_id = new.ship_id
        and station_slug = v_station;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_noxia_sync_arrival_from_reservation on public.docking_reservations;
create trigger trg_noxia_sync_arrival_from_reservation
after insert or update of status on public.docking_reservations
for each row execute function public.noxia_sync_arrival_from_reservation();

-- Physical docking is defined by docking_connections, never by ships.status.
create or replace function public.noxia_sync_arrival_from_connection()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_station text;
begin
  select station_slug into v_station
  from public.docking_ports
  where id = new.port_id;

  if new.status = 'docked' then
    insert into public.ship_arrival_states(
      ship_id, station_slug, phase, holding_zone_id, holding_reason,
      queue_entered_at, target_port_id, created_at, updated_at
    )
    select
      s.id,
      v_station,
      'docked',
      public.noxia_arrival_holding_zone(v_station, s.ship_type_id),
      null,
      null,
      new.port_id,
      clock_timestamp(),
      clock_timestamp()
    from public.ships s
    where s.id = new.ship_id
    on conflict (ship_id) do update set
      station_slug = excluded.station_slug,
      phase = 'docked',
      holding_reason = null,
      queue_entered_at = null,
      target_port_id = excluded.target_port_id,
      updated_at = excluded.updated_at;
  elsif tg_op = 'UPDATE' and old.status = 'docked' and new.status = 'released' then
    update public.ship_arrival_states
    set phase = 'departing',
        holding_reason = null,
        queue_entered_at = null,
        target_port_id = null,
        updated_at = clock_timestamp()
    where ship_id = new.ship_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_noxia_sync_arrival_from_connection on public.docking_connections;
create trigger trg_noxia_sync_arrival_from_connection
after insert or update of status on public.docking_connections
for each row execute function public.noxia_sync_arrival_from_connection();

-- Backfill station-local ships so existing Phobos/Kepler sessions immediately
-- receive an honest physical-arrival projection. Existing live docking
-- connections win over holding.
insert into public.ship_arrival_states(
  ship_id, station_slug, phase, holding_zone_id, holding_reason,
  queue_entered_at, target_port_id, created_at, updated_at
)
select
  s.id,
  public.noxia_canonical_station_slug(s.location),
  case when c.id is not null then 'docked' else 'holding' end,
  public.noxia_arrival_holding_zone(public.noxia_canonical_station_slug(s.location), s.ship_type_id),
  case when c.id is not null then null else 'awaiting-port-clearance' end,
  case when c.id is not null then null else clock_timestamp() end,
  c.port_id,
  clock_timestamp(),
  clock_timestamp()
from public.ships s
join public.docking_ports p
  on p.station_slug = public.noxia_canonical_station_slug(s.location)
left join public.docking_connections c
  on c.ship_id = s.id and c.status = 'docked'
where s.status <> 'transit'::public.ship_status
  and coalesce(s.is_active, false) = true
on conflict (ship_id) do nothing;

create or replace function public.noxia_get_ship_arrival_state(p_ship_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_state public.ship_arrival_states%rowtype;
  v_queue_position integer;
begin
  select * into v_state
  from public.ship_arrival_states
  where ship_id = p_ship_id;

  if not found then return null; end if;

  if v_state.phase = 'holding' then
    select count(*)::integer + 1 into v_queue_position
    from public.ship_arrival_states q
    where q.phase = 'holding'
      and q.station_slug = v_state.station_slug
      and q.holding_zone_id is not distinct from v_state.holding_zone_id
      and (
        q.queue_entered_at < v_state.queue_entered_at
        or (q.queue_entered_at = v_state.queue_entered_at and q.ship_id < v_state.ship_id)
      );
  else
    v_queue_position := null;
  end if;

  return jsonb_build_object(
    'shipId', v_state.ship_id,
    'stationSlug', v_state.station_slug,
    'phase', v_state.phase,
    'holdingZoneId', v_state.holding_zone_id,
    'holdingReason', v_state.holding_reason,
    'queuePosition', v_queue_position,
    'targetPortId', v_state.target_port_id,
    'updatedAt', v_state.updated_at
  );
end;
$$;

revoke all on function public.noxia_canonical_station_slug(text) from public, anon, authenticated;
revoke all on function public.noxia_arrival_holding_zone(text,text) from public, anon, authenticated;
revoke all on function public.noxia_get_ship_arrival_state(uuid) from public, anon, authenticated;
grant execute on function public.noxia_canonical_station_slug(text) to service_role;
grant execute on function public.noxia_arrival_holding_zone(text,text) to service_role;
grant execute on function public.noxia_get_ship_arrival_state(uuid) to service_role;

comment on function public.noxia_get_ship_arrival_state(uuid) is
  'Returns authoritative station arrival/holding/approach/docked projection with stable queue position. Physical docked state derives from docking_connections.';
