-- NOXIA planetary terrain phase 1
-- Adds explicit 3D planetary reference metadata and a renderer-independent
-- terrain catalogue/tile contract. No elevation is invented: existing local
-- placements keep z_m NULL until terrain is actually resolved.

create table if not exists public.terrain_datasets (
  id text primary key,
  location_id uuid references public.locations(id) on delete set null,
  body text not null,
  provider text not null,
  dataset_name text not null,
  dataset_version text,
  dataset_kind text not null,
  resolution_m double precision,
  horizontal_reference text not null,
  vertical_reference text not null,
  latitude_type text not null,
  longitude_direction text not null default 'positive_east',
  source_uri text not null,
  source_license text,
  access_mode text not null,
  status text not null default 'catalogued',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terrain_datasets_body_check check (body in ('earth','moon','mars','other')),
  constraint terrain_datasets_kind_check check (dataset_kind in ('dem','dsm')),
  constraint terrain_datasets_latitude_type_check check (latitude_type in ('planetographic','planetocentric')),
  constraint terrain_datasets_longitude_direction_check check (longitude_direction = 'positive_east'),
  constraint terrain_datasets_status_check check (status in ('catalogued','ingesting','ready','disabled')),
  constraint terrain_datasets_resolution_check check (resolution_m is null or resolution_m > 0)
);

create table if not exists public.terrain_tiles (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null references public.terrain_datasets(id) on delete cascade,
  tile_key text not null,
  min_lat double precision not null,
  min_lon double precision not null,
  max_lat double precision not null,
  max_lon double precision not null,
  raster_width integer,
  raster_height integer,
  pixel_size_m double precision,
  storage_bucket text,
  storage_path text,
  raster_format text,
  nodata_value double precision,
  min_elevation_m double precision,
  max_elevation_m double precision,
  checksum text,
  status text not null default 'catalogued',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(dataset_id, tile_key),
  constraint terrain_tiles_lat_check check (min_lat between -90 and 90 and max_lat between -90 and 90 and max_lat >= min_lat),
  constraint terrain_tiles_lon_check check (min_lon between -180 and 180 and max_lon between -180 and 180),
  constraint terrain_tiles_status_check check (status in ('catalogued','ingesting','ready','failed'))
);

create index if not exists terrain_datasets_location_idx on public.terrain_datasets(location_id, status);
create index if not exists terrain_tiles_dataset_status_idx on public.terrain_tiles(dataset_id, status);
create index if not exists terrain_tiles_bounds_idx on public.terrain_tiles(dataset_id, min_lat, max_lat, min_lon, max_lon);

alter table public.terrain_datasets enable row level security;
alter table public.terrain_tiles enable row level security;

drop policy if exists terrain_datasets_authenticated_read on public.terrain_datasets;
create policy terrain_datasets_authenticated_read
  on public.terrain_datasets for select to authenticated using (true);

drop policy if exists terrain_tiles_authenticated_read on public.terrain_tiles;
create policy terrain_tiles_authenticated_read
  on public.terrain_tiles for select to authenticated using (true);

alter table public.world_frames
  add column if not exists origin_status text not null default 'pending',
  add column if not exists reference_frame text,
  add column if not exists latitude_type text,
  add column if not exists longitude_direction text not null default 'positive_east',
  add column if not exists equatorial_radius_m double precision,
  add column if not exists polar_radius_m double precision,
  add column if not exists vertical_datum text,
  add column if not exists terrain_dataset_id text references public.terrain_datasets(id) on delete set null;

alter table public.world_frames drop constraint if exists world_frames_origin_status_check;
alter table public.world_frames add constraint world_frames_origin_status_check
  check (origin_status in ('pending','verified','derived'));

alter table public.world_frames drop constraint if exists world_frames_latitude_type_check;
alter table public.world_frames add constraint world_frames_latitude_type_check
  check (latitude_type is null or latitude_type in ('planetographic','planetocentric'));

alter table public.world_frames drop constraint if exists world_frames_longitude_direction_check;
alter table public.world_frames add constraint world_frames_longitude_direction_check
  check (longitude_direction = 'positive_east');

-- Canonical body shape/reference metadata. Values are reference surfaces only;
-- terrain elevations remain dataset-specific and preserve their vertical datum.
update public.world_frames
set reference_frame = 'WGS84',
    latitude_type = 'planetographic',
    longitude_direction = 'positive_east',
    equatorial_radius_m = 6378137.0,
    polar_radius_m = 6356752.314245179,
    vertical_datum = 'WGS84_ELLIPSOID'
where body = 'earth';

update public.world_frames
set reference_frame = 'IAU_MOON_MEAN_SPHERE',
    latitude_type = 'planetocentric',
    longitude_direction = 'positive_east',
    equatorial_radius_m = 1737400.0,
    polar_radius_m = 1737400.0,
    vertical_datum = 'MEAN_RADIUS_1737400_M'
where body = 'moon';

update public.world_frames
set reference_frame = 'IAU_MARS_ELLIPSOID',
    latitude_type = 'planetocentric',
    longitude_direction = 'positive_east',
    equatorial_radius_m = 3396190.0,
    polar_radius_m = 3376200.0,
    vertical_datum = 'IAU_MARS_REFERENCE_ELLIPSOID'
where body = 'mars';

-- Real terrain source catalogue. These rows register provenance and resolution;
-- status stays catalogued until actual raster tiles are ingested and validated.
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
from public.locations l where lower(l.slug) in ('earth','erde')
on conflict (id) do update set
  location_id = excluded.location_id,
  source_uri = excluded.source_uri,
  metadata = excluded.metadata;

