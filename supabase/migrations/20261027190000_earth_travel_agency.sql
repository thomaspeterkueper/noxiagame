-- 20261027190000_earth_travel_agency.sql
-- Reisebüro in Sundern (Thomas, 27.10.2026: „Ja bitte Reisebüro, auch für Reisen
-- zu anderen Gegenden der Erde, nicht nur im Weltraum“).
--
-- 1. Gebäudeart „Reisebüro“ (travel_agency). Nicht baubar (is_active = false):
--    Reisebüros entstehen in realen Häusern, nicht als Neubau oder Umbau.
-- 2. Staatliches Reisebüro in Sundern, Hauptstraße 47 (osm:way:191141345),
--    schräg gegenüber dem Startcafé. In den Kartendaten gibt es in Sundern kein
--    Reisebüro; das Haus ist ein Geschäftshaus ohne Namen und ohne Laden.
--    Maße aus lib/worldlab/buildingOffer.ts (buildingFacts): 15 × 11 m, 113 m²,
--    gedreht −24,6°, Lage relativ zu earth-sauerland (51,325 N / 8,005 O).
-- 3. Erdreisen: Tabelle earth_trips, Buchung (Ticket) und Ankunft.
--    Geld nach NOXIA-FIN-0001: Abbuchung beim Spieler, Gutschrift in der
--    Koloniekasse der Erde als Ticketerlös (entry_type 'payout', Notiz beginnt
--    mit „Ticketerloes Linienflug“ – so erkennt sync_employer_economy den Erlös
--    und reicht ihn als Fiskaltransfer an die öffentlichen Dienste weiter,
--    wie beim Linienflug ohne Schiff, 20261009075000).
--    Preis und Dauer rechnet der Server (lib/game/earthTrips.ts), nie der Client.
--    Die Lage der Figur auf der Erde führt der Browser (earthPlayerPositionStore);
--    die Reise hält Ziel und Ankunftszeit fest.

set search_path to public;

insert into public.building_definitions (key, name, tier, category, is_active, production, consumption, description, cost_credits, build_time_ticks, population_bonus, sort_order)
values ('travel_agency', 'Reisebüro', 1, 'services', false, '[]'::jsonb, '[]'::jsonb,
        'Tickets für Bahn und Flug auf der Erde und für Linienflüge ins All.', 0, 0, 0, 75)
on conflict (key) do update set name = excluded.name, description = excluded.description;

do $$
declare
  v_earth uuid;
  v_site uuid;
  v_src constant text := 'osm:way:191141345';
begin
  select id into v_earth from public.locations where slug = 'earth';
  if v_earth is null then return; end if;
  if exists (select 1 from public.tile_entities where source_ref = v_src) then
    raise notice 'Hauptstraße 47 ist bereits belegt – kein Reisebüro angelegt'; return;
  end if;
  -- Gleiche Baustelle (site) wie die anderen staatlichen Bauten der Erde
  select site_id into v_site from public.tile_entities
   where location_id = v_earth and entity_type = 'building' and is_state_owned and site_id is not null
   order by created_at limit 1;
  insert into public.tile_entities (
    location_id, site_id, entity_type, entity_id, status, owner_class, is_state_owned, placement_mode,
    latitude_deg, longitude_deg, x_m, y_m, z_m, rotation_deg, footprint_width_m, footprint_depth_m,
    spatial_region_id, source_ref, source_tags, display_name, staff_capacity, condition, tile_level
  ) values (
    v_earth, v_site, 'building', 'travel_agency', 'active', 'STATE', true, 'world',
    51.325713334, 8.003581036, -98.60, 79.32, 0, -24.6, 15, 11,
    'earth-sauerland', v_src, '{"building":"yes","noxia_source":"OpenStreetMap","noxia_source_id":"osm:way:191141345"}'::jsonb,
    'Reisebüro · Hauptstraße 47', 2, 100, 0
  );
end $$;

