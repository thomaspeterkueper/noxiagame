-- supabase/migrations/20261025200000_earth_real_venue_purchase.sql
-- Entscheidung Thomas, 25.10.2026 (zu R-13): Nicht öffentliche Gebäude sind kaufbar,
-- auch Cafés, Restaurants und andere reale Lokale – aber teurer, weil sie schon
-- ausgebaut sind (Ausbauwert = Umbaukosten, lib/worldlab/buildingOffer.ts fitOutValue).
--   * acquire_earth_building: Gehört ein reales Lokal dem Ort (wie Metropol, Balkan
--     Grill), wechselt nur der Eigentümer – Kennung, Ausbau, Personal und Käufe
--     bleiben. Ein reales Lokal ohne Eintrag wird beim Kauf gleich mit seiner
--     Lokalart angelegt (Personal nach Größe, Wohnungen in den Obergeschossen).
--   * start_earth_venue_conversion: Ein gekauftes reales Lokal darf eine andere
--     Nutzung bekommen; dieselbe Lokalart braucht keinen Umbau.
-- Bezahlt wird wie bisher in buy_earth_building / buy_earth_parcel (versteuerte Überweisung).

set search_path to public;

-- Personalplätze nach Größe – dieselbe Regel wie VENUE_USAGES in lib/worldlab/venueConversion.ts
-- (klein < 110 m², groß ab 260 m², venueSizeForArea).
create or replace function public.venue_staff_capacity(p_kind text, p_area double precision) returns integer
language sql immutable as $$
  select case p_kind
    when 'cafe' then case when p_area < 110 then 1 when p_area >= 260 then 3 else 2 end
    when 'bar' then case when p_area < 110 then 1 when p_area >= 260 then 3 else 2 end
    when 'restaurant' then case when p_area < 110 then 2 when p_area >= 260 then 4 else 3 end
    when 'hotel' then case when p_area >= 260 then 3 else 2 end
    else null end
$$;

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

  -- Ein reales Lokal, das dem Ort gehört, wechselt nur den Eigentümer (Ausbau, Personal, Käufe bleiben).
  select id into v_entity_id from public.tile_entities
   where source_ref = p_source_ref and is_state_owned and public.real_venue_kind(source_tags) is not null
   for update;
  if v_entity_id is not null then
    select actor_id into v_landlord from public.profile_economic_actors where profile_id = p_profile_id;
    update public.tile_entities
       set profile_id = p_profile_id, owner_id = p_profile_id, owner_class = 'PLAYER', is_state_owned = false, actor_id = null
     where id = v_entity_id;
    update public.person_tenancies t
       set landlord_actor_id = coalesce(v_landlord, t.landlord_actor_id), updated_at = now()
      from public.person_assignments a
     where a.tile_entity_id = v_entity_id and a.is_active and a.assignment_type = 'home'
       and t.person_id = a.person_id and t.status in ('active', 'provided');
    return jsonb_build_object('entity_id', v_entity_id, 'residents', 0, 'transferred', true);
  end if;
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

  -- Ist das Haus laut Kartendaten schon Lokal, behält es diese Nutzung (der Trigger hat die Tags gesetzt).
  update public.tile_entities
     set entity_id = public.real_venue_kind(source_tags),
         staff_capacity = public.venue_staff_capacity(public.real_venue_kind(source_tags), footprint_width_m * footprint_depth_m),
         transient_capacity = case when public.real_venue_kind(source_tags) = 'hotel' then greatest(2, least(30, floor(footprint_width_m * footprint_depth_m * greatest(coalesce(building_levels, 2) - 1, 0) / 25)::integer)) else transient_capacity end,
         residential_capacity = case when public.real_venue_kind(source_tags) = 'hotel' then 0 else floor(footprint_width_m * footprint_depth_m * greatest(coalesce(building_levels, 2) - 1, 0) / 40)::integer end
   where id = v_entity_id and public.real_venue_kind(source_tags) is not null;

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

revoke all on function public.acquire_earth_building(uuid,text,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) from public, anon, authenticated;
grant execute on function public.acquire_earth_building(uuid,text,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) to service_role;
revoke all on function public.start_earth_venue_conversion(uuid,uuid,text,integer,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.start_earth_venue_conversion(uuid,uuid,text,integer,integer,integer,integer,integer) to service_role;
