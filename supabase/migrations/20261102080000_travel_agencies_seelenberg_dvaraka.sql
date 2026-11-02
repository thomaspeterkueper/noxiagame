-- 20261102080000_travel_agencies_seelenberg_dvaraka.sql
-- Staatliche Reisebüros in Seelenberg und Dvārakā (Thomas, 02.11.2026: „ja bitte“ –
-- an beiden Orten gibt es in den Kartendaten keinen Bahnhof, also braucht man dort einen Abfahrtsort).
-- Je ein unbenanntes reales Haus nahe der Ortsmitte (OSM, Maße aus lib/worldlab/buildingOffer.ts buildingFacts):
--   Seelenberg: osm:way:353655651, 11,5 × 9,5 m, 110 m², gedreht 44,6°
--   Dvārakā:    osm:way:1343177750, 18,3 × 15,5 m, 259 m², gedreht 70,6°
-- Lage x_m/y_m relativ zur Mitte des Ortes (x Ost, y Nord), wie bei den übrigen Bauten in Ortsregionen.
-- Nur neue Zeilen (kein Update bestehender Bauten); Rücknahme: delete … where entity_id = 'travel_agency' and source_ref in (…).

set search_path to public;

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
    ('osm:way:353655651',  50.2609582, 8.4151170, 11.5, 9.5, 44.6, 'earth-place-50p26092-8p41486', 'Reisebüro · Seelenberg', 50.26092, 8.41486),
    ('osm:way:1343177750', 22.2377959, 68.9675986, 18.3, 15.5, 70.6, 'earth-place-22p23786-68p96754', 'Reisebüro · Dvārakā', 22.23786, 68.96754)
  ) as t(src, lat, lon, w, d, rot, region, name, clat, clon) loop
    if exists (select 1 from public.tile_entities where source_ref = r.src) then
      raise notice '% ist bereits belegt – übersprungen', r.src; continue;
    end if;
    insert into public.tile_entities (
      location_id, site_id, entity_type, entity_id, status, owner_class, is_state_owned, placement_mode,
      latitude_deg, longitude_deg, x_m, y_m, z_m, rotation_deg, footprint_width_m, footprint_depth_m,
      spatial_region_id, source_ref, source_tags, display_name, staff_capacity, condition, tile_level
    ) values (
      v_earth, v_site, 'building', 'travel_agency', 'active', 'STATE', true, 'world',
      r.lat, r.lon, (r.lon - r.clon) * 111320 * cos(radians(r.clat)), (r.lat - r.clat) * 111320, 0, r.rot, r.w, r.d,
      r.region, r.src, jsonb_build_object('building', 'yes', 'noxia_source', 'OpenStreetMap', 'noxia_source_id', r.src),
      r.name, 2, 100, 0
    );
    v_new := v_new + 1;
  end loop;
  raise notice 'Reisebüros angelegt: %', v_new;
end $$;
