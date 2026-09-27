-- Correct Deimos nomenclature anchors against the IAU/USGS Gazetteer.
--
-- Important provenance rule:
--   * Swift/Voltaire names, center coordinates and nominal diameters are
--     nomenclature reference data.
--   * The NOXIA Deimos heightfield, crater depths/profiles and playable terrain
--     remain synthetic and must not be represented as observed DEM data.
--
-- Gazetteer coordinates for Deimos use planetographic latitude and +West
-- longitude. NOXIA stores +East longitudes, so Swift 358.2 W -> 1.8 E and
-- Voltaire 3.5 W -> -3.5 E.

SET search_path TO public;

-- Swift is 1.00 km across, not 3 km. The playable LOCAL_ENU origin remains the
-- synthetic/derived north-rim site, now recomputed from a 500 m crater radius
-- on the adopted 6200 m Deimos mean-radius sphere.
UPDATE world_frames
SET
  origin_lat_deg = 17.1206273801,
  origin_lon_deg = 1.8,
  origin_status = 'derived',
  observed_source = coalesce(observed_source, '{}'::jsonb) || jsonb_build_object(
    'provenance', 'nomenclature_reference',
    'reference_source', 'IAU/USGS Gazetteer of Planetary Nomenclature',
    'feature_reference_name', 'Swift',
    'feature_reference_lat_deg', 12.5,
    'feature_reference_source_lon_deg', 358.2,
    'feature_reference_source_longitude_direction', 'positive_west',
    'feature_reference_internal_lon_deg', 1.8,
    'feature_reference_diameter_km', 1.0,
    'feature_reference_role', 'IAU/USGS named-feature reference (crater center and nominal diameter); not a terrain DEM and not the playable site origin',
    'local_anchor_role', 'playable Swift north-rim LOCAL_ENU origin',
    'local_anchor_provenance', 'derived_from_nomenclature_reference_plus_adopted_radius',
    'local_anchor_method', 'spherical direct geodesic, bearing 0 deg (north), distance = crater radius 500 m, adopted mean radius 6200 m',
    'reference_corrected_at', '2026-09-27'
  ),
  derived_config = coalesce(derived_config, '{}'::jsonb) || jsonb_build_object(
    'local_anchor_strategy', 'swift_north_rim_offset',
    'local_anchor_dataset_id', 'deimos_synthetic_v1',
    'terrain_provenance', 'synthetic',
    'terrain_observation_status', 'not_observed',
    'nomenclature_reference_source', 'IAU/USGS Gazetteer of Planetary Nomenclature',
    'nomenclature_reference_corrected_at', '2026-09-27'
  )
WHERE location_id = (SELECT id FROM locations WHERE slug = 'deimos')
  AND body = 'deimos';

-- The synthetic dataset can now be attached to the playable Deimos location.
-- Remove the obsolete scaffold blocker while retaining explicit synthetic
-- provenance and recording the corrected real-world nomenclature anchors.
UPDATE terrain_datasets
SET
  location_id = (SELECT id FROM locations WHERE slug = 'deimos'),
  dataset_version = '2026-09-27',
  metadata = (coalesce(metadata, '{}'::jsonb) - 'blocks_on') || jsonb_build_object(
    'provenance', 'synthetic',
    'playable_location', 'deimos',
    'generator', 'deimosTerrainAdapter.syntheticDeimosElevationM',
    'real_reference_source', 'IAU/USGS Gazetteer of Planetary Nomenclature',
    'real_reference_features', jsonb_build_array('Voltaire', 'Swift'),
    'real_reference_note', 'Names, center positions and nominal diameters are nomenclature anchors; crater depth/profile and the surrounding heightfield are invented for gameplay and are not observations.',
    'real_reference_coordinate_note', 'Gazetteer +West longitudes converted to NOXIA +East: Swift 358.2W -> 1.8E; Voltaire 3.5W -> -3.5E.',
    'real_reference_nominal_diameter_km', jsonb_build_object('Swift', 1.0, 'Voltaire', 1.9),
    'reference_corrected_at', '2026-09-27'
  )
WHERE id = 'deimos_synthetic_v1';

COMMENT ON COLUMN public.terrain_datasets.metadata IS
  'Free-form provenance/config. provenance=synthetic marks intentionally invented non-observed terrain data; real_reference_* fields may contain authoritative nomenclature anchors without changing terrain provenance.';
