-- 20261029020000_offworld_buildings_into_world.sql
-- Gebäude ohne Weltlage auf Mars, Mond, Phobos und in Mishkan Avi in die Welt
-- holen (Thomas, 29.10.2026: „Ja hole sie in die Welt, aber sinnvoll verteilt“).
-- Sie stammten aus dem alten Kachelraster und waren in den begehbaren Ansichten
-- unsichtbar (planetaryLocalScene zeigt nur Bauten mit x_m/y_m).
--
-- Verteilung (Lageplan in docs/workstreams/world-map.md):
-- - Mars, Tharsis Hub: sieben Wohnhabitate der Bewohner als neues Wohnviertel
--   nordöstlich der Schule, in zwei Reihen; das Solarfeld eines Spielers am Ende
--   der Solarreihe; die Hafenkantine neben dem Landeplatz.
-- - Mond, Shackleton: 16 Eisbohrer als Eisfeld südlich der Basis, zum Kraterinneren
--   hin (Ursprung am Rand, −y zeigt zum Pol, dort liegt das Wassereis im
--   Dauerschatten); die Mine beim Landeplatz und Fahrzeughof; die Kantine am Lager.
-- - Phobos, Stickney: Verwaltung und Schule am Wohnkern, zweites Lager beim
--   Logistikcluster, kleiner zweiter Landeplatz neben dem Anlegefeld, Kantine
--   dazwischen, zwei Scanner am Kraterrand.
-- - Mishkan Avi: Kantine am Landeplatz.
-- Abstand zu bestehenden Bauten 6–14 m (Phobos wie PHOBOS_BASE_ALPHA_MIN_CLEARANCE_M),
-- zu Korridoren 4–8 m. Drehung wie die Nachbarn. Stationen (Prometheus, Q1) bleiben
-- ohne Weltlage – sie haben keine begehbare Ansicht.
-- Alte Werte in offworld_placement_20261029 (Rücknahme möglich).

set search_path to public;

create table if not exists public.offworld_placement_20261029 (
  tile_entity_id uuid primary key,
  location_slug text not null,
  entity_id text not null,
  old_placement_mode text, old_x_m double precision, old_y_m double precision,
  old_rotation_deg double precision, old_footprint_width_m double precision, old_footprint_depth_m double precision,
  old_spatial_region_id text, old_terrain_dataset_id text,
  placed_at timestamptz not null default now()
);
alter table public.offworld_placement_20261029 enable row level security;
comment on table public.offworld_placement_20261029 is 'Alte Lage der Gebäude außerhalb der Erde, die am 29.10.2026 aus dem Kachelraster in die Welt geholt wurden – zur Rücknahme.';

