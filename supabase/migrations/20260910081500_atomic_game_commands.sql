-- NOXIA atomic game commands v1
-- 2026-09-10
--
-- Establishes PostgreSQL transaction boundaries for multi-row game-state
-- mutations. Existing event-stream, tick scheduling and build-resource triggers
-- remain authoritative and are intentionally reused rather than duplicated.

set search_path to public;

-- ══════════════════════════════════════════════════════════════════════════════
-- BUILD START
-- Credits + player_build insert + the existing BEFORE INSERT resource trigger
-- run inside one PostgreSQL transaction.
-- ══════════════════════════════════════════════════════════════════════════════
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
  if p_cost_credits < 0 then
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
    tile_level, tile_row, tile_col, status, completes_at,
    placement_mode, x_m, y_m, z_m, rotation_deg,
    footprint_width_m, footprint_depth_m, site_id,
    terrain_dataset_id, terrain_status, ground_elevation_m,
    terrain_min_elevation_m, terrain_max_elevation_m, terrain_slope_deg,
    latitude_deg, longitude_deg, altitude_m, spatial_region_id
  ) values (
    p_profile_id, p_buildable_id, 'building', p_location_id,
    p_tile_level, p_tile_row, p_tile_col, 'building', p_completes_at,
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

-- ══════════════════════════════════════════════════════════════════════════════
-- BUILD COMPLETION
-- Build state and materialized world entity become visible atomically.
-- Idempotent: repeated completion returns the already-created entity.
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.noxia_complete_build(
  p_build_id uuid,
  p_create_entity boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_build public.player_builds%rowtype;
  v_entity_id uuid;
begin
  select * into v_build
  from public.player_builds
  where id = p_build_id
  for update;

  if not found then
    raise exception 'NOXIA_BUILD_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_build.target_type is distinct from 'building' then
    raise exception 'NOXIA_BUILD_TARGET_INVALID:%', v_build.target_type using errcode = 'P0001';
  end if;

  select id into v_entity_id
  from public.tile_entities
  where source_build_id = v_build.id
  limit 1;

  if v_build.status = 'complete' then
    if p_create_entity and v_entity_id is null then
      -- Repair a legacy partial completion in the same authoritative form.
      insert into public.tile_entities (
        profile_id, location_id, tile_level, tile_row, tile_col,
        entity_type, entity_id, owner_class, owner_id, source_build_id,
        placement_mode, x_m, y_m, z_m, rotation_deg,
        footprint_width_m, footprint_depth_m, site_id,
        terrain_dataset_id, terrain_status, ground_elevation_m,
        terrain_min_elevation_m, terrain_max_elevation_m, terrain_slope_deg,
        latitude_deg, longitude_deg, altitude_m, spatial_region_id
      ) values (
        v_build.profile_id, v_build.location_id, v_build.tile_level, v_build.tile_row, v_build.tile_col,
        'building', v_build.buildable_id, 'PLAYER', v_build.profile_id, v_build.id,
        v_build.placement_mode, v_build.x_m, v_build.y_m, v_build.z_m, coalesce(v_build.rotation_deg, 0),
        v_build.footprint_width_m, v_build.footprint_depth_m, v_build.site_id,
        v_build.terrain_dataset_id, v_build.terrain_status, v_build.ground_elevation_m,
        v_build.terrain_min_elevation_m, v_build.terrain_max_elevation_m, v_build.terrain_slope_deg,
        v_build.latitude_deg, v_build.longitude_deg, v_build.altitude_m, v_build.spatial_region_id
      ) returning id into v_entity_id;
    end if;

    return jsonb_build_object('build_id', v_build.id, 'status', 'complete', 'entity_id', v_entity_id, 'idempotent', true);
  end if;

  if v_build.status is distinct from 'building' then
    raise exception 'NOXIA_BUILD_NOT_COMPLETABLE:%', v_build.status using errcode = 'P0001';
  end if;
  if v_build.completes_at > now() then
    raise exception 'NOXIA_BUILD_NOT_DUE:%', v_build.completes_at using errcode = 'P0001';
  end if;

  -- Existing build-event triggers see the canonical transition. If entity
  -- creation fails afterwards, PostgreSQL rolls this update back as well.
  update public.player_builds
  set status = 'complete'
  where id = v_build.id;

  if p_create_entity then
    insert into public.tile_entities (
      profile_id, location_id, tile_level, tile_row, tile_col,
      entity_type, entity_id, owner_class, owner_id, source_build_id,
      placement_mode, x_m, y_m, z_m, rotation_deg,
      footprint_width_m, footprint_depth_m, site_id,
      terrain_dataset_id, terrain_status, ground_elevation_m,
      terrain_min_elevation_m, terrain_max_elevation_m, terrain_slope_deg,
      latitude_deg, longitude_deg, altitude_m, spatial_region_id
    ) values (
      v_build.profile_id, v_build.location_id, v_build.tile_level, v_build.tile_row, v_build.tile_col,
      'building', v_build.buildable_id, 'PLAYER', v_build.profile_id, v_build.id,
      v_build.placement_mode, v_build.x_m, v_build.y_m, v_build.z_m, coalesce(v_build.rotation_deg, 0),
      v_build.footprint_width_m, v_build.footprint_depth_m, v_build.site_id,
      v_build.terrain_dataset_id, v_build.terrain_status, v_build.ground_elevation_m,
      v_build.terrain_min_elevation_m, v_build.terrain_max_elevation_m, v_build.terrain_slope_deg,
      v_build.latitude_deg, v_build.longitude_deg, v_build.altitude_m, v_build.spatial_region_id
    )
    on conflict (source_build_id) where source_build_id is not null do nothing
    returning id into v_entity_id;

    if v_entity_id is null then
      select id into v_entity_id from public.tile_entities where source_build_id = v_build.id limit 1;
    end if;
  end if;

  return jsonb_build_object('build_id', v_build.id, 'status', 'complete', 'entity_id', v_entity_id, 'idempotent', false);
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- SALE COMPLETION
-- Delayed sale status and player payout are one transaction.
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.noxia_complete_sale(
  p_build_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_build public.player_builds%rowtype;
  v_credits integer;
begin
  select * into v_build
  from public.player_builds
  where id = p_build_id
  for update;

  if not found then
    raise exception 'NOXIA_SALE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_build.status = 'sold' then
    select credits into v_credits from public.profiles where id = v_build.profile_id;
    return jsonb_build_object('build_id', v_build.id, 'status', 'sold', 'credits', v_credits, 'idempotent', true);
  end if;
  if v_build.status is distinct from 'selling' then
    raise exception 'NOXIA_SALE_NOT_COMPLETABLE:%', v_build.status using errcode = 'P0001';
  end if;
  if v_build.completes_at > now() then
    raise exception 'NOXIA_SALE_NOT_DUE:%', v_build.completes_at using errcode = 'P0001';
  end if;

  perform 1 from public.profiles where id = v_build.profile_id for update;
  if not found then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.player_builds set status = 'sold' where id = v_build.id;
  update public.profiles
  set credits = credits + coalesce(v_build.sale_payout, 0)
  where id = v_build.profile_id
  returning credits into v_credits;

  return jsonb_build_object('build_id', v_build.id, 'status', 'sold', 'credits', v_credits, 'payout', coalesce(v_build.sale_payout, 0), 'idempotent', false);
end;
$$;

-- These are server commands. Browser clients must go through authenticated API
-- routes; service_role is never exposed client-side.
revoke all on function public.noxia_start_build(uuid,text,uuid,integer,timestamptz,smallint,integer,integer,text,double precision,double precision,double precision,double precision,double precision,double precision,uuid,text,text,double precision,double precision,double precision,double precision,double precision,double precision,double precision,text) from public, anon, authenticated;
revoke all on function public.noxia_complete_build(uuid,boolean) from public, anon, authenticated;
revoke all on function public.noxia_complete_sale(uuid) from public, anon, authenticated;

grant execute on function public.noxia_start_build(uuid,text,uuid,integer,timestamptz,smallint,integer,integer,text,double precision,double precision,double precision,double precision,double precision,double precision,uuid,text,text,double precision,double precision,double precision,double precision,double precision,double precision,double precision,text) to service_role;
grant execute on function public.noxia_complete_build(uuid,boolean) to service_role;
grant execute on function public.noxia_complete_sale(uuid) to service_role;

comment on function public.noxia_start_build(uuid,text,uuid,integer,timestamptz,smallint,integer,integer,text,double precision,double precision,double precision,double precision,double precision,double precision,uuid,text,text,double precision,double precision,double precision,double precision,double precision,double precision,double precision,text) is
  'Atomic NOXIA build-start command: credits, build row and existing authoritative resource-cost trigger share one transaction.';
comment on function public.noxia_complete_build(uuid,boolean) is
  'Atomic/idempotent NOXIA build completion: build status and materialized world entity commit together.';
comment on function public.noxia_complete_sale(uuid) is
  'Atomic/idempotent completion of delayed building sales and player payout.';
