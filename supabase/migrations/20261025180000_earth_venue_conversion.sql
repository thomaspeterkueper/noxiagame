-- supabase/migrations/20261025180000_earth_venue_conversion.sql
-- Request R-13 (Gastronomie, 25.10.2026; Entscheidung Thomas): Auf der Erde werden
-- Lokale nicht neu gebaut. Man kauft ein reales Haus des Ortes und baut es zum Café,
-- zur Bar, zum Restaurant oder Hotel um – sofern es nicht schon eines ist.
--
--   1. Kauf als versteuerte Überweisung (wie order_hospitality_item): Käufer −Preis,
--      Verkäufer (vorerst der Ort, location_public_actors) +netto, Koloniekasse +Steuer.
--      Gilt für buy_earth_building und buy_earth_parcel.
--   2. Kartengebäude an tile_entities: source_ref (OSM-Kennung, W-4) war schon da; neu
--      werden beim Anlegen die OSM-Tags (source_tags) und Geschosse (building_levels)
--      aus region_features übernommen – daraus liest die Gastronomie die Lokalart.
--   3. Umbau als Nutzung am Gebäude: start_earth_venue_conversion bucht die Kosten
--      (wie der bisherige Neubau: Café 900, Bar 1 800, Restaurant 2 400, Hotel 3 600)
--      und merkt den Umbau in conversion_plan vor; complete_due_earth_conversions
--      (Cron /api/cron/builds) setzt nach der Bauzeit Nutzung, Personalplätze
--      (staff_capacity), Gästezimmer (transient_capacity) und Wohnplätze aus den
--      Obergeschossen (residential_capacity, R-6). Plätze rechnet der Server
--      (lib/worldlab/venueConversion.ts). Häuser, die laut Kartendaten schon Lokal
--      sind, sind nicht umbaubar.
--   4. Bar und Restaurant als aktive Gebäudearten (R-1) mit Karten (R-2).
--   5. Reale Lokale in Sundern gehören dem Ort: „Metropol“ (Bar, Hauptstraße 76) und
--      „Balkan Grill“ (Restaurant, Hauptstraße 68) als staatliche Gebäude.
--   6. Das selbst gebaute Startcafé in Sundern zieht in das reale Haus Hauptstraße 72:
--      Kennung, Personal, Käufe und Eigentümer bleiben, Grundriss und Adresse wechseln.
-- Maße der realen Häuser: lib/worldlab/buildingOffer.ts (buildingFacts) aus dem
-- OSM-Grundriss, Lage relativ zur Region earth-sauerland (51,325 N / 8,005 O).

set search_path to public;

-- ── 2. Kartengebäude: Tags und Geschosse ─────────────────────────────────────
alter table public.tile_entities add column if not exists source_tags jsonb;
alter table public.tile_entities add column if not exists building_levels smallint;
alter table public.tile_entities add column if not exists staff_capacity integer;
alter table public.tile_entities add column if not exists conversion_plan jsonb;
do $$ begin
  alter table public.tile_entities add constraint tile_entities_staff_capacity_check check (staff_capacity is null or staff_capacity >= 0);
exception when duplicate_object then null; end $$;

comment on column public.tile_entities.source_tags is 'OSM-Tags des realen Gebäudes (aus region_features), z. B. amenity, name, addr:*; R-13.';
comment on column public.tile_entities.building_levels is 'Geschosse des realen Gebäudes laut Kartendaten (building:levels), sonst null.';
comment on column public.tile_entities.staff_capacity is 'Personalplätze eines Lokals nach Größe (R-13, Aufgabe 2).';
comment on column public.tile_entities.conversion_plan is 'Laufender Umbau zum Lokal: type, ready_at, Plätze; null, wenn kein Umbau läuft (R-13).';

create index if not exists region_features_building_source_id
  on public.region_features ((properties->>'noxia_source_id')) where feature_type = 'building';

create or replace function public.tile_entities_real_building_meta() returns trigger
language plpgsql as $$
declare
  v_props jsonb;
