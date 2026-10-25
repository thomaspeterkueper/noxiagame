-- supabase/migrations/20261025130000_earth_parcels.sql
-- Flurstücke als Grundlage für Eigentum und Bauen (Thomas, 25.10.2026: „wäre ja blöd,
-- wenn ich im Garten eines anderen etwas bauen könnte“).
--   * earth_parcels: Flurstücke aus ALKIS NRW (WFS NW ALKIS Vereinfacht, dl-de/zero-2.0),
--     geholt zellenweise über /api/world-lab/parcels; earth_parcel_cells merkt, was geholt ist.
--   * earth_parcel_owners: wem ein Flurstück gehört (Spieler); ohne Eintrag der Gemeinde.
--   * acquire_earth_building: Übernahme eines Hauses ohne Geld (aus buy_earth_building herausgelöst).
--   * buy_earth_parcel: Flurstück samt Häusern darauf kaufen – ein Transfer an die Gemeinde.

set search_path to public;

create table if not exists public.earth_parcels (
  id          text primary key,
  source      text not null default 'alkis_nw',
  ring        jsonb not null,
  centre_lat  double precision not null,
  centre_lon  double precision not null,
  min_lat     double precision not null,
  max_lat     double precision not null,
  min_lon     double precision not null,
  max_lon     double precision not null,
  area_m2     integer,
  label       text,
  usage       text,
  props       jsonb not null default '{}'::jsonb,
  fetched_at  timestamptz not null default now()
);
create index if not exists earth_parcels_lat on public.earth_parcels(min_lat, max_lat);
create index if not exists earth_parcels_centre on public.earth_parcels(centre_lat, centre_lon);

create table if not exists public.earth_parcel_cells (
  cell       text primary key,
  source     text not null default 'alkis_nw',
  fetched_at timestamptz not null default now(),
  parcels    integer not null default 0,
  error      text
);

