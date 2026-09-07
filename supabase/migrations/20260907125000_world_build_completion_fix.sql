-- World-building completion reconciliation.
--
-- The original tile placement constraint pre-dates metric world placement and
-- still required tile_row/tile_col for root buildings. Spatial build orders
-- deliberately have no synthetic tile coordinates, so completion could mark a
-- build complete and then reject the corresponding tile_entities insert.

alter table public.tile_entities
  drop constraint if exists te_placement_check;

alter table public.tile_entities
  add constraint te_placement_check
  check (
    (parent_id is not null and slot is not null)
    or (parent_id is null and entity_type = 'ship')
    or (parent_id is null and entity_type = 'module' and location_id is not null)
    or (parent_id is null and tile_row is not null and tile_col is not null)
    or (
      parent_id is null
      and entity_type = 'building'
      and placement_mode = 'world'
      and x_m is not null
      and y_m is not null
    )
  );

-- Keep the compatibility completion trigger authoritative for old completion
-- call sites. Besides x/y and footprint it now carries the full terrain
-- provenance into the persistent world entity.
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
  new.terrain_dataset_id := b.terrain_dataset_id;
  new.terrain_status := b.terrain_status;
  new.ground_elevation_m := b.ground_elevation_m;
  new.terrain_min_elevation_m := b.terrain_min_elevation_m;
  new.terrain_max_elevation_m := b.terrain_max_elevation_m;
  new.terrain_slope_deg := b.terrain_slope_deg;
  return new;
end;
$$;
