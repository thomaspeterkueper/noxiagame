-- NOXIA spatial build model v1
-- World coordinates are metric and continuous. Legacy tile coordinates remain
-- nullable compatibility data and are no longer the authoritative world model.
-- Existing tile_entities/player_builds parent_id + slot remain canonical for
-- building expansions; this migration does not introduce a second hierarchy.

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
  parent_site_id uuid references public.build_sites(id) on delete cascade,
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

create index if not exists build_sites_location_idx on public.build_sites(location_id);
create index if not exists build_sites_parent_idx on public.build_sites(parent_site_id)
  where parent_site_id is not null;

-- These tables live in the exposed public schema but are accessed through the
-- server-authoritative build API. Keep direct anon/authenticated access closed.
alter table public.world_frames enable row level security;
alter table public.build_sites enable row level security;

alter table public.tile_entities
  add column if not exists placement_mode text,
  add column if not exists x_m double precision,
  add column if not exists y_m double precision,
  add column if not exists z_m double precision,
  add column if not exists rotation_deg double precision not null default 0,
  add column if not exists footprint_width_m double precision,
  add column if not exists footprint_depth_m double precision,
  add column if not exists site_id uuid references public.build_sites(id) on delete set null,
  add column if not exists source_build_id uuid references public.player_builds(id) on delete set null;

alter table public.player_builds
  add column if not exists placement_mode text,
  add column if not exists x_m double precision,
  add column if not exists y_m double precision,
  add column if not exists z_m double precision,
  add column if not exists rotation_deg double precision not null default 0,
  add column if not exists footprint_width_m double precision,
  add column if not exists footprint_depth_m double precision,
  add column if not exists site_id uuid references public.build_sites(id) on delete set null;

-- Backfill only the semantic mode. We deliberately do not manufacture metre
-- coordinates from the old 32x24 grid because that would turn a rendering grid
-- into false physical data.
update public.tile_entities
set placement_mode = 'legacy_tile'
where placement_mode is null and tile_row is not null and tile_col is not null;

update public.player_builds
set placement_mode = 'legacy_tile'
where placement_mode is null and tile_row is not null and tile_col is not null;

alter table public.tile_entities drop constraint if exists tile_entities_placement_mode_check;
alter table public.tile_entities add constraint tile_entities_placement_mode_check
  check (placement_mode is null or placement_mode in ('legacy_tile','world'));

alter table public.player_builds drop constraint if exists player_builds_placement_mode_check;
alter table public.player_builds add constraint player_builds_placement_mode_check
  check (placement_mode is null or placement_mode in ('legacy_tile','world'));

create index if not exists tile_entities_spatial_location_idx
  on public.tile_entities(location_id, x_m, y_m)
  where placement_mode = 'world';

create unique index if not exists tile_entities_source_build_uidx
  on public.tile_entities(source_build_id)
  where source_build_id is not null;

create index if not exists player_builds_spatial_location_idx
  on public.player_builds(location_id, x_m, y_m)
  where placement_mode = 'world' and target_type = 'building' and status in ('building','selling');

-- Existing application/cron completion code creates tile_entities from a
-- player_build row. This trigger enriches that insert with the authoritative
-- metric placement, so old completion paths remain compatible during rollout.
-- It is intentionally SECURITY INVOKER (the default): the caller must already
-- have the privileges required by the existing completion path.
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

  if b.id is null then
    return new;
  end if;

  new.source_build_id := b.id;
  new.placement_mode := b.placement_mode;
  new.x_m := b.x_m;
  new.y_m := b.y_m;
  new.z_m := b.z_m;
  new.rotation_deg := coalesce(b.rotation_deg, 0);
  new.footprint_width_m := b.footprint_width_m;
  new.footprint_depth_m := b.footprint_depth_m;
  new.site_id := b.site_id;
  return new;
end;
$$;

drop trigger if exists trg_noxia_attach_spatial_build_placement on public.tile_entities;
create trigger trg_noxia_attach_spatial_build_placement
before insert on public.tile_entities
for each row execute function public.noxia_attach_spatial_build_placement();

-- Seed deterministic coordinate frames without inventing observations. Exact
-- lat/lon/alt origins are populated only when a real-data adapter provides them.
insert into public.world_frames (location_id, body, world_seed, observed_source, derived_config)
select id,
       case when lower(slug) in ('earth','erde') then 'earth'
            when lower(slug) in ('moon','mond') then 'moon'
            when lower(slug) = 'mars' then 'mars'
            else 'other' end,
       'NOXIA:' || upper(slug) || ':V1',
       jsonb_build_object('provenance','observed','status','origin-pending'),
       jsonb_build_object('provenance','derived','generator','noxia-spatial-v1')
from public.locations
where lower(slug) in ('earth','erde','moon','mond','mars')
on conflict (location_id) do nothing;

comment on table public.world_frames is 'Planetary/local metric coordinate reference and provenance for a NOXIA location.';
comment on table public.build_sites is 'Explicit buildable parcels or local sub-sites. Building expansions continue to use canonical parent_id + slot.';
comment on column public.tile_entities.placement_mode is 'legacy_tile | world';
