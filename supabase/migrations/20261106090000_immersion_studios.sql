-- 20261106090000_immersion_studios.sql
-- Erlebnis-Studios (Thomas, 06.11.2026): kein Zeitreisebüro, sondern ein VR-Anbieter. Man legt sich in einen Pod
-- und erlebt die Vergangenheit (Chronomaps), Spielwelten wie Endia oder ganz Abstraktes. Register: lib/worldlab/chronomaps.ts.
-- 1. Gebäudeart immersion_studio (nicht baubar, entsteht in realen Häusern).
-- 2. Je ein staatliches Studio in Dvārakā (osm:way:1343177734, 26,8 × 18,7 m) und Istanbul/Fatih (osm:way:530509109, 17,1 × 10,9 m);
--    beides unbenannte reale Häuser nahe der Ortsmitte. x_m/y_m relativ zur Mitte der Ortsregion (x Ost, y Nord).
-- Nur neue Zeilen; Rücknahme: delete from tile_entities where entity_id = 'immersion_studio'; delete from building_definitions where key = 'immersion_studio'.

set search_path to public;

insert into public.building_definitions (key, name, tier, category, is_active, production, consumption, description, cost_credits, build_time_ticks, population_bonus, sort_order)
values ('immersion_studio', 'Erlebnis-Studio', 1, 'services', false, '[]'::jsonb, '[]'::jsonb,
        'Pods für Zeitreisen in die Vergangenheit, Spielwelten wie Endia und abstrakte Erfahrungen.', 0, 0, 0, 76)
on conflict (key) do update set name = excluded.name, description = excluded.description;

do $$
declare
  v_earth uuid;
  v_site uuid;
  v_new integer := 0;
  r record;
begin
  select id into v_earth from public.locations where slug = 'earth';
  if v_earth is null then return; end if;
  select site_id into v_site from public.tile_entities
   where location_id = v_earth and entity_type = 'building' and is_state_owned and site_id is not null
   order by created_at limit 1;
  for r in select * from (values
    ('osm:way:1343177734', 22.2381191, 68.9679435, 26.8, 18.7, 73.6, 'earth-place-22p23786-68p96754', 'Erlebnis-Studio · Dvārakā', 22.23786, 68.96754),
    ('osm:way:530509109',  41.0048160, 28.9760424, 17.1, 10.9, 34.8, 'earth-place-41p00638-28p97587', 'Erlebnis-Studio · Istanbul', 41.006381, 28.9758715)
  ) as t(src, lat, lon, w, d, rot, region, name, clat, clon) loop
    if exists (select 1 from public.tile_entities where source_ref = r.src) then
      raise notice '% ist bereits belegt – übersprungen', r.src; continue;
    end if;
    insert into public.tile_entities (
      location_id, site_id, entity_type, entity_id, status, owner_class, is_state_owned, placement_mode,
      latitude_deg, longitude_deg, x_m, y_m, z_m, rotation_deg, footprint_width_m, footprint_depth_m,
      spatial_region_id, source_ref, source_tags, display_name, staff_capacity, condition, tile_level
    ) values (
      v_earth, v_site, 'building', 'immersion_studio', 'active', 'STATE', true, 'world',
      r.lat, r.lon, (r.lon - r.clon) * 111320 * cos(radians(r.clat)), (r.lat - r.clat) * 111320, 0, r.rot, r.w, r.d,
      r.region, r.src, jsonb_build_object('building', 'yes', 'noxia_source', 'OpenStreetMap', 'noxia_source_id', r.src),
      r.name, 2, 100, 0
    );
    v_new := v_new + 1;
  end loop;
  raise notice 'Erlebnis-Studios angelegt: %', v_new;
end $$;
