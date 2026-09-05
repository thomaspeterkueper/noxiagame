-- NOXIA Earth height reference
--
-- Earth terrain/building elevations are canonical normal heights in DHHN2016/NHN
-- (displayed to players as metres above sea level / "m ü. NHN").
--
-- Important: world_frames.vertical_datum remains WGS84_ELLIPSOID for the
-- geodetic/ECEF coordinate transform. NHN is a physical terrain-height datum,
-- not an ellipsoidal coordinate height; conflating the two would introduce a
-- geoid-separation error into LOCAL_ENU transforms.

update public.terrain_datasets
set vertical_reference = 'DHHN2016_NHN',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'height_reference', 'DHHN2016_NHN',
      'height_type', 'normal_height',
      'display_unit', 'm ü. NHN',
      'display_label_de', 'Meter über Meereshöhe (NHN)',
      'coordinate_transform_height_reference', 'WGS84_ELLIPSOID'
    ),
    updated_at = now()
where id = 'earth_nrw_dgm1';

-- Keep the coordinate-transform datum explicit. Terrain heights come from the
-- linked terrain dataset and therefore use DHHN2016/NHN on Earth.
update public.world_frames
set vertical_datum = 'WGS84_ELLIPSOID'
where body = 'earth';

comment on column public.world_frames.vertical_datum is
  'Reference surface used for planetary/geodetic coordinate transforms. On Earth this is WGS84_ELLIPSOID; terrain/display heights use the linked terrain dataset (DHHN2016/NHN).';

comment on column public.terrain_datasets.vertical_reference is
  'Physical elevation datum of the terrain raster. Earth DGM1 uses DHHN2016/NHN; this is distinct from the WGS84 ellipsoid used for coordinate transforms.';

comment on column public.player_builds.ground_elevation_m is
  'Absolute terrain elevation in the linked terrain dataset vertical datum; on Earth this is metres above NHN (DHHN2016).';

comment on column public.tile_entities.ground_elevation_m is
  'Absolute terrain elevation in the linked terrain dataset vertical datum; on Earth this is metres above NHN (DHHN2016).';
