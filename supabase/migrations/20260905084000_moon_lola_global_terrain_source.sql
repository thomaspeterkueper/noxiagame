-- The original Phase-1 catalogue used LROC WAC GLD100, which covers only
-- 79S..79N and therefore cannot be the canonical base DEM for the NOXIA
-- Shackleton south-pole location. Replace it with the global LRO LOLA DEM.

insert into public.terrain_datasets (
  id, location_id, body, provider, dataset_name, dataset_version, dataset_kind,
  resolution_m, horizontal_reference, vertical_reference, latitude_type,
  source_uri, source_license, access_mode, status, metadata
)
select
  'moon_lro_lola_118m', l.id, 'moon', 'USGS Astrogeology / NASA LRO',
  'Moon LRO LOLA Global LDEM 118m', '2014-03-11', 'dem',
  118.4505876, 'MOON_MEAN_EARTH_POLAR_AXIS', 'MEAN_RADIUS_1737400_M',
  'planetocentric',
  'https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif',
  'Public domain; cite the LOLA Science Team and retained product provenance',
  'geotiff', 'catalogued',
  jsonb_build_object(
    'provenance','observed',
    'coverage_lat_deg',jsonb_build_array(-90,90),
    'source_mission','Lunar Reconnaissance Orbiter',
    'instrument','LOLA',
    'pixels_per_degree',256,
    'stored_scale',0.5,
    'stored_offset',0.0
  )
from public.locations l
where lower(l.slug) in ('moon','mond')
on conflict (id) do update set
  location_id = excluded.location_id,
  source_uri = excluded.source_uri,
  metadata = excluded.metadata;

update public.world_frames
set terrain_dataset_id = 'moon_lro_lola_118m'
where body = 'moon';

-- The GLD100 row is no longer part of the canonical terrain catalogue. Its
-- source remains documented in the earlier migration for historical traceability.
delete from public.terrain_datasets
where id = 'moon_lro_wac_gld100';
