-- Reproduce the canonical Earth gameplay location on fresh databases.
-- Production already contains this stable id/slug; ON CONFLICT keeps it intact.
insert into public.locations (
  id, slug, name, description, population, population_max, is_supplied,
  location_type, celestial_body_id, is_public, base_population_max
)
select
  '08b6feff-e1d8-48d8-bb65-dbcff4490587'::uuid,
  'earth',
  'Tharsis Hub Sauerland',
  'Gemeinsamer NOXIA-Earth-Start im Sauerland, Nordrhein-Westfalen, Deutschland. Der reale geodätische Ursprung wird separat verifiziert.',
  999999999,
  999999999,
  true,
  'colony',
  cb.id,
  true,
  999999999
from public.celestial_bodies cb
where cb.slug = 'earth'
on conflict (slug) do nothing;

-- The earlier spatial migration can only seed frames for locations that already
-- exist. Fresh previews previously had Moon/Mars but no Earth location.
insert into public.world_frames (
  location_id, body, coordinate_system, world_seed, observed_source, derived_config,
  origin_status, reference_frame, latitude_type, longitude_direction,
  equatorial_radius_m, polar_radius_m, vertical_datum
)
select
  l.id,
  'earth',
  'LOCAL_ENU_METERS',
  'NOXIA:EARTH:V1',
  jsonb_build_object('provenance','observed','status','origin-pending'),
  jsonb_build_object('provenance','derived','generator','noxia-spatial-v1'),
  'pending',
  'WGS84',
  'planetographic',
  'positive_east',
  6378137.0,
  6356752.314245179,
  'WGS84_ELLIPSOID'
from public.locations l
where l.slug = 'earth'
on conflict (location_id) do update set
  body = excluded.body,
  coordinate_system = excluded.coordinate_system,
  reference_frame = excluded.reference_frame,
  latitude_type = excluded.latitude_type,
  longitude_direction = excluded.longitude_direction,
  equatorial_radius_m = excluded.equatorial_radius_m,
  polar_radius_m = excluded.polar_radius_m,
  vertical_datum = excluded.vertical_datum;

insert into public.terrain_datasets (
  id, location_id, body, provider, dataset_name, dataset_version, dataset_kind,
  resolution_m, horizontal_reference, vertical_reference, latitude_type,
  source_uri, source_license, access_mode, status, metadata
)
select
  'earth_nrw_dgm1', l.id, 'earth', 'GeoBasis NRW', 'Digitales Geländemodell DGM1', null, 'dem',
  1.0, 'ETRS89_UTM32_EPSG25832', 'PROVIDER_NATIVE_HEIGHT', 'planetographic',
  'https://www.wcs.nrw.de/geobasis/wcs_nw_dgm',
  'Open Data; preserve GeoBasis NRW product-specific source and licence metadata at ingestion',
  'wcs', 'catalogued',
  jsonb_build_object('provenance','observed','coverage','North Rhine-Westphalia','grid_spacing_m',1)
from public.locations l
where l.slug = 'earth'
on conflict (id) do update set
  location_id = excluded.location_id,
  source_uri = excluded.source_uri,
  metadata = excluded.metadata;

update public.world_frames wf
set terrain_dataset_id = 'earth_nrw_dgm1'
from public.locations l
where wf.location_id = l.id and l.slug = 'earth';
