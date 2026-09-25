-- Phobos terrain catalogue + world frame seed.
--
-- Real elevation data exists for Phobos: USGS Astrogeology / ESA Mars Express
-- HRSC DEM Global 100m (Phobos_ME_HRSC_DEM_Global_2ppd.tif), a ~478kB whole-
-- body raster (699x349px, Simple Cylindrical, planetocentric lat, positive-
-- east lon). This registers that dataset the same way the Mars MOLA dataset
-- was catalogued (status 'catalogued' until actually ingested).
--
-- The playable local frame is anchored at the Stickney crater RIM, not the
-- crater center, per the chosen landing site. Stickney's center is a named
-- USGS Gazetteer feature: lat 1.00 deg, lon 49.00 deg in the Gazetteer's
-- "Planetographic, +West, 0-360" convention, which converts to lat 1.00 deg,
-- lon -49.00 deg (positive-east). Stickney is ~9km across on a body whose
-- adopted mean spherical radius here is 11,100m, so the crater is enormous
-- relative to Phobos -- the rim sits roughly a quarter of the way around the
-- body from the center along a meridian, not a small offset. The rim point
-- below is the north-rim point 4,500m (crater radius) due north of the named
-- center, computed with the standard spherical direct-geodesic formula on the
-- adopted mean radius. This is a computed offset from a real named feature,
-- not an invented coordinate -- but it is not itself a catalogued feature, so
-- origin_status is 'derived' rather than 'verified'.

alter table public.world_frames drop constraint if exists world_frames_body_check;
alter table public.world_frames add constraint world_frames_body_check
  check (body in ('earth','moon','mars','phobos','other'));

alter table public.terrain_datasets drop constraint if exists terrain_datasets_body_check;
alter table public.terrain_datasets add constraint terrain_datasets_body_check
  check (body in ('earth','moon','mars','phobos','other'));

insert into public.terrain_datasets (
  id, location_id, body, provider, dataset_name, dataset_version, dataset_kind,
  resolution_m, horizontal_reference, vertical_reference, latitude_type,
  longitude_direction, source_uri, source_license, access_mode, status, metadata
)
select
  'phobos_mex_hrsc_dem_100m', l.id, 'phobos', 'USGS Astrogeology / ESA Mars Express',
  'Phobos Mars Express HRSC DEM Global 100m', '2009-06-01', 'dem',
  100.0, 'PHOBOS_PLANETOCENTRIC', 'PHOBOS_MEAN_RADIUS_11100M', 'planetocentric',
  'positive_east',
  'https://planetarymaps.usgs.gov/mosaic/Phobos_ME_HRSC_DEM_Global_2ppd.tif',
  'public-domain',
  'geotiff', 'catalogued',
  jsonb_build_object(
    'provenance','observed',
    'pixels_per_degree',2,
    'source_mission','Mars Express HRSC + Viking (gap-fill)',
    'raster_width',699,
    'raster_height',349,
    'source_byte_size_note','478 kB whole-body raster; no windowed crop needed at ingestion'
  )
from public.locations l where lower(l.slug) = 'phobos'
on conflict (id) do update set
  location_id = excluded.location_id,
  source_uri = excluded.source_uri,
  metadata = excluded.metadata;

insert into public.world_frames (location_id, body, world_seed, observed_source, derived_config)
select id, 'phobos', 'NOXIA:PHOBOS:V1',
       jsonb_build_object('provenance','observed','status','origin-pending'),
       jsonb_build_object('provenance','derived','generator','noxia-spatial-v1')
from public.locations
where lower(slug) = 'phobos'
on conflict (location_id) do nothing;

update public.world_frames
set
  reference_frame = 'PHOBOS_PLANETOCENTRIC',
  latitude_type = 'planetocentric',
  longitude_direction = 'positive_east',
  equatorial_radius_m = 11100.0,
  polar_radius_m = 11100.0,
  vertical_datum = 'PHOBOS_MEAN_RADIUS_11100M',
  terrain_dataset_id = 'phobos_mex_hrsc_dem_100m',
  origin_lat_deg = 24.235,
  origin_lon_deg = -49.00,
  origin_alt_m = 0,
  origin_status = 'derived',
  observed_source = coalesce(observed_source, '{}'::jsonb) || jsonb_build_object(
    'feature_reference_name', 'Stickney',
    'feature_reference_lat_deg', 1.00,
    'feature_reference_lon_deg', -49.00,
    'feature_reference_diameter_km', 9,
    'feature_reference_role', 'USGS Gazetteer named-feature reference (crater center); not the playable site origin',
    'local_anchor_role', 'playable Stickney north-rim LOCAL_ENU origin',
    'local_anchor_provenance', 'derived_from_named_feature_plus_radius_offset',
    'local_anchor_method', 'spherical direct geodesic, bearing 0 deg (north), distance = crater radius 4500 m, adopted mean radius 11100 m',
    'local_anchor_selected_at', '2026-09-25'
  ),
  derived_config = coalesce(derived_config, '{}'::jsonb) || jsonb_build_object(
    'local_anchor_strategy', 'stickney_north_rim_offset',
    'local_anchor_dataset_id', 'phobos_mex_hrsc_dem_100m',
    'visual_language', 'phobos_distinct',
    'visual_language_notes', 'much darker/carbonaceous regolith than Moon; buildings shown with visible anchor/tether cables (micro-gravity ~1/1000 g)'
  )
where location_id = (select id from public.locations where slug = 'phobos')
  and body = 'phobos';

comment on column public.world_frames.origin_status is 'pending until a real, verified planetary/geodetic origin is assigned; derived = computed from a real named feature plus a documented offset; no location is invented from nothing.';
