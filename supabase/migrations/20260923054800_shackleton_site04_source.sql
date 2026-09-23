-- Pin the Shackleton high-resolution terrain dataset to the NASA/GSFC PGDA
-- Site04 (Shackleton rim) 5 m LOLA LDEM. Runtime bytes are ingested separately
-- into the private terrain bucket by scripts/import-shackleton-polar-site04.mjs.

update terrain_datasets
set
  dataset_name = 'LOLA Shackleton Rim Site04 5m',
  source_uri = 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'product_key', 'Site04_final_adj_5mpp_surf',
    'site', 'Site04',
    'site_label', 'Shackleton rim',
    'projection', 'south polar stereographic',
    'projection_center_lon_deg', 0,
    'projection_radius_m', 1737400,
    'projection_x_sign', 1,
    'projection_y_sign', 1,
    'stored_scale', 1,
    'stored_offset', 0,
    'source_product_page', 'https://pgda.gsfc.nasa.gov/products/78'
  )
where id = 'moon_lro_lola_south_pole_5m';
