-- The previous Moon LOCAL_ENU frame used the USGS Gazetteer coordinate of the
-- named Shackleton feature (-89.67, 129.78) as its local origin. That point is
-- the crater feature reference, not the playable rim site, and lies 690 m east
-- of the NASA/GSFC Site04 5 m LOLA raster.
--
-- Anchor the playable local frame at the centre of the authoritative Site04
-- projected raster instead.  Site04 bounds are X [-9000, 7000] m and
-- Y [-15000, 1000] m in the MOON_ME DE421 south-polar stereographic frame, so
-- the local anchor is projected (-1000, -7000) m.  Inverse projection on the
-- 1,737,400 m lunar reference sphere gives the coordinates below.
-- The Gazetteer feature coordinate is retained in observed_source as the
-- named-feature reference; the local gameplay frame is explicitly identified
-- as a derived site anchor.

update public.world_frames
set
  origin_lat_deg = -89.76681145215035,
  origin_lon_deg = -171.86989764584402,
  origin_alt_m = 0,
  origin_status = 'verified',
  reference_frame = 'MOON_ME_DE421',
  terrain_dataset_id = 'moon_lro_lola_south_pole_5m',
  observed_source = coalesce(observed_source, '{}'::jsonb) || jsonb_build_object(
    'feature_reference_lat_deg', -89.67,
    'feature_reference_lon_deg', 129.78,
    'feature_reference_role', 'USGS Gazetteer named-feature reference; not the playable site origin',
    'local_anchor_role', 'playable Shackleton rim Site04 LOCAL_ENU origin',
    'local_anchor_provenance', 'derived_from_observed_raster_georeference',
    'local_anchor_source', 'NASA GSFC PGDA / LRO LOLA Site04 5 m LDEM',
    'local_anchor_source_uri', 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif',
    'local_anchor_projected_x_m', -1000,
    'local_anchor_projected_y_m', -7000,
    'local_anchor_projection', 'MOON_ME DE421 south polar stereographic',
    'local_anchor_selected_at', '2026-09-25'
  ),
  derived_config = coalesce(derived_config, '{}'::jsonb) || jsonb_build_object(
    'local_anchor_strategy', 'site04_projected_bbox_center',
    'local_anchor_dataset_id', 'moon_lro_lola_south_pole_5m'
  )
where location_id = (select id from public.locations where slug = 'moon')
  and body = 'moon';

-- Existing local X/Y placements remain valid relative to the new playable-site
-- frame, but their persisted terrain summaries belong to the previous terrain
-- authority.  Invalidate them so the shared runtime sampler can recompute the
-- 5 m LOLA heights and slopes without carrying stale/null resolved state.
update public.tile_entities
set
  z_m = null,
  terrain_dataset_id = 'moon_lro_lola_south_pole_5m',
  terrain_status = 'unresolved',
  ground_elevation_m = null,
  terrain_min_elevation_m = null,
  terrain_max_elevation_m = null,
  terrain_slope_deg = null
where location_id = (select id from public.locations where slug = 'moon')
  and placement_mode = 'world'
  and entity_type in ('building', 'module');

update public.player_builds
set
  z_m = null,
  terrain_dataset_id = 'moon_lro_lola_south_pole_5m',
  terrain_status = 'unresolved',
  ground_elevation_m = null,
  terrain_min_elevation_m = null,
  terrain_max_elevation_m = null,
  terrain_slope_deg = null
where location_id = (select id from public.locations where slug = 'moon')
  and placement_mode = 'world'
  and target_type = 'building';