begin
  if new.source_ref is null then return new; end if;
  if tg_op = 'UPDATE' and new.source_ref is not distinct from old.source_ref and new.source_tags is not null then return new; end if;
  select properties into v_props from public.region_features
   where feature_type = 'building' and properties->>'noxia_source_id' = new.source_ref
   order by id limit 1;
  if v_props is null then return new; end if;
  new.source_tags := v_props - array['visual_seed','visual_class','noxia_enrichment','noxia_provenance'];
  new.building_levels := nullif(regexp_replace(coalesce(v_props->>'building:levels', ''), '[^0-9].*$', ''), '')::smallint;
  return new;
end $$;
drop trigger if exists trg_tile_entities_real_building_meta on public.tile_entities;
create trigger trg_tile_entities_real_building_meta before insert or update of source_ref on public.tile_entities
  for each row execute function public.tile_entities_real_building_meta();

-- Bestand: bereits gekaufte Häuser bekommen ihre Tags nachgetragen.
update public.tile_entities te
   set source_tags = rf.properties - array['visual_seed','visual_class','noxia_enrichment','noxia_provenance'],
       building_levels = nullif(regexp_replace(coalesce(rf.properties->>'building:levels', ''), '[^0-9].*$', ''), '')::smallint
  from (select distinct on (properties->>'noxia_source_id') properties->>'noxia_source_id' as src, properties
          from public.region_features where feature_type = 'building' order by properties->>'noxia_source_id', id) rf
 where te.source_ref is not null and te.source_tags is null and rf.src = te.source_ref;

-- Lokalart laut Kartendaten – dieselbe Regel wie venueKindForRealPlace (lib/game/hospitality/venues.ts).
create or replace function public.real_venue_kind(p_tags jsonb) returns text
language sql immutable as $$
  select case
    when lower(coalesce(p_tags->>'amenity', '')) in ('cafe', 'fast_food', 'ice_cream') then 'cafe'
    when lower(coalesce(p_tags->>'amenity', '')) in ('bar', 'pub', 'biergarten', 'nightclub') then 'bar'
    when lower(coalesce(p_tags->>'amenity', '')) = 'restaurant' then 'restaurant'
    when lower(coalesce(p_tags->>'tourism', '')) in ('hotel', 'guest_house', 'motel', 'hostel') then 'hotel'
    else null end
$$;

