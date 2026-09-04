-- NOXIA spatial build model v1
-- World coordinates are metric and continuous. Legacy tile coordinates remain
-- nullable compatibility data and are no longer the authoritative world model.

create table if not exists public.world_frames (
  location_id uuid primary key references public.locations(id) on delete cascade,
  body text not null default 'other',
  coordinate_system text not null default 'LOCAL_ENU_METERS',
  origin_lat_deg double precision,
  origin_lon_deg double precision,
  origin_alt_m double precision,
  world_seed text not null,
  observed_source jsonb not null default '{}'::jsonb,
  derived_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_frames_body_check check (body in ('earth','moon','mars','other'))
);

create table if not exists public.build_sites (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  parent_entity_id uuid references public.tile_entities(id) on delete cascade,
  site_type text not null default 'parcel',
  name text,
  origin_x_m double precision not null default 0,
  origin_y_m double precision not null default 0,
  origin_z_m double precision not null default 0,
  width_m double precision not null,
  depth_m double precision not null,
  rotation_deg double precision not null default 0,
  slot_layout jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint build_sites_dimensions_check check (width_m > 0 and depth_m > 0)
);

alter table public.tile_entities
  add column if not exists placement_mode text,
  add column if not exists x_m double precision,
  add column if not exists y_m double precision,
  add column if not exists z_m double precision,
  add column if not exists rotation_deg double precision not null default 0,
  add column if not exists footprint_width_m double precision,
  add column if not exists footprint_depth_m double precision,
  add column if not exists site_id uuid references public.build_sites(id) on delete set null,
  add column if not exists parent_entity_id uuid references public.tile_entities(id) on delete cascade,
  add column if not exists slot_key text;

alter table public.player_builds
  add column if not exists placement_mode text,
  add column if not exists x_m double precision,
  add column if not exists y_m double precision,
  add column if not exists z_m double precision,
  add column if not exists rotation_deg double precision not null default 0,
  add column if not exists footprint_width_m double precision,
  add column if not exists footprint_depth_m double precision,
  add column if not exists site_id uuid references public.build_sites(id) on delete set null,
  add column if not exists parent_entity_id uuid references public.tile_entities(id) on delete cascade,
  add column if not exists slot_key text;

-- Backfill only the semantic mode. We deliberately do not manufacture metre
-- coordinates from the old 32x24 grid because that would turn a rendering grid
-- into false physical data.
update public.tile_entities
set placement_mode = 'legacy_tile'
where placement_mode is null and tile_row is not null and tile_col is not null;

update public.player_builds
set placement_mode = 'legacy_tile'
where placement_mode is null and tile_row is not null and tile_col is not null;

create index if not exists tile_entities_spatial_location_idx
  on public.tile_entities(location_id, x_m, y_m)
  where placement_mode = 'world';

create index if not exists tile_entities_parent_idx
  on public.tile_entities(parent_entity_id)
  where parent_entity_id is not null;

create unique index if not exists tile_entities_parent_slot_uidx
  on public.tile_entities(parent_entity_id, slot_key)
  where parent_entity_id is not null and slot_key is not null;

create unique index if not exists tile_entities_site_slot_uidx
  on public.tile_entities(site_id, slot_key)
  where site_id is not null and slot_key is not null and parent_entity_id is null;

create index if not exists player_builds_spatial_location_idx
  on public.player_builds(location_id, x_m, y_m)
  where placement_mode = 'world' and status in ('building','selling');

create unique index if not exists player_builds_parent_slot_active_uidx
  on public.player_builds(parent_entity_id, slot_key)
  where parent_entity_id is not null and slot_key is not null and status = 'building';

create unique index if not exists player_builds_site_slot_active_uidx
  on public.player_builds(site_id, slot_key)
  where site_id is not null and slot_key is not null and parent_entity_id is null and status = 'building';

comment on table public.world_frames is 'Planetary/local metric coordinate reference and provenance for a NOXIA location.';
comment on table public.build_sites is 'Explicit buildable parcels or internal expansion surfaces; optional slot_layout supports Civilization-style building expansion.';
comment on column public.tile_entities.placement_mode is 'legacy_tile | world | site_slot | child';
