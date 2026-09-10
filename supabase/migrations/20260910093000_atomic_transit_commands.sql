-- NOXIA atomic transit commands v1
-- 2026-09-10
--
-- Phase C of the shared Game Core transaction boundary.
-- Transit uses the existing ships.status/dest_location/arrives_at state machine,
-- adds an explicit departure timestamp, and keeps destination-pad reservation
-- separate from actual docking occupancy.

set search_path to public;

alter table public.ships
  add column if not exists transit_started_at timestamptz;

create index if not exists idx_ships_due_transit
  on public.ships(arrives_at)
  where status = 'transit'::public.ship_status;

comment on column public.ships.transit_started_at is
  'Authoritative departure time of the current transit. NULL while docked.';

-- A destination pad must be held while a ship is in flight, but
-- ship_docking_assignments intentionally means actual pad occupancy. Keeping
-- reservation separate prevents a ship from appearing docked at its target
-- while ships.location still points at its departure location.
create table if not exists public.ship_transit_pad_reservations (
  ship_id uuid primary key references public.ships(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  pad_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  reserved_at timestamptz not null default now(),
  arrives_at timestamptz not null,
  unique (pad_entity_id)
);

create index if not exists ship_transit_pad_reservations_location_idx
  on public.ship_transit_pad_reservations(location_id);
create index if not exists ship_transit_pad_reservations_due_idx
  on public.ship_transit_pad_reservations(arrives_at);

alter table public.ship_transit_pad_reservations enable row level security;
revoke all on table public.ship_transit_pad_reservations from anon, authenticated;

comment on table public.ship_transit_pad_reservations is
  'Server-only runtime reservation of a concrete destination pad for a ship in transit; distinct from actual docking occupancy.';

-- Extend the existing deactivation invariant: an inactive ship must hold neither
-- an occupied pad nor an in-flight reservation.
create or replace function public.release_ship_docking_assignment_on_deactivate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active is distinct from old.is_active and not new.is_active then
    delete from public.ship_docking_assignments where ship_id = old.id;
    delete from public.ship_transit_pad_reservations where ship_id = old.id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Start transit
-- ---------------------------------------------------------------------------
create or replace function public.noxia_start_transit(
  p_profile_id uuid,
  p_destination_slug text,
  p_duration_seconds integer,
  p_energy_needed integer,
  p_docking_idle_hours integer default 24
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ship public.ships%rowtype;
  v_profile public.profiles%rowtype;
  v_destination public.locations%rowtype;
  v_energy integer := 0;
  v_energy_left integer := 0;
  v_landing_fee integer := 0;
  v_tick bigint := 0;
  v_departed_at timestamptz := clock_timestamp();
  v_arrives_at timestamptz;
  v_managed boolean := false;
  v_pad_id uuid;
  v_existing_pad uuid;
begin
  if p_profile_id is null or nullif(trim(p_destination_slug), '') is null then
    raise exception 'NOXIA_TRANSIT_REQUIRED_ARGUMENT_MISSING' using errcode = 'P0001';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 1 or p_duration_seconds > 86400 then
    raise exception 'NOXIA_TRANSIT_DURATION_INVALID:%', coalesce(p_duration_seconds, -1) using errcode = 'P0001';
  end if;
  if p_energy_needed is null or p_energy_needed < 0 then
    raise exception 'NOXIA_TRANSIT_ENERGY_INVALID:%', coalesce(p_energy_needed, -1) using errcode = 'P0001';
  end if;
  if p_docking_idle_hours is null or p_docking_idle_hours < 1 then
    raise exception 'NOXIA_TRANSIT_DOCKING_EXPIRY_INVALID' using errcode = 'P0001';
  end if;

  -- Same active-ship resolution as the current read/trade paths. Locking the
  -- ship makes repeated departure requests and ship-state races deterministic.
  select * into v_ship
  from public.ships
  where profile_id = p_profile_id and coalesce(is_active, false) = true
  order by created_at, id
  limit 1
  for update;

  if not found then
    select * into v_ship
    from public.ships
    where profile_id = p_profile_id
    order by created_at, id
    limit 1
    for update;
  end if;

  if not found then
    raise exception 'NOXIA_SHIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Network retries must never charge energy/fees twice.
  if v_ship.status = 'transit'::public.ship_status then
    if v_ship.dest_location is not distinct from p_destination_slug then
      select pad_entity_id into v_existing_pad
      from public.ship_transit_pad_reservations
      where ship_id = v_ship.id;

      select coalesce(amount, 0)::integer into v_energy
      from public.ship_cargo
      where ship_id = v_ship.id and resource = 'energy'::public.resource_type;
      if not found then v_energy := 0; end if;

      return jsonb_build_object(
        'ship_id', v_ship.id,
        'status', 'transit',
        'from_location', v_ship.location,
        'destination', v_ship.dest_location,
        'departed_at', v_ship.transit_started_at,
        'arrives_at', v_ship.arrives_at,
        'duration_seconds', greatest(1, ceil(extract(epoch from (v_ship.arrives_at - v_ship.transit_started_at)))::integer),
        'remaining_seconds', greatest(0, ceil(extract(epoch from (v_ship.arrives_at - clock_timestamp())))::integer),
        'energy_used', 0,
        'energy_left', v_energy,
        'landing_fee', 0,
        'docking_managed', v_existing_pad is not null,
        'docking_pad_entity_id', v_existing_pad,
        'idempotent', true
      );
    end if;
    raise exception 'NOXIA_TRANSIT_ALREADY_ACTIVE:%', coalesce(v_ship.dest_location, '<unknown>') using errcode = 'P0001';
  end if;

  if v_ship.location = p_destination_slug then
    raise exception 'NOXIA_TRANSIT_SAME_LOCATION:%', p_destination_slug using errcode = 'P0001';
  end if;

  select * into v_destination
  from public.locations
  where slug = p_destination_slug;
  if not found then
    raise exception 'NOXIA_LOCATION_NOT_FOUND:%', p_destination_slug using errcode = 'P0001';
  end if;

  -- Cargo row is locked before the wallet, matching the existing spot-trade
  -- lock order (ship -> cargo -> profile).
  select amount into v_energy
  from public.ship_cargo
  where ship_id = v_ship.id and resource = 'energy'::public.resource_type
  for update;
  if not found then v_energy := 0; end if;

  if v_energy < p_energy_needed then
    raise exception 'NOXIA_TRANSIT_ENERGY_INSUFFICIENT:%:%', p_energy_needed, v_energy using errcode = 'P0001';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id
  for update;
  if not found then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select greatest(0, round(coalesce(tax_landing, 0)))::integer
  into v_landing_fee
  from public.colony_settings
  where location_id = v_destination.id;
  if not found then v_landing_fee := 0; end if;

  if v_profile.credits < v_landing_fee then
    raise exception 'NOXIA_TRANSIT_LANDING_FEE_INSUFFICIENT:%:%', v_landing_fee, v_profile.credits using errcode = 'P0001';
  end if;

  select coalesce(max(tick_number), 0)::bigint into v_tick
  from public.tick_log;

  v_arrives_at := v_departed_at + make_interval(secs => p_duration_seconds);

  -- Preserve the legacy abandoned-pad expiry rule. Transit reservations get
  -- the same long-stop cleanup only as a defensive recovery path.
  delete from public.ship_docking_assignments
  where location_id = v_destination.id
    and updated_at < clock_timestamp() - make_interval(hours => p_docking_idle_hours);

  delete from public.ship_transit_pad_reservations
  where location_id = v_destination.id
    and arrives_at < clock_timestamp() - make_interval(hours => p_docking_idle_hours);

  delete from public.ship_transit_pad_reservations r
  using public.ships s
  where r.ship_id = s.id
    and s.status <> 'transit'::public.ship_status;

  select exists (
    select 1
    from public.tile_entities te
    where te.location_id = v_destination.id
      and te.entity_type = 'building'
      and te.status = 'active'
      and (te.condition is null or te.condition > 0)
      and (
        te.entity_id in ('landing_pad', 'spaceport_pad_mini', 'spaceport_pad_standard')
        or (te.entity_id = 'landing_pad_extra_pad' and te.parent_id is not null)
      )
  ) into v_managed;

  if v_managed then
    -- Lock the concrete pad row so concurrent starts cannot both select it.
    select te.id into v_pad_id
    from public.tile_entities te
    where te.location_id = v_destination.id
      and te.entity_type = 'building'
      and te.status = 'active'
      and (te.condition is null or te.condition > 0)
      and (
        te.entity_id in ('landing_pad', 'spaceport_pad_mini', 'spaceport_pad_standard')
        or (te.entity_id = 'landing_pad_extra_pad' and te.parent_id is not null)
      )
      and (te.profile_id is null or te.profile_id = p_profile_id)
      and not exists (
        select 1 from public.ship_docking_assignments da
        where da.pad_entity_id = te.id and da.ship_id <> v_ship.id
      )
      and not exists (
        select 1 from public.ship_transit_pad_reservations tr
        where tr.pad_entity_id = te.id and tr.ship_id <> v_ship.id
      )
    order by te.id
    limit 1
    for update of te skip locked;

    if v_pad_id is null then
      raise exception 'NOXIA_TRANSIT_NO_LANDING_CAPACITY:%', p_destination_slug using errcode = 'P0001';
    end if;
  end if;

  -- Departure releases actual origin occupancy immediately. The destination
  -- pad, if managed, becomes a reservation until arrival completion.
  delete from public.ship_docking_assignments where ship_id = v_ship.id;
  delete from public.ship_transit_pad_reservations where ship_id = v_ship.id;

  if v_managed then
    insert into public.ship_transit_pad_reservations(
      ship_id, location_id, pad_entity_id, reserved_at, arrives_at
    ) values (
      v_ship.id, v_destination.id, v_pad_id, v_departed_at, v_arrives_at
    );
  end if;

  if v_landing_fee > 0 then
    update public.profiles
    set credits = credits - v_landing_fee
    where id = p_profile_id;

    insert into public.colony_ledger(
      location_id, tick, entry_type, profile_id, resource_type, amount, note
    ) values (
      v_destination.id,
      v_tick,
      'landing_fee',
      p_profile_id,
      null,
      v_landing_fee,
      format('Landegebühr %s', p_destination_slug)
    );
  end if;

  v_energy_left := v_energy - p_energy_needed;
  if v_energy_left > 0 then
    update public.ship_cargo
    set amount = v_energy_left
    where ship_id = v_ship.id and resource = 'energy'::public.resource_type;
  else
    delete from public.ship_cargo
    where ship_id = v_ship.id and resource = 'energy'::public.resource_type;
  end if;

  update public.ships
  set status = 'transit'::public.ship_status,
      dest_location = p_destination_slug,
      transit_started_at = v_departed_at,
      arrives_at = v_arrives_at
  where id = v_ship.id;

  insert into public.simulation_events(
    event_type, subject_type, subject_id, actor_id, location_id, tick, effects, metadata, occurred_at
  ) values (
    'transit.departed',
    'ship',
    v_ship.id,
    p_profile_id,
    null,
    v_tick,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'ship_transit',
        'from', v_ship.location,
        'to', p_destination_slug,
        'status', 'transit',
        'arrives_at', v_arrives_at
      ),
      jsonb_build_object('type', 'cargo_delta', 'resource', 'energy', 'amount', -p_energy_needed),
      jsonb_build_object('type', 'credits_delta', 'amount', -v_landing_fee)
    ),
    jsonb_build_object(
      'source', 'noxia_start_transit',
      'duration_seconds', p_duration_seconds,
      'docking_managed', v_managed,
      'docking_pad_entity_id', v_pad_id
    ),
    v_departed_at
  );

  return jsonb_build_object(
    'ship_id', v_ship.id,
    'status', 'transit',
    'from_location', v_ship.location,
    'destination', p_destination_slug,
    'departed_at', v_departed_at,
    'arrives_at', v_arrives_at,
    'duration_seconds', p_duration_seconds,
    'remaining_seconds', p_duration_seconds,
    'energy_used', p_energy_needed,
    'energy_left', v_energy_left,
    'landing_fee', v_landing_fee,
    'credits', v_profile.credits - v_landing_fee,
    'docking_managed', v_managed,
    'docking_pad_entity_id', v_pad_id,
    'idempotent', false
  );