create table if not exists public.earth_trips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  from_lat double precision not null,
  from_lon double precision not null,
  destination_slug text not null,
  destination_name text not null,
  to_lat double precision not null,
  to_lon double precision not null,
  mode text not null check (mode in ('rail', 'air')),
  distance_km integer not null,
  price integer not null check (price >= 0),
  departed_at timestamptz not null default now(),
  arrives_at timestamptz not null,
  arrived_at timestamptz
);
create index if not exists earth_trips_open_idx on public.earth_trips (profile_id) where arrived_at is null;
alter table public.earth_trips enable row level security;
comment on table public.earth_trips is 'Reisen auf der Erde (Reisebüro, Bahn/Flug). Offene Reise: arrived_at is null. Preis/Dauer aus lib/game/earthTrips.ts.';

create or replace function public.noxia_book_earth_trip(
  p_profile_id uuid,
  p_from_lat double precision, p_from_lon double precision,
  p_destination_slug text, p_destination_name text,
  p_to_lat double precision, p_to_lon double precision,
  p_mode text, p_distance_km integer, p_price integer, p_duration_seconds integer
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_credits integer;
  v_open record;
  v_earth uuid;
  v_tick bigint;
  v_trip public.earth_trips;
begin
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  select * into v_open from public.earth_trips where profile_id = p_profile_id and arrived_at is null limit 1;
  if found then raise exception 'NOXIA_TRIP_ALREADY_ACTIVE'; end if;
  if exists (select 1 from public.profiles where id = p_profile_id and transit_destination is not null) then raise exception 'NOXIA_TRIP_ALREADY_ACTIVE'; end if;
  if p_price < 0 or p_duration_seconds < 1 then raise exception 'NOXIA_TRIP_INVALID'; end if;
  if v_credits < p_price then raise exception 'NOXIA_TRIP_TICKET_INSUFFICIENT:%:%', p_price, v_credits; end if;

  update public.profiles set credits = credits - p_price where id = p_profile_id;
  select id into v_earth from public.locations where slug = 'earth';
  select coalesce(max(tick_number), 0) into v_tick from public.tick_log;
  if p_price > 0 and v_earth is not null then
    insert into public.colony_ledger(location_id, tick, entry_type, profile_id, resource_type, amount, note)
    values (v_earth, v_tick, 'payout', p_profile_id, null, p_price,
            format('Ticketerloes Linienflug (Erdreise, %s) nach %s', case when p_mode = 'rail' then 'Bahn' else 'Flug' end, p_destination_name));
  end if;

  insert into public.earth_trips (profile_id, from_lat, from_lon, destination_slug, destination_name, to_lat, to_lon, mode, distance_km, price, arrives_at)
  values (p_profile_id, p_from_lat, p_from_lon, p_destination_slug, p_destination_name, p_to_lat, p_to_lon, p_mode, p_distance_km, p_price, now() + make_interval(secs => p_duration_seconds))
  returning * into v_trip;

  return jsonb_build_object('ok', true, 'trip', to_jsonb(v_trip), 'credits', v_credits - p_price);
end $$;

create or replace function public.noxia_arrive_earth_trip(p_profile_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_trip public.earth_trips;
begin
  select * into v_trip from public.earth_trips where profile_id = p_profile_id and arrived_at is null order by departed_at desc limit 1 for update;
  if not found then return jsonb_build_object('ok', true, 'trip', null); end if;
  if v_trip.arrives_at > now() then
    return jsonb_build_object('ok', true, 'arrived', false, 'remaining_seconds', ceil(extract(epoch from (v_trip.arrives_at - now())))::integer, 'trip', to_jsonb(v_trip));
  end if;
  update public.earth_trips set arrived_at = now() where id = v_trip.id returning * into v_trip;
  return jsonb_build_object('ok', true, 'arrived', true, 'trip', to_jsonb(v_trip));
end $$;

revoke all on function public.noxia_book_earth_trip(uuid, double precision, double precision, text, text, double precision, double precision, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.noxia_arrive_earth_trip(uuid) from public, anon, authenticated;
