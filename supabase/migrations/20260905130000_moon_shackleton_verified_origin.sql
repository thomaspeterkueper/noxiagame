-- NOXIA Moon/Shackleton verified world-frame origin
--
-- Source: USGS Gazetteer of Planetary Nomenclature, Feature 5450 (Shackleton),
-- retrieved 2026-09-05. Current listed center: 89.67°S, 129.78°E.
-- https://planetarynames.wr.usgs.gov/Feature/5450
--
-- The canonical Moon reference surface is a 1,737,400 m mean sphere. Therefore
-- origin_alt_m = 0 is a deliberate coordinate-reference choice (mean-radius
-- surface), NOT a fallback terrain elevation. Real LOLA terrain remains sampled
-- independently and may be above or below this reference surface.
--
-- The Gazetteer exposes planetographic latitude while NOXIA's spherical Moon
-- reference uses planetocentric latitude. For a sphere (a=b=1,737,400 m) these
-- latitude definitions are numerically equivalent.

update public.world_frames wf
set origin_lat_deg = -89.67,
    origin_lon_deg = 129.78,
    origin_alt_m = 0,
    origin_status = 'verified',
    terrain_dataset_id = 'moon_lro_lola_118m',
    observed_source = coalesce(wf.observed_source, '{}'::jsonb) || jsonb_build_object(
      'origin_provenance', 'observed',
      'origin_feature', 'Shackleton',
      'origin_feature_id', 5450,
      'origin_source', 'USGS Gazetteer of Planetary Nomenclature',
      'origin_source_uri', 'https://planetarynames.wr.usgs.gov/Feature/5450',
      'origin_source_retrieved', '2026-09-05',
      'origin_source_coordinate_system', 'Planetographic +East -180..180',
      'origin_lat_deg_source', -89.67,
      'origin_lon_deg_source', 129.78,
      'origin_altitude_semantics', '0 m on Moon mean-radius 1737400 m reference surface; not terrain elevation'
    ),
    updated_at = now()
from public.locations l
where wf.location_id = l.id
  and wf.body = 'moon'
  and lower(l.slug) in ('moon','mond');

-- The global LOLA product is now usable by the verified Shackleton frame. This
-- marks source availability for sampling; individual cached terrain_tiles still
-- carry their own ingestion/readiness state.
update public.terrain_datasets
set status = 'ready',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'runtime_adapter', 'moon-lro-lola-118m',
      'remote_range_source', true,
      'source_file_size_note', 'USGS product page reports approximately 8 GB',
      'sampling_status', 'global source ready; progressive tile cache pending'
    ),
    updated_at = now()
where id = 'moon_lro_lola_118m';