create table if not exists public.earth_parcel_owners (
  parcel_id  text primary key references public.earth_parcels(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  price      integer not null,
  bought_at  timestamptz not null default now()
);

alter table public.earth_parcels enable row level security;
alter table public.earth_parcel_cells enable row level security;
alter table public.earth_parcel_owners enable row level security;
drop policy if exists earth_parcels_read on public.earth_parcels;
create policy earth_parcels_read on public.earth_parcels for select using (true);
drop policy if exists earth_parcel_owners_read on public.earth_parcel_owners;
create policy earth_parcel_owners_read on public.earth_parcel_owners for select using (true);
grant select on public.earth_parcels, public.earth_parcel_owners to anon, authenticated;
grant all on public.earth_parcels, public.earth_parcel_cells, public.earth_parcel_owners to service_role;

-- Übernahme eines Hauses (Eintrag, Bewohner, Mietverträge) – ohne Geld.
create or replace function public.acquire_earth_building(
  p_profile_id uuid,
  p_source_ref text,
  p_latitude double precision,
  p_longitude double precision,
  p_width double precision,
  p_depth double precision,
  p_rotation double precision,
  p_display_name text,
  p_region_slug text,
  p_x_m double precision,
  p_y_m double precision,
  p_residential_capacity integer,
  p_feature_ids uuid[],
  p_new_residents integer default 0,
  p_rent_per_resident integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_location_id uuid;
  v_public_actor uuid;
  v_tick bigint;
  v_entity_id uuid;
  v_landlord uuid;
  v_moved integer := 0;
  v_feature uuid := case when p_feature_ids is not null and array_length(p_feature_ids, 1) > 0 then p_feature_ids[1] else null end;
  v_first text[] := array['Anna','Lukas','Marie','Jonas','Sophie','Felix','Lea','Paul','Hannah','Ben','Clara','Elias','Greta','Moritz','Ida','Jakob','Emilia','Noah','Lina','Theo','Mila','Karl','Frieda','Anton','Ella','Oskar','Luise','Henri','Rosa','Mats'];
  v_last text[] := array['Schulte','Becker','Hoffmann','Wiese','Kemper','Rinsche','Vogt','Lange','Hennecke','Brüggemann','Schmidt','Klein','Wolf','Kaiser','Schröder','Bremer','Lohmann','Hesse','Busch','Peters'];
  v_count integer := least(8, greatest(0, coalesce(p_new_residents, 0)));
  v_person uuid;
  v_actor uuid;
  v_assignment uuid;
  v_name text;
  v_hash text;
  i integer;
begin
  if p_source_ref is null or p_source_ref !~ '^osm:(way|relation):[0-9]+$' then raise exception 'NOXIA_SOURCE_INVALID'; end if;

  if exists (select 1 from public.tile_entities where source_ref = p_source_ref) then raise exception 'NOXIA_BUILDING_OWNED'; end if;
  if exists (select 1 from public.earth_cleared_buildings where source_ref = p_source_ref) then raise exception 'NOXIA_BUILDING_CLEARED'; end if;

  select id into v_location_id from public.locations where slug = 'earth';
  select actor_id into v_landlord from public.profile_economic_actors where profile_id = p_profile_id;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;


  insert into public.tile_entities(
    profile_id, location_id, entity_type, entity_id, owner_class, owner_id, status,
    placement_mode, x_m, y_m, latitude_deg, longitude_deg, spatial_region_id,
    rotation_deg, footprint_width_m, footprint_depth_m, residential_capacity,
    source_ref, display_name
  ) values (
    p_profile_id, v_location_id, 'building', 'acquired_building', 'PLAYER', p_profile_id, 'active',
    'world', p_x_m, p_y_m, p_latitude, p_longitude, p_region_slug,
    coalesce(p_rotation, 0), p_width, p_depth, greatest(0, coalesce(p_residential_capacity, 0)),
    p_source_ref, left(p_display_name, 120)
  ) returning id into v_entity_id;

  -- Wer schon dort wohnt (Zuweisung an den Grundriss), bleibt; Vermieter ist jetzt der Käufer.
  if p_feature_ids is not null and array_length(p_feature_ids, 1) > 0 then
    update public.person_assignments
       set tile_entity_id = v_entity_id, updated_at = now()
     where is_active and assignment_type = 'home' and region_feature_id = any(p_feature_ids);
    get diagnostics v_moved = row_count;
    update public.person_tenancies t
       set tile_entity_id = v_entity_id, landlord_actor_id = coalesce(v_landlord, t.landlord_actor_id), updated_at = now()
      from public.person_assignments a
     where a.tile_entity_id = v_entity_id and a.is_active and a.assignment_type = 'home'
       and t.person_id = a.person_id and t.status in ('active', 'provided');
  end if;

  -- Bewohner des echten Hauses werden zu Personen des Spiels (nur wenn noch niemand zugewiesen war).
  if v_moved = 0 and v_count > 0 then
    for i in 1..v_count loop
      v_hash := md5(p_source_ref || ':' || i::text);
      v_name := v_first[1 + (('x' || substr(v_hash, 1, 6))::bit(24)::int % array_length(v_first, 1))]
             || ' ' || v_last[1 + (('x' || substr(v_hash, 7, 6))::bit(24)::int % array_length(v_last, 1))];
      insert into public.people(display_name, birth_year, current_location_id, simulation_tier, activity_state, last_action,
                                last_decision_factors, last_tick, person_key, bio_short, traits, observable_description)
      values (v_name, 2024 + (('x' || substr(v_hash, 13, 4))::bit(16)::int % 44), v_location_id, 'background', 'idle', 'lives_here',
              jsonb_build_object('materialized_from', p_source_ref), v_tick,
              'earth-house:' || p_source_ref || ':' || i::text,
              left('Wohnt in ' || coalesce(p_display_name, 'einem Haus') || '.', 200),
              jsonb_build_object('origin', 'real_house_resident'),
              'Eine Person aus der Nachbarschaft')
      returning id into v_person;

      insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
      values ('npc_person', v_name, 'Persönlicher Wirtschaftsakteur der Living Population.', '{}'::jsonb, '{}'::jsonb)
      returning id into v_actor;
      insert into public.person_economic_actors(person_id, actor_id) values (v_person, v_actor);
      insert into public.person_life_state(person_id, life_stage, age_ticks, family_desire, last_family_event_tick)
      values (v_person, 'adult', 0, 0.5, null) on conflict (person_id) do nothing;
      insert into public.person_needs(person_id, need_code, satisfaction, updated_tick)
      values (v_person,'sustenance',0.70,v_tick),(v_person,'rest',0.70,v_tick),(v_person,'safety',0.70,v_tick),
             (v_person,'social',0.70,v_tick),(v_person,'purpose',0.70,v_tick),(v_person,'variety',0.70,v_tick)
      on conflict (person_id, need_code) do nothing;
      -- Ausgewiesene Emission: Startbestand der neu angelegten Person
      insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_actor, v_tick, 'endowment', null, 0, 980, v_location_id, 'bootstrap:person:' || v_person::text,
              'Bootstrap-Startbestand: Bewohner eines echten Hauses, beim Kauf ins Spiel übernommen');

      insert into public.person_assignments(person_id, assignment_type, location_id, tile_entity_id, region_feature_id, role_code, starts_tick, ends_tick, is_active)
      values (v_person, 'home', v_location_id, v_entity_id, v_feature, 'resident', v_tick, null, true)
      returning id into v_assignment;
      insert into public.person_tenancies(assignment_id, person_id, location_id, tile_entity_id, landlord_actor_id,
                                          rent_per_billing, billing_interval_ticks, next_due_tick, status, origin, tenure)
      values (v_assignment, v_person, v_location_id, v_entity_id, v_landlord,
              greatest(0, coalesce(p_rent_per_resident, 0)), 720, v_tick + 720,
              case when v_landlord is null or coalesce(p_rent_per_resident, 0) = 0 then 'provided' else 'active' end,
              'market', case when v_landlord is null or coalesce(p_rent_per_resident, 0) = 0 then 'provided' else 'rented' end);
      insert into public.person_surface_presence(person_id, location_id, source_kind, source_ref, x_m, y_m, latitude_deg, longitude_deg, spatial_region_id, confidence, updated_tick)
      values (v_person, v_location_id, 'building_anchor', 'tile_entity:' || v_entity_id::text, p_x_m, p_y_m, p_latitude, p_longitude, p_region_slug, 0.9, v_tick)
      on conflict (person_id) do nothing;
      v_moved := v_moved + 1;
    end loop;
  end if;

  return jsonb_build_object('entity_id', v_entity_id, 'residents', v_moved);
end;
$$;


-- Kauf eines einzelnen Hauses (außerhalb des Katasters): Transfer + Übernahme.
create or replace function public.buy_earth_building(
  p_profile_id uuid, p_source_ref text, p_price integer,
  p_latitude double precision, p_longitude double precision, p_width double precision, p_depth double precision, p_rotation double precision,
  p_display_name text, p_region_slug text, p_x_m double precision, p_y_m double precision,
  p_residential_capacity integer, p_feature_ids uuid[], p_new_residents integer default 0, p_rent_per_resident integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer; v_location_id uuid; v_public_actor uuid; v_tick bigint; v_result jsonb;
begin
  if p_price is null or p_price < 1 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  if v_credits < p_price then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;
  select id into v_location_id from public.locations where slug = 'earth';
  select actor_id into v_public_actor from public.location_public_actors where location_id = v_location_id;
  if v_public_actor is null then raise exception 'NOXIA_PUBLIC_ACTOR_MISSING'; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  v_result := public.acquire_earth_building(p_profile_id, p_source_ref, p_latitude, p_longitude, p_width, p_depth, p_rotation, p_display_name, p_region_slug, p_x_m, p_y_m, p_residential_capacity, p_feature_ids, p_new_residents, p_rent_per_resident);
  update public.profiles set credits = credits - p_price where id = p_profile_id;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_public_actor, v_tick, 'income', null, 0, p_price, v_location_id, 'building_purchase:' || p_source_ref || ':player:' || p_profile_id::text,
          left('Verkauf eines Gebäudes an einen Spieler: ' || coalesce(p_display_name, p_source_ref), 240));
  return v_result || jsonb_build_object('ok', true, 'price', p_price, 'credits', v_credits - p_price, 'seller_actor_id', v_public_actor);
end;
$$;

-- Kauf eines Flurstücks samt der Häuser darauf. p_buildings: Liste von Objekten mit
-- source, lat, lon, w, d, rotation, name, region, x, y, capacity, features (uuid[] als Text-Liste), residents, rent.
create or replace function public.buy_earth_parcel(p_profile_id uuid, p_parcel_id text, p_price integer, p_buildings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer; v_location_id uuid; v_public_actor uuid; v_tick bigint; v_item jsonb; v_part jsonb;
  v_entities jsonb := '[]'::jsonb; v_residents integer := 0; v_label text;
begin
  if p_price is null or p_price < 1 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  select label into v_label from public.earth_parcels where id = p_parcel_id for update;
  if not found then raise exception 'NOXIA_PARCEL_NOT_FOUND'; end if;
  if exists (select 1 from public.earth_parcel_owners where parcel_id = p_parcel_id) then raise exception 'NOXIA_PARCEL_OWNED'; end if;
  if v_credits < p_price then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;
  select id into v_location_id from public.locations where slug = 'earth';
  select actor_id into v_public_actor from public.location_public_actors where location_id = v_location_id;
  if v_public_actor is null then raise exception 'NOXIA_PUBLIC_ACTOR_MISSING'; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;

  insert into public.earth_parcel_owners(parcel_id, profile_id, price) values (p_parcel_id, p_profile_id, p_price);
  for v_item in select * from jsonb_array_elements(coalesce(p_buildings, '[]'::jsonb)) loop
    v_part := public.acquire_earth_building(
      p_profile_id, v_item->>'source', (v_item->>'lat')::double precision, (v_item->>'lon')::double precision,
      (v_item->>'w')::double precision, (v_item->>'d')::double precision, (v_item->>'rotation')::double precision,
      v_item->>'name', v_item->>'region', (v_item->>'x')::double precision, (v_item->>'y')::double precision,
      (v_item->>'capacity')::integer, array(select jsonb_array_elements_text(coalesce(v_item->'features', '[]'::jsonb))::uuid),
      coalesce((v_item->>'residents')::integer, 0), coalesce((v_item->>'rent')::integer, 0));
    v_entities := v_entities || jsonb_build_array(v_part->>'entity_id');
    v_residents := v_residents + coalesce((v_part->>'residents')::integer, 0);
  end loop;

  update public.profiles set credits = credits - p_price where id = p_profile_id;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_public_actor, v_tick, 'income', null, 0, p_price, v_location_id, 'parcel_purchase:' || p_parcel_id || ':player:' || p_profile_id::text,
          left('Verkauf eines Flurstücks an einen Spieler: ' || coalesce(v_label, p_parcel_id), 240));
  return jsonb_build_object('ok', true, 'parcel_id', p_parcel_id, 'price', p_price, 'credits', v_credits - p_price, 'entities', v_entities, 'residents', v_residents);
end;
$$;

revoke all on function public.acquire_earth_building(uuid,text,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) from public, anon, authenticated;
grant execute on function public.acquire_earth_building(uuid,text,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) to service_role;
revoke all on function public.buy_earth_building(uuid,text,integer,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) from public, anon, authenticated;
grant execute on function public.buy_earth_building(uuid,text,integer,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) to service_role;
revoke all on function public.buy_earth_parcel(uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.buy_earth_parcel(uuid,text,integer,jsonb) to service_role;
