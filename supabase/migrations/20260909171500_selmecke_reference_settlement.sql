do $$
declare
  v_location uuid;
  v_site uuid;
  v_base_x double precision := -1756.26;
  v_base_y double precision := 1376.22;
begin
  select id into v_location from public.locations where slug = 'earth' limit 1;
  if v_location is null then raise exception 'Earth location not found'; end if;

  select id into v_site
  from public.build_sites
  where location_id = v_location
    and metadata ->> 'canonical' = 'noxia-earth-selmecke-reference-v1'
  limit 1;

  if v_site is null then
    insert into public.build_sites (
      location_id, site_type, name, origin_x_m, origin_y_m, origin_z_m,
      width_m, depth_m, rotation_deg, metadata
    ) values (
      v_location, 'district', 'Selmecke · Referenzstandort',
      v_base_x, v_base_y, 0, 900, 500, 0,
      jsonb_build_object(
        'canonical','noxia-earth-selmecke-reference-v1',
        'kind','reference_settlement',
        'ownership','STATE',
        'region','earth-sauerland',
        'geo_lat',51.33745,
        'geo_lon',7.97975,
        'description','Staatlicher NOXIA-Referenzstandort mit Basissystemen und Raumhafen.'
      )
    ) returning id into v_site;
  end if;

  with ranked as (
    select te.id, te.entity_id,
           row_number() over (partition by te.entity_id order by te.id) as rn
    from public.tile_entities te
    where te.location_id = v_location
      and te.is_state_owned = true
      and te.placement_mode = 'legacy_tile'
  ), layout(entity_id,rn,dx,dy,rotation_deg,width_m,depth_m) as (values
    ('admin'::text,                  1, -100.0,  45.0,   0.0, 24.0, 24.0),
    ('school'::text,                 1,  -60.0,  45.0,   0.0, 24.0, 24.0),
    ('bank'::text,                   1,  -20.0,  45.0,   0.0, 24.0, 24.0),
    ('warehouse'::text,              1,   35.0,  45.0,   0.0, 36.0, 28.0),
    ('warehouse_storage'::text,      1,   82.0,  45.0,   0.0, 36.0, 28.0),
    ('shipyard'::text,               1,  100.0, -10.0,   0.0, 42.0, 30.0),
    ('spaceport_core'::text,         1,  180.0,  80.0,   0.0, 52.0, 38.0),
    ('spaceport_pad_mini'::text,     1,  270.0,  85.0,   0.0, 70.0, 55.0),
    ('spaceport_service'::text,      1,  180.0,  15.0,   0.0, 64.0, 42.0),
    ('spaceport_storage'::text,      1,  270.0,  10.0,   0.0, 72.0, 48.0),
    ('spaceport_pad_standard'::text, 1,  390.0,  75.0,   0.0,120.0, 90.0),
    ('spaceport_pad_standard'::text, 2,  390.0, -70.0,   0.0,120.0, 90.0)
  )
  update public.tile_entities te
  set site_id = v_site,
      placement_mode = 'world',
      tile_row = null,
      tile_col = null,
      x_m = v_base_x + l.dx,
      y_m = v_base_y + l.dy,
      z_m = 0,
      rotation_deg = l.rotation_deg,
      footprint_width_m = l.width_m,
      footprint_depth_m = l.depth_m,
      terrain_status = 'unresolved'
  from ranked r
  join layout l on l.entity_id = r.entity_id and l.rn = r.rn
  where te.id = r.id;

  insert into public.tile_entities (
    location_id, site_id, entity_type, entity_id, status, condition,
    is_state_owned, owner_class, placement_mode, x_m, y_m, z_m,
    rotation_deg, footprint_width_m, footprint_depth_m, terrain_status
  )
  select v_location, v_site, 'building', seed.entity_id, 'active', 100,
         true, 'STATE', 'world', v_base_x + seed.dx, v_base_y + seed.dy, 0,
         seed.rotation_deg, seed.width_m, seed.depth_m, 'unresolved'
  from (values
    ('residential_block'::text, -90.0, -25.0, 0.0, 28.0, 22.0),
    ('habitat'::text,           -50.0, -25.0, 0.0, 28.0, 22.0),
    ('laboratory'::text,        -10.0, -25.0, 0.0, 32.0, 24.0),
    ('factory'::text,            35.0, -30.0, 0.0, 42.0, 30.0),
    ('solar'::text,              55.0, -90.0, 0.0, 60.0, 40.0),
    ('scanner'::text,          -135.0, -30.0, 0.0, 24.0, 24.0)
  ) as seed(entity_id,dx,dy,rotation_deg,width_m,depth_m)
  where not exists (
    select 1 from public.tile_entities te
    where te.site_id = v_site and te.entity_id = seed.entity_id
  );
end $$;
