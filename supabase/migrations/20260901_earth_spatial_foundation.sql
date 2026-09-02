-- NOXIA Earth spatial foundation
-- Geodetic + chunked + temporal world state. No fixed 32x24 world extent.

create table if not exists public.spatial_regions (
  id text primary key,
  world_id text not null default 'earth',
  name text not null,
  origin_lat double precision not null check (origin_lat between -90 and 90),
  origin_lon double precision not null check (origin_lon between -180 and 180),
  chunk_size_m integer not null default 1000 check (chunk_size_m > 0),
  cell_size_m integer not null default 10 check (cell_size_m > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spatial_regions_chunk_cell_check check (chunk_size_m % cell_size_m = 0)
);

create table if not exists public.spatial_features (
  id uuid primary key default gen_random_uuid(),
  world_id text not null default 'earth',
  region_id text references public.spatial_regions(id) on delete set null,
  feature_type text not null,
  geometry_kind text not null check (geometry_kind in ('point','line','polygon')),

  -- Canonical interchange geometry. Coordinates are lon/lat in a WGS84-like
  -- geodetic frame. PostGIS can be added later without changing this contract.
  geometry_geojson jsonb not null,

  -- Cached bounds for cheap viewport/chunk filtering before PostGIS adoption.
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,

  -- Optional chunk hints. Features may span several chunks; these identify the
  -- anchor/primary chunk only and are never a world-boundary invariant.
  chunk_x integer,
  chunk_y integer,

  properties jsonb not null default '{}'::jsonb,
  source_provider text,
  source_dataset text,
  source_id text,
  source_license text,

  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint spatial_features_time_check check (
    valid_to is null or valid_from is null or valid_to > valid_from
  ),
  constraint spatial_features_bbox_lat_check check (
    (min_lat is null or min_lat between -90 and 90) and
    (max_lat is null or max_lat between -90 and 90)
  ),
  constraint spatial_features_bbox_lon_check check (
    (min_lon is null or min_lon between -180 and 180) and
    (max_lon is null or max_lon between -180 and 180)
  )
);

create index if not exists spatial_features_region_chunk_idx
  on public.spatial_features(region_id, chunk_x, chunk_y);

create index if not exists spatial_features_type_idx
  on public.spatial_features(world_id, feature_type);

create index if not exists spatial_features_validity_idx
  on public.spatial_features(valid_from, valid_to);

create index if not exists spatial_features_bbox_idx
  on public.spatial_features(min_lat, max_lat, min_lon, max_lon);

create table if not exists public.spatial_entity_anchors (
  entity_type text not null,
  entity_id uuid not null,
  spatial_feature_id uuid not null references public.spatial_features(id) on delete cascade,
  relation text not null default 'footprint',
  created_at timestamptz not null default now(),
  primary key (entity_type, entity_id, spatial_feature_id, relation)
);

comment on table public.spatial_regions is
  'Streaming/projection anchors for a geodetic world. Regions do not bound the world.';
comment on table public.spatial_features is
  'Temporal real-world and gameplay spatial features; canonical geometry is independent of renderer.';
comment on table public.spatial_entity_anchors is
  'Links runtime entities to one or more spatial geometries/footprints.';

alter table public.spatial_regions enable row level security;
alter table public.spatial_features enable row level security;
alter table public.spatial_entity_anchors enable row level security;

-- World geography is readable by authenticated players. Runtime writes remain
-- server/service-role authoritative.
drop policy if exists spatial_regions_authenticated_read on public.spatial_regions;
create policy spatial_regions_authenticated_read
  on public.spatial_regions for select
  to authenticated
  using (true);

drop policy if exists spatial_features_authenticated_read on public.spatial_features;
create policy spatial_features_authenticated_read
  on public.spatial_features for select
  to authenticated
  using (true);

drop policy if exists spatial_entity_anchors_authenticated_read on public.spatial_entity_anchors;
create policy spatial_entity_anchors_authenticated_read
  on public.spatial_entity_anchors for select
  to authenticated
  using (true);
