-- Canonical geodetic positions for planetary world objects.
-- Earth uses WGS84 latitude/longitude as the source of truth. Local x/y remain
-- derived caches for metre-scale rendering, collision and construction work.

alter table public.tile_entities
  add column if not exists latitude_deg double precision,
  add column if not exists longitude_deg double precision,
  add column if not exists altitude_m double precision,
  add column if not exists spatial_region_id text;

alter table public.player_builds
  add column if not exists latitude_deg double precision,
  add column if not exists longitude_deg double precision,
  add column if not exists altitude_m double precision,
  add column if not exists spatial_region_id text;

comment on column public.tile_entities.latitude_deg is 'Canonical body-fixed geodetic latitude. Earth rows use WGS84.';
comment on column public.tile_entities.longitude_deg is 'Canonical body-fixed geodetic longitude, positive east. Earth rows use WGS84.';
comment on column public.tile_entities.altitude_m is 'Canonical geodetic altitude when resolved; null is allowed while terrain height is unresolved.';
comment on column public.tile_entities.spatial_region_id is 'Optional view/cache affinity only; never the canonical position.';
comment on column public.player_builds.latitude_deg is 'Canonical body-fixed geodetic latitude. Earth rows use WGS84.';
comment on column public.player_builds.longitude_deg is 'Canonical body-fixed geodetic longitude, positive east. Earth rows use WGS84.';
comment on column public.player_builds.altitude_m is 'Canonical geodetic altitude when resolved; null is allowed while terrain height is unresolved.';
comment on column public.player_builds.spatial_region_id is 'Optional view/cache affinity only; never the canonical position.';

alter table public.tile_entities
  drop constraint if exists tile_entities_latitude_deg_check,
  drop constraint if exists tile_entities_longitude_deg_check,
  add constraint tile_entities_latitude_deg_check check (latitude_deg is null or latitude_deg between -90 and 90),
  add constraint tile_entities_longitude_deg_check check (longitude_deg is null or longitude_deg between -180 and 180);

alter table public.player_builds
  drop constraint if exists player_builds_latitude_deg_check,
  drop constraint if exists player_builds_longitude_deg_check,
  add constraint player_builds_latitude_deg_check check (latitude_deg is null or latitude_deg between -90 and 90),
  add constraint player_builds_longitude_deg_check check (longitude_deg is null or longitude_deg between -180 and 180);

create index if not exists tile_entities_location_geodetic_idx
  on public.tile_entities(location_id, latitude_deg, longitude_deg)
  where latitude_deg is not null and longitude_deg is not null;

create index if not exists player_builds_location_geodetic_idx
  on public.player_builds(location_id, latitude_deg, longitude_deg)
  where latitude_deg is not null and longitude_deg is not null;

-- Legacy Earth world-space x/y values were derived from the Sauerland local
-- projection anchored at 51.325 N / 8.005 E. Convert them once to canonical
-- WGS84 latitude/longitude. R matches lib/world/spatial/earthSpatial.ts.
with earth_location as (
  select id from public.locations where slug = 'earth' limit 1
)
update public.tile_entities te
set latitude_deg = 51.325 + (te.y_m / 6371008.8) * 180.0 / pi(),
    longitude_deg = mod(
      ((8.005 + (te.x_m / (6371008.8 * cos(radians(51.325)))) * 180.0 / pi()) + 540.0)::numeric,
      360.0::numeric
    )::double precision - 180.0,
    spatial_region_id = coalesce(te.spatial_region_id, 'earth-sauerland')
from earth_location e
where te.location_id = e.id
  and te.placement_mode = 'world'
  and te.x_m is not null
  and te.y_m is not null
  and (te.latitude_deg is null or te.longitude_deg is null);

with earth_location as (
  select id from public.locations where slug = 'earth' limit 1
)
update public.player_builds pb
set latitude_deg = 51.325 + (pb.y_m / 6371008.8) * 180.0 / pi(),
    longitude_deg = mod(
      ((8.005 + (pb.x_m / (6371008.8 * cos(radians(51.325)))) * 180.0 / pi()) + 540.0)::numeric,
      360.0::numeric
    )::double precision - 180.0,
    spatial_region_id = coalesce(pb.spatial_region_id, 'earth-sauerland')
from earth_location e
where pb.location_id = e.id
  and pb.placement_mode = 'world'
  and pb.x_m is not null
  and pb.y_m is not null
  and (pb.latitude_deg is null or pb.longitude_deg is null);

-- Compatibility completion trigger: old completion call sites may still insert
-- only the legacy entity identity. Carry canonical geodetic placement from the
-- build order together with the local cache and terrain provenance.
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
  new.latitude_deg := b.latitude_deg;
  new.longitude_deg := b.longitude_deg;
  new.altitude_m := b.altitude_m;
  new.spatial_region_id := b.spatial_region_id;
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
