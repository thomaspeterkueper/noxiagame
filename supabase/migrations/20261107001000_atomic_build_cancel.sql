-- #615: cancellation is atomic and refuses to infer refunds from mutable prices.
-- Draft migration: deployment requires backfill policy and integration tests.
alter table public.player_builds
  add column if not exists refund_credits_snapshot integer;

-- A snapshot is optional for legacy rows, but must never be negative.
-- A missing snapshot prevents cancellation rather than guessing a refund.
-- PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS. Avoid a duplicate
-- constraint failure when the draft is re-applied in a disposable test DB.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.player_builds'::regclass
      and conname = 'player_builds_refund_snapshot_nonnegative'
  ) then
    alter table public.player_builds
      add constraint player_builds_refund_snapshot_nonnegative
      check (refund_credits_snapshot is null or refund_credits_snapshot >= 0);
  end if;
end $$;

-- Preserve the original atomic start command and snapshot the agreed 50% refund
-- in the SAME transaction as the build insert and credit debit. Source:
-- 20260910081500_atomic_game_commands.sql (only cost validation and insert changed).
create or replace function public.noxia_start_build(
  p_profile_id uuid,
  p_buildable_id text,
  p_location_id uuid,
  p_cost_credits integer,
  p_completes_at timestamptz,
  p_tile_level smallint default 0,
  p_tile_row integer default null,
  p_tile_col integer default null,
  p_placement_mode text default null,
  p_x_m double precision default null,
  p_y_m double precision default null,
  p_z_m double precision default null,
  p_rotation_deg double precision default 0,
  p_footprint_width_m double precision default null,
  p_footprint_depth_m double precision default null,
  p_site_id uuid default null,
  p_terrain_dataset_id text default null,
  p_terrain_status text default 'origin_pending',
  p_ground_elevation_m double precision default null,
  p_terrain_min_elevation_m double precision default null,
  p_terrain_max_elevation_m double precision default null,
  p_terrain_slope_deg double precision default null,
  p_latitude_deg double precision default null,
  p_longitude_deg double precision default null,
  p_altitude_m double precision default null,
  p_spatial_region_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_build public.player_builds%rowtype;
begin
  if p_profile_id is null or p_buildable_id is null or p_location_id is null then
    raise exception 'NOXIA_BUILD_REQUIRED_ARGUMENT_MISSING' using errcode = 'P0001';
  end if;
  if p_cost_credits is null or p_cost_credits < 0 then
    raise exception 'NOXIA_BUILD_INVALID_CREDIT_COST' using errcode = 'P0001';
  end if;
  if p_completes_at is null then
    raise exception 'NOXIA_BUILD_COMPLETION_REQUIRED' using errcode = 'P0001';
  end if;
  if p_placement_mode is not null and p_placement_mode not in ('legacy_tile', 'world') then
    raise exception 'NOXIA_BUILD_INVALID_PLACEMENT_MODE:%', p_placement_mode using errcode = 'P0001';
  end if;
  if p_placement_mode = 'world' and (p_latitude_deg is null or p_longitude_deg is null) then
    -- World builds use canonical body-fixed coordinates. Local x/y are caches.
    raise exception 'NOXIA_BUILD_WORLD_GEODETIC_REQUIRED' using errcode = 'P0001';
  end if;

  select credits into v_credits
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_credits < p_cost_credits then
    raise exception 'NOXIA_BUILD_CREDITS_INSUFFICIENT:%:%', v_credits, p_cost_credits using errcode = 'P0001';
  end if;

  insert into public.player_builds (
    profile_id, buildable_id, target_type, location_id,
    tile_level, tile_row, tile_col, status, completes_at, refund_credits_snapshot,
    placement_mode, x_m, y_m, z_m, rotation_deg,
    footprint_width_m, footprint_depth_m, site_id,
    terrain_dataset_id, terrain_status, ground_elevation_m,
    terrain_min_elevation_m, terrain_max_elevation_m, terrain_slope_deg,
    latitude_deg, longitude_deg, altitude_m, spatial_region_id
  ) values (
    p_profile_id, p_buildable_id, 'building', p_location_id,
    p_tile_level, p_tile_row, p_tile_col, 'building', p_completes_at, p_cost_credits / 2,
    coalesce(p_placement_mode, case when p_tile_row is not null and p_tile_col is not null then 'legacy_tile' else null end),
    p_x_m, p_y_m, p_z_m, coalesce(p_rotation_deg, 0),
    p_footprint_width_m, p_footprint_depth_m, p_site_id,
    p_terrain_dataset_id, coalesce(p_terrain_status, 'origin_pending'), p_ground_elevation_m,
    p_terrain_min_elevation_m, p_terrain_max_elevation_m, p_terrain_slope_deg,
    p_latitude_deg, p_longitude_deg, p_altitude_m, p_spatial_region_id
  ) returning * into v_build;

  -- The existing noxia_consume_build_resources() BEFORE INSERT trigger has
  -- already locked and consumed material stocks at this point. Any failure in
  -- either operation rolls the whole function back.
  update public.profiles
  set credits = credits - p_cost_credits
  where id = p_profile_id
  returning credits into v_credits;

  return jsonb_build_object(
    'build_id', v_build.id,
    'status', v_build.status,
    'completes_at', v_build.completes_at,
    'credits', v_credits
  );
end;
$$;

create or replace function public.noxia_cancel_build(p_profile_id uuid, p_build_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_build public.player_builds%rowtype;
  v_credits integer;
begin
  if p_profile_id is null or p_build_id is null then
    raise exception 'NOXIA_CANCEL_REQUIRED_ARGUMENT_MISSING' using errcode = 'P0001';
  end if;
  select * into v_build from public.player_builds
  where id = p_build_id for update;
  if not found or v_build.profile_id is distinct from p_profile_id then
    raise exception 'NOXIA_CANCEL_BUILD_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_build.target_type is distinct from 'building' then
    raise exception 'NOXIA_CANCEL_TARGET_INVALID:%', v_build.target_type using errcode = 'P0001';
  end if;
  if v_build.status = 'cancelled' then
    return jsonb_build_object('build_id', v_build.id, 'status', 'cancelled',
      'refund', 0, 'idempotent', true);
  end if;
  if v_build.status is distinct from 'building' then
    raise exception 'NOXIA_CANCEL_INVALID_STATUS:%', v_build.status using errcode = 'P0001';
  end if;
  if v_build.refund_credits_snapshot is null
     or v_build.refund_credits_snapshot < 0 then
    raise exception 'NOXIA_CANCEL_REFUND_SNAPSHOT_REQUIRED' using errcode = 'P0001';
  end if;
  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'NOXIA_CANCEL_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;
  update public.player_builds set status = 'cancelled'
  where id = v_build.id and status = 'building';
  update public.profiles
  set credits = credits + v_build.refund_credits_snapshot
  where id = p_profile_id returning credits into v_credits;
  return jsonb_build_object('build_id', v_build.id, 'status', 'cancelled',
    'refund', v_build.refund_credits_snapshot, 'credits', v_credits,
    'idempotent', false);
end;
$$;
revoke all on function public.noxia_cancel_build(uuid,uuid) from public, anon, authenticated;
grant execute on function public.noxia_cancel_build(uuid,uuid) to service_role;
