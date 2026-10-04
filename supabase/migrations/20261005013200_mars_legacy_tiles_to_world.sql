-- Migrate legacy Mars tile buildings into the shared metric planetary surface.
-- Keeps the existing 32x24 layout, centred around the Tharsis local frame.
-- Only rows without a metric world position are touched.

set search_path to public;

with mars_location as (
  select id from public.locations where slug='mars' limit 1
),
legacy as (
  select
    te.id,
    te.entity_id,
    te.tile_row,
    te.tile_col,
    ((te.tile_col::numeric - 15.5) * 20.0) as next_x_m,
    ((11.5 - te.tile_row::numeric) * 20.0) as next_y_m,
    case te.entity_id
      when 'landing_pad' then 30.0
      when 'factory' then 28.0
      when 'warehouse' then 24.0
      when 'residential_block' then 24.0
      when 'school' then 22.0
      when 'medical_core' then 24.0
      when 'admin' then 20.0
      when 'reactor_module' then 18.0
      when 'water_recycler' then 18.0
      when 'bank' then 16.0
      when 'solar' then 18.0
      when 'black_start' then 14.0
      else 16.0
    end as next_width_m,
    case te.entity_id
      when 'landing_pad' then 30.0
      when 'factory' then 22.0
      when 'warehouse' then 18.0
      when 'residential_block' then 18.0
      when 'school' then 18.0
      when 'medical_core' then 18.0
      when 'admin' then 16.0
      when 'reactor_module' then 18.0
      when 'water_recycler' then 16.0
      when 'bank' then 14.0
      when 'solar' then 14.0
      when 'black_start' then 14.0
      else 16.0
    end as next_depth_m
  from public.tile_entities te
  join mars_location ml on ml.id=te.location_id
  where te.status='active'
    and te.tile_row is not null
    and te.tile_col is not null
    and (te.x_m is null or te.y_m is null)
)
update public.tile_entities te
set
  placement_mode='world',
  x_m=legacy.next_x_m,
  y_m=legacy.next_y_m,
  rotation_deg=coalesce(te.rotation_deg,0),
  footprint_width_m=coalesce(te.footprint_width_m,legacy.next_width_m),
  footprint_depth_m=coalesce(te.footprint_depth_m,legacy.next_depth_m),
  terrain_status=case when te.terrain_status='resolved' then te.terrain_status else 'unresolved' end
from legacy
where te.id=legacy.id;