-- ── 1. Kauf als versteuerte Überweisung ──────────────────────────────────────
-- Erwartet ein gesperrtes Käuferkonto mit genug Guthaben (prüft der Aufrufer).
create or replace function public.noxia_taxed_purchase(
  p_profile_id uuid, p_seller_actor uuid, p_location_id uuid, p_price integer, p_tick bigint, p_ref text, p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric;
  v_tax integer;
  v_net integer;
begin
  select least(1, greatest(0, coalesce(cs.tax_transaction, 0))) into v_rate from public.colony_settings cs where cs.location_id = p_location_id;
  v_rate := coalesce(v_rate, 0);
  v_tax := least(p_price, greatest(0, round(p_price * v_rate)::integer));
  v_net := p_price - v_tax;
  update public.profiles set credits = credits - p_price where id = p_profile_id;
  if v_net > 0 then
    insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
    values (p_seller_actor, p_tick, 'income', null, 0, v_net, p_location_id, p_ref, left(p_note, 240));
  end if;
  if v_tax > 0 then
    insert into public.colony_ledger(location_id, tick, entry_type, profile_id, resource_type, amount, note)
    values (p_location_id, p_tick, 'tax_transaction', p_profile_id, null, v_tax, left('Grunderwerb (' || p_ref || ')', 240));
  end if;
  return jsonb_build_object('tax_credits', v_tax, 'seller_net_credits', v_net, 'tax_rate', v_rate);
end;
$$;
revoke all on function public.noxia_taxed_purchase(uuid,uuid,uuid,integer,bigint,text,text) from public, anon, authenticated;
grant execute on function public.noxia_taxed_purchase(uuid,uuid,uuid,integer,bigint,text,text) to service_role;

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
  v_credits integer; v_location_id uuid; v_public_actor uuid; v_tick bigint; v_result jsonb; v_paid jsonb;
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
  v_paid := public.noxia_taxed_purchase(p_profile_id, v_public_actor, v_location_id, p_price, v_tick,
    'building_purchase:' || p_source_ref || ':player:' || p_profile_id::text,
    'Verkauf eines Gebäudes an einen Spieler (netto): ' || coalesce(p_display_name, p_source_ref));
  return v_result || v_paid || jsonb_build_object('ok', true, 'price', p_price, 'credits', v_credits - p_price, 'seller_actor_id', v_public_actor);
end;
$$;

create or replace function public.buy_earth_parcel(p_profile_id uuid, p_parcel_id text, p_price integer, p_buildings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer; v_location_id uuid; v_public_actor uuid; v_tick bigint; v_item jsonb; v_part jsonb; v_paid jsonb;
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

  v_paid := public.noxia_taxed_purchase(p_profile_id, v_public_actor, v_location_id, p_price, v_tick,
    'parcel_purchase:' || p_parcel_id || ':player:' || p_profile_id::text,
    'Verkauf eines Flurstücks an einen Spieler (netto): ' || coalesce(v_label, p_parcel_id));
  return v_paid || jsonb_build_object('ok', true, 'parcel_id', p_parcel_id, 'price', p_price, 'credits', v_credits - p_price, 'entities', v_entities, 'residents', v_residents);
end;
$$;

revoke all on function public.buy_earth_building(uuid,text,integer,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) from public, anon, authenticated;
grant execute on function public.buy_earth_building(uuid,text,integer,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) to service_role;
revoke all on function public.buy_earth_parcel(uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.buy_earth_parcel(uuid,text,integer,jsonb) to service_role;

-- ── 4. Bar und Restaurant als Gebäudearten (R-1), Karten (R-2) ───────────────
update public.building_definitions
   set is_active = true, cost_credits = 1800, build_time_ticks = 2, tier = 2,
       description = 'Schankraum mit Tresen, Stehtischen und Sitznische. Auf der Erde durch Umbau eines gekauften Hauses.'
 where key = 'bar';

insert into public.building_definitions(
  key, name, description, tier, category, is_active, production, sort_order, consumption,
  cost_credits, build_time_ticks, population_bonus, allowed_locations
) values (
  'restaurant', 'Restaurant', 'Speiseraum mit Küche. Auf der Erde durch Umbau eines gekauften Hauses.', 2, 'life', true, '[]'::jsonb, 70, '[]'::jsonb,
  2400, 2, 0, null
) on conflict (key) do update set is_active = true, cost_credits = excluded.cost_credits, build_time_ticks = excluded.build_time_ticks,
  tier = excluded.tier, description = excluded.description;

insert into public.hospitality_menu(entity_id, item_code, label, price_credits) values
  ('bar', 'drink', 'Getränk', 3),
  ('bar', 'snack', 'Snack', 4),
  ('bar', 'longdrink', 'Longdrink', 6),
  ('restaurant', 'drink', 'Getränk', 3),
  ('restaurant', 'dessert', 'Nachtisch', 5),
  ('restaurant', 'starter', 'Vorspeise', 6),
  ('restaurant', 'main', 'Hauptgericht', 12)
on conflict (entity_id, item_code) do nothing;

-- ── 3. Umbau zum Lokal ───────────────────────────────────────────────────────
create or replace function public.start_earth_venue_conversion(
  p_profile_id uuid, p_entity_id uuid, p_type text, p_cost integer, p_build_ticks integer,
  p_staff_capacity integer, p_transient_capacity integer, p_residential_capacity integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tile_entities%rowtype;
  v_credits integer;
  v_ready timestamptz;
  v_plan jsonb;
begin
  if p_type not in ('cafe', 'bar', 'restaurant', 'hotel') then raise exception 'NOXIA_TYPE_INVALID'; end if;
  if not exists (select 1 from public.building_definitions where key = p_type and is_active) then raise exception 'NOXIA_TYPE_INVALID'; end if;
  if p_cost is null or p_cost < 0 or p_build_ticks is null or p_build_ticks < 0 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  select * into v_row from public.tile_entities where id = p_entity_id for update;
  if not found then raise exception 'NOXIA_BUILDING_NOT_FOUND'; end if;
  if v_row.profile_id is distinct from p_profile_id then raise exception 'NOXIA_BUILDING_NOT_OWNED'; end if;
  if v_row.source_ref is null then raise exception 'NOXIA_BUILDING_NOT_ACQUIRED'; end if;
  if v_row.conversion_plan is not null then raise exception 'NOXIA_CONVERSION_PENDING'; end if;
  if public.real_venue_kind(v_row.source_tags) is not null then raise exception 'NOXIA_BUILDING_IS_REAL_VENUE'; end if;
  if v_row.entity_id = p_type then raise exception 'NOXIA_TYPE_INVALID'; end if;
  if v_credits < p_cost then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  -- Umbaukosten wie ein Bau: abgebucht ohne Gegenbuchung (dieselbe Senke wie /api/game/build/spatial).
  update public.profiles set credits = credits - p_cost where id = p_profile_id;
  v_ready := now() + make_interval(hours => p_build_ticks);
  v_plan := jsonb_build_object('type', p_type, 'cost', p_cost, 'build_ticks', p_build_ticks, 'started_at', now(), 'ready_at', v_ready,
    'staff_capacity', greatest(0, coalesce(p_staff_capacity, 0)), 'transient_capacity', greatest(0, coalesce(p_transient_capacity, 0)),
    'residential_capacity', greatest(0, coalesce(p_residential_capacity, 0)), 'from', v_row.entity_id);
  update public.tile_entities set conversion_plan = v_plan where id = p_entity_id;
  if p_build_ticks = 0 then perform public.complete_due_earth_conversions(); end if;
  return jsonb_build_object('ok', true, 'entity_id', p_entity_id, 'type', p_type, 'cost', p_cost, 'credits', v_credits - p_cost, 'ready_at', v_ready, 'plan', v_plan);
end;
$$;

create or replace function public.complete_due_earth_conversions() returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_done integer;
begin
  with due as (
    select id, conversion_plan as plan from public.tile_entities
     where conversion_plan is not null and (conversion_plan->>'ready_at')::timestamptz <= now()
     for update
  )
  update public.tile_entities te
     set entity_id = due.plan->>'type',
         staff_capacity = (due.plan->>'staff_capacity')::integer,
         transient_capacity = (due.plan->>'transient_capacity')::integer,
         -- Wer dort wohnt, behält seinen Platz.
         residential_capacity = greatest((due.plan->>'residential_capacity')::integer,
           (select count(*)::integer from public.person_assignments a where a.tile_entity_id = te.id and a.is_active and a.assignment_type = 'home')),
         built_at = now(),
         conversion_plan = null
    from due where te.id = due.id;
  get diagnostics v_done = row_count;
  return jsonb_build_object('ok', true, 'completed', v_done);
end;
$$;

-- Andere Nutzungen (R-12) nicht während eines Umbaus, und kein Lokal auf diesem Weg.
create or replace function public.convert_earth_building(p_profile_id uuid, p_entity_id uuid, p_type text, p_cost integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tile_entities%rowtype;
  v_credits integer;
begin
  if p_cost is null or p_cost < 0 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  if p_type in ('cafe', 'bar', 'restaurant', 'hotel') then raise exception 'NOXIA_TYPE_INVALID'; end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  select * into v_row from public.tile_entities where id = p_entity_id for update;
  if not found then raise exception 'NOXIA_BUILDING_NOT_FOUND'; end if;
  if v_row.profile_id is distinct from p_profile_id then raise exception 'NOXIA_BUILDING_NOT_OWNED'; end if;
  if v_row.source_ref is null then raise exception 'NOXIA_BUILDING_NOT_ACQUIRED'; end if;
  if v_row.conversion_plan is not null then raise exception 'NOXIA_CONVERSION_PENDING'; end if;
  if not exists (select 1 from public.building_definitions where key = p_type and is_active) then raise exception 'NOXIA_TYPE_INVALID'; end if;
  if v_credits < p_cost then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;
  update public.profiles set credits = credits - p_cost where id = p_profile_id;
  update public.tile_entities set entity_id = p_type, built_at = now() where id = p_entity_id;
  return jsonb_build_object('ok', true, 'entity_id', p_entity_id, 'type', p_type, 'cost', p_cost, 'credits', v_credits - p_cost);
end;
$$;

revoke all on function public.start_earth_venue_conversion(uuid,uuid,text,integer,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.start_earth_venue_conversion(uuid,uuid,text,integer,integer,integer,integer,integer) to service_role;
revoke all on function public.complete_due_earth_conversions() from public, anon, authenticated;
grant execute on function public.complete_due_earth_conversions() to service_role;
revoke all on function public.convert_earth_building(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.convert_earth_building(uuid,uuid,text,integer) to service_role;

-- ── 5. Reale Lokale in Sundern gehören dem Ort ───────────────────────────────
do $$
declare
  v_earth uuid;
begin
  select id into v_earth from public.locations where slug = 'earth';
  if v_earth is null then return; end if;

  insert into public.tile_entities(
    profile_id, actor_id, is_state_owned, location_id, entity_type, entity_id, owner_class, status, placement_mode,
    x_m, y_m, latitude_deg, longitude_deg, spatial_region_id, rotation_deg, footprint_width_m, footprint_depth_m,
    residential_capacity, transient_capacity, staff_capacity, source_ref, display_name
  )
  select null, null, true, v_earth, 'building', v.kind, 'STATE', 'active', 'world',
         v.x, v.y, v.lat, v.lon, 'earth-sauerland', v.rot, v.w, v.d, v.flats, 0, v.staff, v.src, v.name
    from (values
      ('osm:way:191141349', 'bar',        'Metropol',     -73.77, 108.82, 51.325978673, 8.003938309, 2.7,   16.6, 11.2, 4, 2),
      ('osm:way:332679123', 'restaurant', 'Balkan Grill', -49.63,  44.27, 51.325398108, 8.004285820, -23.9, 13.6, 11.6, 3, 3)
    ) as v(src, kind, name, x, y, lat, lon, rot, w, d, flats, staff)
   where not exists (select 1 from public.tile_entities te where te.source_ref = v.src);
end $$;

-- ── 6. Startcafé zieht in Hauptstraße 72 ─────────────────────────────────────
-- Dasselbe Café wie in 20261010091500_starter_cafe_region_anchor.sql: das erste
-- aktive Café der Region earth-sauerland. Kennung, Personal, Käufe, Eigentümer bleiben.
do $$
declare
  v_earth uuid;
  v_cafe uuid;
  v_src constant text := 'osm:way:191141346';
  v_lat constant double precision := 51.32565445;
  v_lon constant double precision := 8.00417605;
  v_x constant double precision := -57.25;
  v_y constant double precision := 72.77;
begin
  select id into v_earth from public.locations where slug = 'earth';
  if v_earth is null then return; end if;
  select te.id into v_cafe from public.tile_entities te
   where te.location_id = v_earth and te.entity_type = 'building' and te.entity_id = 'cafe'
     and te.status = 'active' and te.spatial_region_id = 'earth-sauerland'
   order by te.created_at, te.id limit 1;
  if v_cafe is null then raise notice 'Startcafé nicht gefunden – nichts übertragen'; return; end if;
  if exists (select 1 from public.tile_entities where source_ref = v_src and id <> v_cafe) then
    raise notice 'Hauptstraße 72 gehört bereits jemandem – Startcafé bleibt, wo es ist'; return;
  end if;

  update public.tile_entities
     set latitude_deg = v_lat, longitude_deg = v_lon, x_m = v_x, y_m = v_y,
         rotation_deg = -23.8, footprint_width_m = 12, footprint_depth_m = 11.6,
         source_ref = v_src, display_name = 'Hauptstraße 72',
         residential_capacity = greatest(3, coalesce(residential_capacity, 0)), staff_capacity = 2
   where id = v_cafe and source_ref is distinct from v_src;

  -- Wer am Café verankert ist (Personal, Gäste), steht jetzt am neuen Haus.
  update public.person_surface_presence
     set latitude_deg = v_lat, longitude_deg = v_lon, x_m = v_x, y_m = v_y
   where source_ref = 'tile_entity:' || v_cafe::text;
end $$;
