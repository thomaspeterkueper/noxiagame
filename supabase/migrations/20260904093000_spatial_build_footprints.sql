-- NOXIA spatial build placement v1
-- Pending build jobs need the same authoritative footprint as completed entities
-- so collision checks stay deterministic while construction is in progress.

alter table public.player_builds
  add column if not exists footprint_width_m double precision,
  add column if not exists footprint_depth_m double precision;

alter table public.player_builds
  drop constraint if exists player_builds_footprint_dimensions_check;

alter table public.player_builds
  add constraint player_builds_footprint_dimensions_check
  check (
    (footprint_width_m is null or footprint_width_m > 0)
    and (footprint_depth_m is null or footprint_depth_m > 0)
  );

comment on column public.player_builds.footprint_width_m is
  'Authoritative world-space construction footprint width in metres.';
comment on column public.player_builds.footprint_depth_m is
  'Authoritative world-space construction footprint depth in metres.';
