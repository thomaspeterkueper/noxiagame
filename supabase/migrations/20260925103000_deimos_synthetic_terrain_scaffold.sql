-- Deimos terrain scaffold (data only -- no playable location yet).
--
-- This dataset is deliberately synthetic. It exists so Deimos can use the
-- common NOXIA terrain pipeline before a compatible observed elevation source
-- is available/ingested. No location row is created here.

alter table public.terrain_datasets drop constraint if exists terrain_datasets_body_check;
alter table public.terrain_datasets add constraint terrain_datasets_body_check
  check (body in ('earth','moon','mars','phobos','deimos','other'));

alter table public.world_frames drop constraint if exists world_frames_body_check;
alter table public.world_frames add constraint world_frames_body_check
  check (body in ('earth','moon','mars','phobos','deimos','other'));

insert into public.terrain_datasets (
  id, location_id, body, provider, dataset_name, dataset_version, dataset_kind,
  resolution_m, horizontal_reference, vertical_reference, latitude_type,
  longitude_direction, source_uri, source_license, access_mode, status, metadata
)
values (
  'deimos_synthetic_v1', null, 'deimos', 'NOXIA (synthetic; not an observed DEM)',
  'Deimos Synthetic Low-Relief Heightfield v1', '2026-09-25', 'dem',
  null, 'DEIMOS_PLANETOCENTRIC', 'DEIMOS_MEAN_RADIUS_6200M', 'planetocentric',
  'positive_east', 'synthetic://deimos/fbm-v1',
  'n/a (procedurally generated, not an observation)',
  'synthetic-procedural', 'ready',
  jsonb_build_object(
    'provenance','synthetic',
    'generator','deimosTerrainAdapter.syntheticDeimosElevationM',
    'real_reference_features', jsonb_build_array('Voltaire','Swift'),
    'real_reference_note', 'Named-feature positions are reference anchors; crater depth/profile are invented for gameplay and are not observations.',
    'adopted_mean_radius_m', 6200,
    'invented_at', '2026-09-25',
    'blocks_on', 'no locations row for deimos yet -- terrain-only scaffolding, not a playable surface'
  )
)
on conflict (id) do update set
  provider = excluded.provider,
  dataset_name = excluded.dataset_name,
  dataset_version = excluded.dataset_version,
  source_uri = excluded.source_uri,
  source_license = excluded.source_license,
  access_mode = excluded.access_mode,
  status = excluded.status,
  metadata = excluded.metadata;

comment on column public.terrain_datasets.metadata is
  'Free-form provenance/config. provenance=synthetic marks intentionally invented non-observed terrain data, e.g. Deimos.';