end;
$$;

revoke all on function public.noxia_start_transit(uuid,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.noxia_start_transit(uuid,text,integer,integer,integer) to service_role;

comment on function public.noxia_start_transit(uuid,text,integer,integer,integer) is
  'Atomically starts server-authoritative transit: reserves destination capacity, charges landing fee/energy, and enters ships.status=transit without teleporting location.';

-- ---------------------------------------------------------------------------
-- Complete transit
-- ---------------------------------------------------------------------------
create or replace function public.noxia_complete_transit(
  p_ship_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ship public.ships%rowtype;
  v_destination public.locations%rowtype;
  v_reservation public.ship_transit_pad_reservations%rowtype;
  v_tick bigint := 0;
  v_flight_count integer := 0;
  v_pad_id uuid;
  v_pad_valid boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  if p_ship_id is null then
    raise exception 'NOXIA_TRANSIT_SHIP_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_ship
  from public.ships
  where id = p_ship_id
  for update;
  if not found then
    raise exception 'NOXIA_SHIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_ship.status <> 'transit'::public.ship_status then
    return jsonb_build_object(
      'ship_id', v_ship.id,
      'completed', true,
      'idempotent', true,
      'status', 'docked',
      'location', v_ship.location,
      'destination', null,
      'remaining_seconds', 0
    );
  end if;

  if v_ship.arrives_at is null or v_ship.dest_location is null then
    raise exception 'NOXIA_TRANSIT_STATE_INVALID:%', v_ship.id using errcode = 'P0001';
  end if;

  if v_ship.arrives_at > v_now then
    return jsonb_build_object(
      'ship_id', v_ship.id,
      'completed', false,
      'idempotent', false,
      'status', 'transit',
      'location', v_ship.location,
      'destination', v_ship.dest_location,
      'departed_at', v_ship.transit_started_at,
      'arrives_at', v_ship.arrives_at,
      'remaining_seconds', greatest(1, ceil(extract(epoch from (v_ship.arrives_at - v_now)))::integer)
    );
  end if;

  select * into v_destination
  from public.locations
  where slug = v_ship.dest_location;
  if not found then
    raise exception 'NOXIA_LOCATION_NOT_FOUND:%', v_ship.dest_location using errcode = 'P0001';
  end if;

  select * into v_reservation
  from public.ship_transit_pad_reservations
  where ship_id = v_ship.id
  for update;

  if found then
    select exists (
      select 1
      from public.tile_entities te
      where te.id = v_reservation.pad_entity_id
        and te.location_id = v_destination.id
        and te.entity_type = 'building'
        and te.status = 'active'
        and (te.condition is null or te.condition > 0)
        and (
          te.entity_id in ('landing_pad', 'spaceport_pad_mini', 'spaceport_pad_standard')
          or (te.entity_id = 'landing_pad_extra_pad' and te.parent_id is not null)
        )
        and (te.profile_id is null or te.profile_id = v_ship.profile_id)
    ) into v_pad_valid;

    if v_pad_valid then
      begin
        delete from public.ship_docking_assignments where ship_id = v_ship.id;
        insert into public.ship_docking_assignments(
          ship_id, location_id, pad_entity_id, assigned_at, updated_at
        ) values (
          v_ship.id, v_destination.id, v_reservation.pad_entity_id, v_now, v_now
        );
        v_pad_id := v_reservation.pad_entity_id;
      exception when unique_violation then
        -- A legacy/non-Core writer may have occupied the reserved pad. Arrival
        -- must not remain stuck forever; finish undocked and surface it in the
        -- event metadata instead.
        v_pad_id := null;
      end;
    end if;
  end if;

  delete from public.ship_transit_pad_reservations where ship_id = v_ship.id;

  update public.ships
  set location = v_ship.dest_location,
      status = 'docked'::public.ship_status,
      dest_location = null,
      arrives_at = null,
      transit_started_at = null
  where id = v_ship.id;

  update public.profiles
  set flight_count = coalesce(flight_count, 0) + 1
  where id = v_ship.profile_id
  returning flight_count into v_flight_count;

  select coalesce(max(tick_number), 0)::bigint into v_tick
  from public.tick_log;

  insert into public.simulation_events(
    event_type, subject_type, subject_id, actor_id, location_id, tick, effects, metadata, occurred_at
  ) values (
    'transit.arrived',
    'ship',
    v_ship.id,
    v_ship.profile_id,
    v_destination.id,
    v_tick,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'ship_transit',
        'from', v_ship.location,
        'to', v_destination.slug,
        'status', 'docked'
      )
    ),
    jsonb_build_object(
      'source', 'noxia_complete_transit',
      'docking_pad_entity_id', v_pad_id,
      'reserved_pad_valid', v_pad_valid
    ),
    v_now
  );

  return jsonb_build_object(
    'ship_id', v_ship.id,
    'completed', true,
    'idempotent', false,
    'status', 'docked',
    'location', v_destination.slug,
    'destination', null,
    'remaining_seconds', 0,
    'flight_count', v_flight_count,
    'docking_pad_entity_id', v_pad_id
  );
end;
$$;

revoke all on function public.noxia_complete_transit(uuid) from public, anon, authenticated;
grant execute on function public.noxia_complete_transit(uuid) to service_role;

comment on function public.noxia_complete_transit(uuid) is
  'Idempotently completes a due transit, materializes destination docking, moves the ship, increments flight_count exactly once, and emits transit.arrived.';
