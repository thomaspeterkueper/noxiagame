-- Deimos: small, deliberately minimal playable research outpost.
-- Swift center: 12.5N, 1.8E. Playable origin is a derived point 1500 m due
-- north of the named crater center on an adopted 6200 m mean radius.

SET search_path TO public;

INSERT INTO locations
  (slug, name, description, population, population_max, has_shipyard, location_type, celestial_body_id, is_public)
VALUES
  ('deimos', 'Deimos', 'Kleine Forschungsaussenstelle am Rand des Swift-Kraters: Mini-Habitat, Forschungsstation und eine einzelne Shuttle-Anlegestelle.',
   6, 60, false, 'colony', '10000000-0000-0000-0000-000000000006', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO world_frames (location_id, body, world_seed, observed_source, derived_config)
SELECT id, 'deimos', 'NOXIA:DEIMOS:V1',
       jsonb_build_object('provenance','observed','status','origin-pending'),
       jsonb_build_object('provenance','derived','generator','noxia-spatial-v1')
FROM locations WHERE slug = 'deimos'
ON CONFLICT (location_id) DO NOTHING;

UPDATE world_frames
SET
  reference_frame = 'DEIMOS_PLANETOCENTRIC',
  latitude_type = 'planetocentric',
  longitude_direction = 'positive_east',
  equatorial_radius_m = 6200.0,
  polar_radius_m = 6200.0,
  vertical_datum = 'DEIMOS_MEAN_RADIUS_6200M',
  terrain_dataset_id = 'deimos_synthetic_v1',
  origin_lat_deg = 26.37,
  origin_lon_deg = 1.8,
  origin_alt_m = 0,
  origin_status = 'derived',
  observed_source = coalesce(observed_source, '{}'::jsonb) || jsonb_build_object(
    'feature_reference_name', 'Swift',
    'feature_reference_lat_deg', 12.5,
    'feature_reference_lon_deg', 1.8,
    'feature_reference_diameter_km', 3,
    'feature_reference_role', 'IAU/USGS named-feature reference (crater center); not the playable site origin',
    'local_anchor_role', 'playable Swift north-rim LOCAL_ENU origin',
    'local_anchor_provenance', 'derived_from_named_feature_plus_radius_offset',
    'local_anchor_method', 'spherical direct geodesic, bearing 0 deg (north), distance = crater radius 1500 m, adopted mean radius 6200 m',
    'local_anchor_selected_at', '2026-09-25'
  ),
  derived_config = coalesce(derived_config, '{}'::jsonb) || jsonb_build_object(
    'local_anchor_strategy', 'swift_north_rim_offset',
    'local_anchor_dataset_id', 'deimos_synthetic_v1',
    'visual_language', 'deimos_functional_minimal',
    'visual_language_notes', 'Sehr funktionaler, nuechterner Look: keine Zierelemente, exponierte Leitungen/Rahmenstruktur, gedecktes Grau/Weiss.'
  )
WHERE location_id = (SELECT id FROM locations WHERE slug = 'deimos')
  AND body = 'deimos';

UPDATE building_definitions
SET allowed_locations = array_append(allowed_locations, 'deimos')
WHERE key = 'habitat'
  AND allowed_locations IS NOT NULL
  AND NOT ('deimos' = ANY(allowed_locations));

INSERT INTO building_definitions
  (key,name,description,category,tier,cost_credits,build_time_ticks,production,consumption,population_bonus,allowed_locations,is_active)
VALUES
  ('research_station','Forschungsstation','Kleine, rein funktionale Forschungsstation fuer Oberflaechen- und Umlaufbahn-Untersuchungen.','services',1,4800,4,'[]'::jsonb,'[]'::jsonb,0,ARRAY['deimos'],true),
  ('shuttle_dock_deimos','Anlegestelle','Einzige Shuttle-/Kleinfrachter-Anlegestelle der Deimos-Aussenstelle.','infrastructure',1,3600,3,'[]'::jsonb,'[]'::jsonb,0,ARRAY['deimos'],true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tier = EXCLUDED.tier,
  cost_credits = EXCLUDED.cost_credits,
  build_time_ticks = EXCLUDED.build_time_ticks,
  allowed_locations = EXCLUDED.allowed_locations,
  is_active = true;

WITH deimos_location AS (
  SELECT id FROM locations WHERE slug = 'deimos'
), seed(entity_id,x_m,y_m,rotation_deg,footprint_width_m,footprint_depth_m) AS (
  VALUES
    ('habitat',              -18.0,   8.0,  6.0, 18.0, 14.0),
    ('research_station',       6.0,  10.0,  6.0, 22.0, 18.0),
    ('shuttle_dock_deimos',   30.0,  -6.0, 18.0, 34.0, 26.0)
)
INSERT INTO tile_entities
  (profile_id,location_id,entity_type,entity_id,owner_class,owner_id,is_state_owned,
   placement_mode,x_m,y_m,rotation_deg,footprint_width_m,footprint_depth_m,
   spatial_region_id,terrain_dataset_id,terrain_status,status,condition)
SELECT
  NULL,d.id,'building',s.entity_id,'STATE',NULL,true,
  'world',s.x_m,s.y_m,s.rotation_deg,s.footprint_width_m,s.footprint_depth_m,
  'deimos-swift-alpha','deimos_synthetic_v1','unresolved','active',100
FROM deimos_location d
CROSS JOIN seed s
WHERE NOT EXISTS (
  SELECT 1 FROM tile_entities te
  WHERE te.location_id = d.id
    AND te.entity_type = 'building'
    AND te.entity_id = s.entity_id
    AND te.spatial_region_id = 'deimos-swift-alpha'
);
