-- Catalogue a metrically suitable lunar south-pole DEM for Shackleton.
--
-- The previous 118 m global equirectangular crop is geometrically unsuitable
-- for local play-space rendering near 90°S: an equal-degree lat/lon crop becomes
-- extremely anisotropic in meters. The PGDA LOLA south-pole product is already
-- south-polar stereographic with X/Y in meters and is therefore the preferred
-- source for local ENU/polar terrain patches.

insert into terrain_datasets (
  id,
  body,
  location_id,
  provider,
  dataset_name,
  dataset_version,
  dataset_kind,
  resolution_m,
  horizontal_reference,
  vertical_reference,
  latitude_type,
  longitude_direction,
  source_uri,
  source_license,
  access_mode,
  status,
  metadata
)
select
  'moon_lro_lola_south_pole_5m',
  'moon',
  l.id,
  'NASA GSFC PGDA / LRO LOLA',
  'South Pole LOLA DEM Mosaic 5m',
  'Barker et al. 2021',
  'dem',
  5,
  'MOON_ME_SOUTH_POLAR_STEREOGRAPHIC_DE421',
  'MOON_ME_DE421_SURFACE_HEIGHT',
  'planetocentric',
  'positive_east',
  'https://pgda.gsfc.nasa.gov/products/81',
  'NASA public data; cite Barker et al. 2021 and PGDA product provenance',
  'polar-stereographic-geotiff',
  'catalogued',
  jsonb_build_object(
    'product_key', 'ldem_87s_5mpp',
    'coverage_lat_deg', jsonb_build_array(-90, -87),
    'pixel_size_m', 5,
    'projection', 'south polar stereographic',
    'xy_units', 'meters',
    'reference_frame', 'MOON_ME / DE421',
    'purpose', 'Shackleton local metric terrain patches',
    'supersedes_for_polar_runtime', 'moon_lro_lola_118m',
    'provenance', 'observed'
  )
from locations l
where l.slug = 'moon'
on conflict (id) do update set
  provider = excluded.provider,
  dataset_name = excluded.dataset_name,
  dataset_version = excluded.dataset_version,
  resolution_m = excluded.resolution_m,
  horizontal_reference = excluded.horizontal_reference,
  vertical_reference = excluded.vertical_reference,
  source_uri = excluded.source_uri,
  source_license = excluded.source_license,
  access_mode = excluded.access_mode,
  metadata = excluded.metadata;
