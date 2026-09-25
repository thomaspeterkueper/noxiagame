-- Phobos Base Alpha: erster persistenter Phobos-Startbestand am Stickney-
-- Nordrand. Reuses the existing generic building definitions (moon-tested)
-- rather than inventing new gameplay types; only allowed_locations is widened
-- and one new landing/cargo definition is added, since Phobos's ~1/1000 g
-- micro-gravity makes "landing" a docking/anchoring operation rather than a
-- runway, distinct enough from landing_pad_moon to warrant its own key.

SET search_path TO public;

UPDATE building_definitions
SET allowed_locations = array_append(allowed_locations, 'phobos')
WHERE key IN ('habitat','life_support_hub','battery_storage','solar','warehouse','surface_workshop','rover_yard','surface_comms')
  AND NOT ('phobos' = ANY(allowed_locations));

INSERT INTO building_definitions
  (key,name,description,category,tier,cost_credits,build_time_ticks,production,consumption,population_bonus,allowed_locations,is_active)
VALUES
  ('landing_pad_phobos','Anlege- und Cargo-Zone','Phobos-Andock- und Verankerungsfeld mit Frachtumschlag; wegen Mikrogravitation keine klassische Landebahn.','infrastructure',1,5000,4,'[]'::jsonb,'[]'::jsonb,0,ARRAY['phobos'],true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tier = EXCLUDED.tier,
  cost_credits = EXCLUDED.cost_credits,
  build_time_ticks = EXCLUDED.build_time_ticks,
  allowed_locations = EXCLUDED.allowed_locations,
  is_active = true;

WITH phobos_location AS (
  SELECT id FROM locations WHERE slug = 'phobos'
), seed(entity_id,x_m,y_m,rotation_deg,footprint_width_m,footprint_depth_m) AS (
  VALUES
    ('habitat',            -30.0,  18.0, 10.0, 26.0, 20.0),
    ('life_support_hub',    -6.0,  16.0, 10.0, 22.0, 22.0),
    ('solar',              -58.0,  46.0,  0.0, 46.0, 32.0),
    ('battery_storage',    -34.0,  38.0,  4.0, 22.0, 22.0),
    ('warehouse',           22.0,   2.0, 14.0, 32.0, 26.0),
    ('surface_workshop',    24.0, -20.0, 14.0, 28.0, 24.0),
    ('rover_yard',          48.0, -26.0, 14.0, 34.0, 26.0),
    ('surface_comms',      -10.0,  50.0,  0.0, 16.0, 16.0),
    ('landing_pad_phobos',  90.0, -60.0, 22.0, 70.0, 55.0)
)
INSERT INTO tile_entities
  (profile_id,location_id,entity_type,entity_id,owner_class,owner_id,is_state_owned,
   placement_mode,x_m,y_m,rotation_deg,footprint_width_m,footprint_depth_m,
   spatial_region_id,terrain_dataset_id,terrain_status,status,condition)
SELECT
  NULL,p.id,'building',s.entity_id,'STATE',NULL,true,
  'world',s.x_m,s.y_m,s.rotation_deg,s.footprint_width_m,s.footprint_depth_m,
  'phobos-stickney-alpha','phobos_mex_hrsc_dem_100m','unresolved','active',100
FROM phobos_location p
CROSS JOIN seed s
WHERE NOT EXISTS (
  SELECT 1 FROM tile_entities te
  WHERE te.location_id = p.id
    AND te.entity_type = 'building'
    AND te.entity_id = s.entity_id
    AND te.spatial_region_id = 'phobos-stickney-alpha'
);
