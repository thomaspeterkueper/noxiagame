-- 20261029020000_earth_job_agency.sql
-- Agentur für Arbeit in Sundern (Gastronomie, R-21; Thomas, 28./29.10.2026:
-- „es sollte auch eine Arbeitsvermittlung geben“ – „nimm das Gebäude, das besser
-- passt, wir müssen nicht perfekt sein“).
--
-- 1. Gebäudeart „Agentur für Arbeit“ (job_agency). Nicht baubar (is_active = false):
--    öffentliches Amt in einem realen Haus, wie das Reisebüro.
-- 2. Staatliche Agentur im realen Haus Freiheitsmühle 7 (osm:way:1474125073), dem
--    einzigen vollen Gebäude der Straße Freiheitsmühle in den Kartendaten. Die echte
--    Agentur für Arbeit Sundern liegt an der Freiheitsmühle 1; dort führen die
--    Kartendaten nur schmale Winkelbauten (osm:way:191140747, osm:way:332679119).
--    Maße aus lib/worldlab/buildingOffer.ts (buildingFacts): 51,3 × 30 m, 961 m²,
--    gedreht −18,1°, Lage relativ zu earth-sauerland (51,325 N / 8,005 O).
-- 3. Drei Personalplätze (Vermittlung, Beratung, Büro). Personal stellt Bevölkerung
--    und Ökonomie ein (R-21: noxia_staffed_kinds, building_staff_roles, Lohnschlüssel).

set search_path to public;

insert into public.building_definitions (key, name, tier, category, is_active, production, consumption, description, cost_credits, build_time_ticks, population_bonus, sort_order)
values ('job_agency', 'Agentur für Arbeit', 1, 'services', false, '[]'::jsonb, '[]'::jsonb,
        'Arbeitsvermittlung: freie Stellen im Ort, Vermittlung und Beratung.', 0, 0, 0, 76)
on conflict (key) do update set name = excluded.name, description = excluded.description;

do $$
declare
  v_earth uuid;
  v_site uuid;
  v_src constant text := 'osm:way:1474125073';
begin
  select id into v_earth from public.locations where slug = 'earth';
  if v_earth is null then return; end if;
  if exists (select 1 from public.tile_entities where source_ref = v_src) then
    raise notice 'Freiheitsmühle 7 ist bereits belegt – keine Agentur angelegt'; return;
  end if;
  select site_id into v_site from public.tile_entities
   where location_id = v_earth and entity_type = 'building' and is_state_owned and site_id is not null
   order by created_at limit 1;
  insert into public.tile_entities (
    location_id, site_id, entity_type, entity_id, status, owner_class, is_state_owned, placement_mode,
    latitude_deg, longitude_deg, x_m, y_m, z_m, rotation_deg, footprint_width_m, footprint_depth_m,
    spatial_region_id, source_ref, display_name, staff_capacity, condition, tile_level
  ) values (
    v_earth, v_site, 'building', 'job_agency', 'active', 'STATE', true, 'world',
    51.324159358, 8.006766520, 122.89, -93.58, 0, -18.1, 51.3, 30,
    'earth-sauerland', v_src, 'Freiheitsmühle 7', 3, 100, 0
  );
end $$;
