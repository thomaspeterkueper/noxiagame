-- NOXIA spatial world model v1
-- Replaces the 32x24 grid as world-space source of truth while keeping legacy tile
-- coordinates nullable during migration.
-- Existing parent_id + slot relations remain canonical for building expansions.

create table if not exists public.location_spatial_frames (
  location_id uuid primary key references public.locations(id) on delete cascade,
  celestial_body text not null default 'earth',
  coordinate_system text not null default 'local-meters',
  origin_lat_deg double precision,
  origin_lon_deg double precision,
  origin_alt_m double precision not null default 0,
  extent_width_m double precision,
  extent_height_m double precision,
  canonical_seed bigint not null default 1,
  observed_source jsonb not null default '{}'::jsonb,
  derived_source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint location_spatial_frames_body_check
    check (celestial_body in ('earth','moon','mars','phobos','other')),
  constraint location_spatial_frames_coord_check
    check (coordinate_system in ('local-meters','planetocentric-local-meters'))
);

create table if not exists public.build_sites (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  parent_site_id uuid references public.build_sites(id) on delete cascade,
  name text not null,
  site_type text not null default 'parcel',
  center_x_m double precision not null,
  center_y_m double precision not null,
  center_z_m double precision not null default 0,
  width_m double precision,
  depth_m double precision,
  rotation_deg double precision not null default 0,
  footprint jsonb,
  build_grid jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint build_sites_type_check
    check (site_type in ('parcel','campus','district','building-interior','platform','pad','subsurface')),
  constraint build_sites_dimensions_check
    check ((width_m is null or width_m > 0) and (depth_m is null or depth_m > 0))
);

create index if not exists idx_build_sites_location on public.build_sites(location_id);
create index if not exists idx_build_sites_parent on public.build_sites(parent_site_id);

alter table public.tile_entities
  add column if not exists x_m double precision,
  add column if not exists y_m double precision,
  add column if not exists z_m double precision not null default 0,
  add column if not exists rotation_deg double precision not null default 0,
  add column if not exists footprint_width_m double precision,
  add column if not exists footprint_depth_m double precision,
  add column if not exists footprint jsonb,
  add column if not exists site_id uuid references public.build_sites(id) on delete set null;

create index if not exists idx_tile_entities_spatial_xy
  on public.tile_entities(location_id, x_m, y_m)
  where x_m is not null and y_m is not null;
create index if not exists idx_tile_entities_site on public.tile_entities(site_id);
create index if not exists idx_tile_entities_parent_slot
  on public.tile_entities(parent_id, slot)
  where parent_id is not null;

alter table public.player_builds
  add column if not exists x_m double precision,
  add column if not exists y_m double precision,
  add column if not exists z_m double precision not null default 0,
  add column if not exists rotation_deg double precision not null default 0,
  add column if not exists site_id uuid references public.build_sites(id) on delete set null;

create index if not exists idx_player_builds_spatial_xy
  on public.player_builds(location_id, x_m, y_m)
  where x_m is not null and y_m is not null;
create index if not exists idx_player_builds_parent_slot
  on public.player_builds(parent_id, slot)
  where parent_id is not null;

-- Legacy bridge: existing tiles receive deterministic local-meter coordinates.
-- This is compatibility only; new builds should write x_m/y_m directly.
update public.tile_entities
set x_m = tile_col * 100.0,
    y_m = tile_row * 100.0
where x_m is null
  and y_m is null
  and tile_col is not null
  and tile_row is not null;

update public.player_builds
set x_m = tile_col * 100.0,
    y_m = tile_row * 100.0
where x_m is null
  and y_m is null
  and tile_col is not null
  and tile_row is not null;

comment on table public.location_spatial_frames is
  'Canonical per-location spatial reference. Observed real-world/planetary data, derived layers and simulated state remain separable.';
comment on table public.build_sites is
  'Continuous world-space build areas. build_grid is optional and only for local gameplay such as building/campus expansion.';
comment on column public.tile_entities.x_m is
  'Canonical local east/west position in meters. Legacy tile_col remains compatibility data only.';
comment on column public.tile_entities.y_m is
  'Canonical local north/south position in meters. Legacy tile_row remains compatibility data only.';
comment on column public.tile_entities.site_id is
  'Optional continuous build site. Building expansions continue to use canonical parent_id + slot.';