insert into public.terrain_datasets (
  id, location_id, body, provider, dataset_name, dataset_version, dataset_kind,
  resolution_m, horizontal_reference, vertical_reference, latitude_type,
  source_uri, source_license, access_mode, status, metadata
)
select
  'moon_lro_wac_gld100', l.id, 'moon', 'USGS Astrogeology / NASA LRO', 'LROC WAC DTM GLD100', 'v1.1', 'dem',
  118.45058759, 'IAU_MOON_1737400', 'MEAN_RADIUS_1737400_M', 'planetocentric',
  'https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_WAC_GLD100_DTM_79S79N_100m_v1.1.tif',
  'USGS/PDS public scientific data; retain product provenance',
  'geotiff', 'catalogued',
  jsonb_build_object('provenance','observed','coverage_lat_deg',jsonb_build_array(-79,79),'source_mission','LRO')
from public.locations l where lower(l.slug) in ('moon','mond')
on conflict (id) do update set
  location_id = excluded.location_id,
  source_uri = excluded.source_uri,
  metadata = excluded.metadata;

insert into public.terrain_datasets (
  id, location_id, body, provider, dataset_name, dataset_version, dataset_kind,
  resolution_m, horizontal_reference, vertical_reference, latitude_type,
  source_uri, source_license, access_mode, status, metadata
)
select
  'mars_mgs_mola_463m', l.id, 'mars', 'USGS Astrogeology / NASA MGS', 'MOLA MEGDR Global DEM', '2003-03-21', 'dem',
  463.0, 'IAU_MARS_PLANETOCENTRIC', 'MOLA_GMM2B_AREOID', 'planetocentric',
  'https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif',
  'CC0 / public domain',
  'geotiff', 'catalogued',
  jsonb_build_object('provenance','observed','pixels_per_degree',128,'source_mission','Mars Global Surveyor')
from public.locations l where lower(l.slug) = 'mars'
on conflict (id) do update set
  location_id = excluded.location_id,
  source_uri = excluded.source_uri,
  metadata = excluded.metadata;

update public.world_frames wf
set terrain_dataset_id = case wf.body
  when 'earth' then 'earth_nrw_dgm1'
  when 'moon' then 'moon_lro_wac_gld100'
  when 'mars' then 'mars_mgs_mola_463m'
  else wf.terrain_dataset_id end
where wf.body in ('earth','moon','mars');

-- Terrain resolution metadata travels with a build/entity. z_m is local Up in
-- the world frame; absolute source elevation is kept separately to avoid datum
-- confusion (for example Mars MOLA areoid vs the Mars reference ellipsoid).
alter table public.player_builds
  add column if not exists terrain_dataset_id text references public.terrain_datasets(id) on delete set null,
  add column if not exists terrain_status text not null default 'origin_pending',
  add column if not exists ground_elevation_m double precision,
  add column if not exists terrain_min_elevation_m double precision,
  add column if not exists terrain_max_elevation_m double precision,
  add column if not exists terrain_slope_deg double precision;

alter table public.tile_entities
  add column if not exists terrain_dataset_id text references public.terrain_datasets(id) on delete set null,
  add column if not exists terrain_status text not null default 'origin_pending',
  add column if not exists ground_elevation_m double precision,
  add column if not exists terrain_min_elevation_m double precision,
  add column if not exists terrain_max_elevation_m double precision,
  add column if not exists terrain_slope_deg double precision;

alter table public.player_builds drop constraint if exists player_builds_terrain_status_check;
alter table public.player_builds add constraint player_builds_terrain_status_check
  check (terrain_status in ('origin_pending','dataset_pending','unresolved','resolved'));

alter table public.tile_entities drop constraint if exists tile_entities_terrain_status_check;
alter table public.tile_entities add constraint tile_entities_terrain_status_check
  check (terrain_status in ('origin_pending','dataset_pending','unresolved','resolved'));

create or replace function public.noxia_attach_spatial_build_placement()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  b public.player_builds%rowtype;
begin
  if new.entity_type <> 'building' or new.source_build_id is not null then
    return new;
  end if;

  select pb.* into b
  from public.player_builds pb
  where pb.profile_id = new.profile_id
    and pb.location_id = new.location_id
    and pb.buildable_id = new.entity_id
    and pb.target_type = 'building'
    and pb.status = 'complete'
    and pb.placement_mode = 'world'
    and not exists (
      select 1 from public.tile_entities te where te.source_build_id = pb.id
    )
  order by pb.completes_at desc nulls last, pb.id desc
  limit 1;

  if b.id is null then return new; end if;

  new.source_build_id := b.id;
  new.placement_mode := b.placement_mode;
  new.x_m := b.x_m;
  new.y_m := b.y_m;
  new.z_m := b.z_m;
  new.rotation_deg := coalesce(b.rotation_deg, 0);
  new.footprint_width_m := b.footprint_width_m;
  new.footprint_depth_m := b.footprint_depth_m;
  new.site_id := b.site_id;
  new.terrain_dataset_id := b.terrain_dataset_id;
  new.terrain_status := b.terrain_status;
  new.ground_elevation_m := b.ground_elevation_m;
  new.terrain_min_elevation_m := b.terrain_min_elevation_m;
  new.terrain_max_elevation_m := b.terrain_max_elevation_m;
  new.terrain_slope_deg := b.terrain_slope_deg;
  return new;
end;
$$;

comment on table public.terrain_datasets is 'Catalogue of observed DEM/DSM sources and their horizontal/vertical reference systems.';
comment on table public.terrain_tiles is 'Ingested terrain raster tile metadata. Raster bytes live outside relational rows.';
comment on column public.world_frames.origin_status is 'pending until a real, verified planetary/geodetic origin is assigned; no location is invented.';
comment on column public.player_builds.z_m is 'Local ENU Up coordinate. NULL means terrain/foundation height has not yet been resolved.';
