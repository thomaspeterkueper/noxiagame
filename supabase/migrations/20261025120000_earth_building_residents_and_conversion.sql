-- supabase/migrations/20261025120000_earth_building_residents_and_conversion.sql
-- Erweiterung zu 20261025110000 (Thomas, 25.10.2026):
--   * Echte Wohnhäuser sind bewohnt: Beim Kauf ziehen dort neue Personen ein
--     (Anzahl und Miete rechnet der Server, lib/worldlab/buildingOffer.ts). Jede
--     Person bekommt ein eigenes Konto mit ausgewiesenem Startguthaben (Emission
--     nach NOXIA-FIN-0001, Referenz bootstrap:person:<id>, wie beim Pfarrer von
--     St. Johannes) und einen Mietvertrag mit dem Käufer als Vermieter
--     (profile_economic_actors); abgerechnet von run_npc_rent_settlement.
--   * Umbauen ohne Abriss: Nutzung eines gekauften Gebäudes ändern, Hülle und
--     Bewohner bleiben. Kosten: halber Neubaupreis, vom Server bestimmt; abgebucht
--     wie ein Bau (/api/game/build/spatial), sofort fertig.
--   * Vermieter beim Kauf: das Wirtschaftskonto des Spielers (profile_economic_actors),
--     nicht ein beliebiges Unternehmen.

set search_path to public;

drop function if exists public.buy_earth_building(uuid,text,integer,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[]);

create or replace function public.buy_earth_building(
  p_profile_id uuid,
  p_source_ref text,
  p_price integer,
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
  if p_price is null or p_price < 1 then raise exception 'NOXIA_PRICE_INVALID'; end if;
  if p_source_ref is null or p_source_ref !~ '^osm:(way|relation):[0-9]+$' then raise exception 'NOXIA_SOURCE_INVALID'; end if;

  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  if exists (select 1 from public.tile_entities where source_ref = p_source_ref) then raise exception 'NOXIA_BUILDING_OWNED'; end if;
  if exists (select 1 from public.earth_cleared_buildings where source_ref = p_source_ref) then raise exception 'NOXIA_BUILDING_CLEARED'; end if;
  if v_credits < p_price then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  select id into v_location_id from public.locations where slug = 'earth';
  select actor_id into v_public_actor from public.location_public_actors where location_id = v_location_id;
  if v_public_actor is null then raise exception 'NOXIA_PUBLIC_ACTOR_MISSING'; end if;
  select actor_id into v_landlord from public.profile_economic_actors where profile_id = p_profile_id;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;

  -- Transfer: Spieler → Gemeinde
  update public.profiles set credits = credits - p_price where id = p_profile_id;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_public_actor, v_tick, 'income', null, 0, p_price, v_location_id,
          'building_purchase:' || p_source_ref || ':player:' || p_profile_id::text,
          left('Verkauf eines Gebäudes an einen Spieler: ' || coalesce(p_display_name, p_source_ref), 240));

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

  return jsonb_build_object('ok', true, 'entity_id', v_entity_id, 'price', p_price, 'credits', v_credits - p_price, 'residents', v_moved, 'seller_actor_id', v_public_actor);
end;
$$;

-- Umbauen: Nutzung eines gekauften Gebäudes ändern (Hülle und Bewohner bleiben).
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
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  select * into v_row from public.tile_entities where id = p_entity_id for update;
  if not found then raise exception 'NOXIA_BUILDING_NOT_FOUND'; end if;
  if v_row.profile_id is distinct from p_profile_id then raise exception 'NOXIA_BUILDING_NOT_OWNED'; end if;
  if v_row.source_ref is null then raise exception 'NOXIA_BUILDING_NOT_ACQUIRED'; end if;
  if not exists (select 1 from public.building_definitions where key = p_type and is_active) then raise exception 'NOXIA_TYPE_INVALID'; end if;
  if v_credits < p_cost then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;
  update public.profiles set credits = credits - p_cost where id = p_profile_id;
  update public.tile_entities set entity_id = p_type, built_at = now() where id = p_entity_id;
  return jsonb_build_object('ok', true, 'entity_id', p_entity_id, 'type', p_type, 'cost', p_cost, 'credits', v_credits - p_cost);
