-- 20261106100000_immersion_studios_sundern_frankfurt.sql
-- Erlebnis-Studios in Sundern und Frankfurt (Thomas, 06.11.2026: „lass uns mit den studios in sundern und frankfurt anfangen“).
-- Je ein unbenanntes, nicht als Wohnhaus eingetragenes reales Haus nahe der Ortsmitte (Maße aus den Kartendaten):
--   Sundern:   osm:way:246885862, 27,4 × 24,6 m, gedreht −11,8° (Region earth-sauerland, Mitte 51,325 N / 8,005 O)
--   Frankfurt: osm:way:174512109, 20,9 × 16,0 m, gedreht −16,6° (Region earth-place-50p11064-8p68209)
-- x_m/y_m relativ zur Mitte der Region (x Ost, y Nord). Nur neue Zeilen; Rücknahme:
--   delete from tile_entities where entity_id = 'immersion_studio' and source_ref in ('osm:way:246885862','osm:way:174512109').

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
    ('osm:way:246885862', 51.3253872, 7.9999858, 27.4, 24.6, -11.8, 'earth-sauerland', 'Erlebnis-Studio · Sundern', 51.325, 8.005),
    ('osm:way:174512109', 50.1116025, 8.6817247, 20.9, 16.0, -16.6, 'earth-place-50p11064-8p68209', 'Erlebnis-Studio · Frankfurt', 50.1106444, 8.6820917)
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