do $$
declare v_moved integer;
begin
  create temp table _plan(id uuid, slug text, entity_id text, x double precision, y double precision, w double precision, d double precision, rot double precision) on commit drop;
  insert into _plan values
    ('4182b3e2-d270-4265-91b5-7f3230d5ebff'::uuid, 'mars', 'habitat', -90, 200, 28, 22, 0),
    ('943357e8-6d6a-49eb-8021-93ee78e0095b'::uuid, 'mars', 'habitat', -50, 200, 28, 22, 0),
    ('25413719-6323-475a-8201-b2ced218f71d'::uuid, 'mars', 'habitat', -10, 200, 28, 22, 0),
    ('0b64342b-8b7c-4f1d-a598-12f136bc9065'::uuid, 'mars', 'habitat', 30, 200, 28, 22, 0),
    ('d6d71250-df5d-4878-919e-ef01f6c09456'::uuid, 'mars', 'habitat', -90, 240, 28, 22, 0),
    ('13d5e177-53ab-4021-a684-28f98415d039'::uuid, 'mars', 'habitat', -50, 240, 28, 22, 0),
    ('fd333d18-f7d0-4372-9f1f-557f7e3007be'::uuid, 'mars', 'habitat', -10, 240, 28, 22, 0),
    ('7cddddeb-7529-4b48-bb45-02b5911a78f8'::uuid, 'mars', 'solar', 10, 150, 18, 14, 0),
    ('b0f21d6a-dcc3-47a3-9573-79ff42a89efc'::uuid, 'mars', 'port_canteen', -262, 172, 20, 14, 0),
    ('079115b5-cccb-4ee1-9e95-89514dd2af2e'::uuid, 'moon', 'ice_drill', -150, -150, 34, 34, 8),
    ('6d339694-6385-4046-84a4-1d1e1b8214e2'::uuid, 'moon', 'ice_drill', -104, -150, 34, 34, 8),
    ('9b6e60bf-f2f2-44f7-9ddf-fd8750836d1e'::uuid, 'moon', 'ice_drill', -58, -150, 34, 34, 8),
    ('e93793fc-3ce4-476f-aaf4-cdec30f4b0d7'::uuid, 'moon', 'ice_drill', -12, -150, 34, 34, 8),
    ('73f46099-5f71-4a88-9a9c-704008087cf9'::uuid, 'moon', 'ice_drill', -150, -196, 34, 34, 8),
    ('4ca40071-c430-4472-845d-b79ac0ab5e0d'::uuid, 'moon', 'ice_drill', -104, -196, 34, 34, 8),
    ('2430f90e-e30f-4f46-803d-73dcca4b97b8'::uuid, 'moon', 'ice_drill', -58, -196, 34, 34, 8),
    ('779c22c2-20bc-4889-859a-42c913437126'::uuid, 'moon', 'ice_drill', -12, -196, 34, 34, 8),
    ('8eafe0d0-edea-4f0e-9777-1b59450dd969'::uuid, 'moon', 'ice_drill', -150, -242, 34, 34, 8),
    ('2f073342-faec-4e4b-a7ad-c57ce83be257'::uuid, 'moon', 'ice_drill', -104, -242, 34, 34, 8),
    ('f0c2ce5c-a07c-4d52-914c-53b845da9898'::uuid, 'moon', 'ice_drill', -58, -242, 34, 34, 8),
    ('cf37ef32-37db-4e1f-836e-0000771565d8'::uuid, 'moon', 'ice_drill', -12, -242, 34, 34, 8),
    ('2a92a3d9-5e1e-42f5-bcf8-0f8011a675b2'::uuid, 'moon', 'ice_drill', -150, -288, 34, 34, 8),
    ('dea7ada3-53bf-4f46-b17a-8b74d39d8712'::uuid, 'moon', 'ice_drill', -104, -288, 34, 34, 8),
    ('182429f3-bd8e-493e-964d-b26bde73f64f'::uuid, 'moon', 'ice_drill', -58, -288, 34, 34, 8),
    ('27d54ac8-9489-4111-be9f-156a52a26d06'::uuid, 'moon', 'ice_drill', -12, -288, 34, 34, 8),
    ('f53565b6-e76f-4f47-a46e-670c088a01d8'::uuid, 'moon', 'mine', 93, -115, 34, 34, 12),
    ('3f269bba-aaed-44f5-a34f-a415fef4612e'::uuid, 'moon', 'port_canteen', 95, -5, 20, 14, 12),
    ('63cb5650-0e1d-44b6-b607-c01ef44e781e'::uuid, 'phobos', 'admin', -30, -38, 20, 16, 0),
    ('dd4a2c03-9c61-4c21-b2d0-d2edb4745f8b'::uuid, 'phobos', 'school', -53, 20, 22, 18, 0),
    ('8b9fca0e-c2c0-4904-b53a-8039e81cdfd5'::uuid, 'phobos', 'warehouse', 80, 110, 32, 26, 0),
    ('e746f057-e690-48dd-b339-e4f7acd9d23c'::uuid, 'phobos', 'landing_pad', 140, -110, 30, 30, 0),
    ('76a5f5a7-61ab-42e8-8269-4c6319e55977'::uuid, 'phobos', 'port_canteen', 152, -53, 20, 14, 0),
    ('199b6fe4-922a-4caa-a7f9-b6848e21e6ee'::uuid, 'phobos', 'scanner', -170, -70, 16, 16, 0),
    ('c1730d8b-1ed2-49bb-9163-cc6c8c71c4aa'::uuid, 'phobos', 'scanner', 40, -125, 16, 16, 0),
    ('17f6eda8-1935-4741-8f10-56f6cf192776'::uuid, 'mishkan-avi', 'port_canteen', 30, 24, 16, 12, 12);

  insert into public.offworld_placement_20261029 (tile_entity_id, location_slug, entity_id, old_placement_mode, old_x_m, old_y_m, old_rotation_deg, old_footprint_width_m, old_footprint_depth_m, old_spatial_region_id, old_terrain_dataset_id)
  select t.id, p.slug, t.entity_id, t.placement_mode, t.x_m, t.y_m, t.rotation_deg, t.footprint_width_m, t.footprint_depth_m, t.spatial_region_id, t.terrain_dataset_id::text
    from public.tile_entities t join _plan p on p.id = t.id
  on conflict (tile_entity_id) do nothing;

  update public.tile_entities t set
    x_m = p.x, y_m = p.y, z_m = coalesce(t.z_m, 0), rotation_deg = p.rot,
    footprint_width_m = p.w, footprint_depth_m = p.d, placement_mode = 'world',
    spatial_region_id = (select max(o.spatial_region_id) from public.tile_entities o where o.location_id = t.location_id and o.placement_mode = 'world' and o.id <> t.id),
    terrain_dataset_id = (select max(o.terrain_dataset_id::text) from public.tile_entities o where o.location_id = t.location_id and o.placement_mode = 'world' and o.id <> t.id),
    terrain_status = 'origin_pending', ground_elevation_m = null, terrain_min_elevation_m = null, terrain_max_elevation_m = null, terrain_slope_deg = null
  from _plan p join public.locations l on l.slug = p.slug
  where t.id = p.id and t.location_id = l.id and t.entity_id = p.entity_id and t.x_m is null;
  get diagnostics v_moved = row_count;
  raise notice 'Gebäude in die Welt geholt: %', v_moved;
end $$;