end;
$$;

revoke all on function public.buy_earth_building(uuid,text,integer,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) from public, anon, authenticated;
grant execute on function public.buy_earth_building(uuid,text,integer,double precision,double precision,double precision,double precision,double precision,text,text,double precision,double precision,integer,uuid[],integer,integer) to service_role;
revoke all on function public.convert_earth_building(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.convert_earth_building(uuid,uuid,text,integer) to service_role;

-- Abriss eines bewohnten gekauften Hauses: die Bewohner ziehen in staatlichen
-- Wohnraum mit freien Plätzen (der nächste zuerst); reicht der Platz nicht,
-- wird der Abriss abgelehnt.
create or replace function public.demolish_earth_building(p_profile_id uuid, p_entity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.tile_entities%rowtype;
  v_resident record;
  v_home record;
  v_public_actor uuid;
  v_moved integer := 0;
begin
  select * into v_row from public.tile_entities where id = p_entity_id for update;
  if not found then raise exception 'NOXIA_BUILDING_NOT_FOUND'; end if;
  if v_row.profile_id is distinct from p_profile_id then raise exception 'NOXIA_BUILDING_NOT_OWNED'; end if;
  if v_row.source_ref is null then raise exception 'NOXIA_BUILDING_NOT_ACQUIRED'; end if;
  if exists (select 1 from public.person_assignments where tile_entity_id = p_entity_id and is_active and assignment_type <> 'home') then raise exception 'NOXIA_BUILDING_STAFFED'; end if;
  select actor_id into v_public_actor from public.location_public_actors where location_id = v_row.location_id;

  for v_resident in select id, person_id from public.person_assignments where tile_entity_id = p_entity_id and is_active and assignment_type = 'home' loop
    select te.id, te.latitude_deg, te.longitude_deg, te.x_m, te.y_m, te.spatial_region_id into v_home
      from public.tile_entities te
     where te.location_id = v_row.location_id and te.owner_class = 'STATE' and te.status = 'active'
       and coalesce(te.residential_capacity, 0) > (select count(*) from public.person_assignments a where a.tile_entity_id = te.id and a.is_active and a.assignment_type = 'home')
     order by (te.latitude_deg - v_row.latitude_deg)^2 + ((te.longitude_deg - v_row.longitude_deg) * 0.62)^2
     limit 1;
    if not found then raise exception 'NOXIA_NO_STATE_HOUSING'; end if;
    update public.person_assignments set tile_entity_id = v_home.id, region_feature_id = null, updated_at = now() where id = v_resident.id;
    update public.person_tenancies set tile_entity_id = v_home.id, landlord_actor_id = coalesce(v_public_actor, landlord_actor_id),
           rent_per_billing = null, next_due_tick = null, status = 'provided', tenure = 'provided', origin = 'provided', updated_at = now()
     where assignment_id = v_resident.id;
    update public.person_surface_presence set source_ref = 'tile_entity:' || v_home.id::text, latitude_deg = v_home.latitude_deg, longitude_deg = v_home.longitude_deg,
           x_m = v_home.x_m, y_m = v_home.y_m, spatial_region_id = v_home.spatial_region_id
     where person_id = v_resident.person_id;
    v_moved := v_moved + 1;
  end loop;

  insert into public.earth_cleared_buildings(source_ref, profile_id, latitude_deg, longitude_deg, footprint_width_m, footprint_depth_m, rotation_deg, display_name)
  values (v_row.source_ref, p_profile_id, v_row.latitude_deg, v_row.longitude_deg, v_row.footprint_width_m, v_row.footprint_depth_m, v_row.rotation_deg, v_row.display_name);
  delete from public.tile_entities where id = p_entity_id;
  return jsonb_build_object('ok', true, 'source_ref', v_row.source_ref, 'rehoused', v_moved);
end;
$$;
revoke all on function public.demolish_earth_building(uuid,uuid) from public, anon, authenticated;
grant execute on function public.demolish_earth_building(uuid,uuid) to service_role;
