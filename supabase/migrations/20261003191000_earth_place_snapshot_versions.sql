-- Separate persistent Earth geography from renderer/enrichment evolution.
-- Existing stored region_features are accepted as stable geography snapshots.
-- Future renderer or narrative changes must not force an OSM/Overpass re-import.

alter table public.celestial_regions
  add column if not exists geography_import_version integer not null default 0,
  add column if not exists normalization_version integer not null default 0,
  add column if not exists enrichment_version integer not null default 0,
  add column if not exists source_checked_at timestamptz;

-- Any Earth region that already owns persisted geometry is a valid snapshot.
update public.celestial_regions r
set geography_import_version = greatest(r.geography_import_version, 1),
    normalization_version = greatest(r.normalization_version, 1),
    enrichment_version = greatest(r.enrichment_version, 1),
    source_checked_at = coalesce(r.source_checked_at, r.imported_at, r.created_at)
where r.body = 'earth'
  and exists (
    select 1 from public.region_features f where f.region_id = r.id
  );

-- A failed later refresh must not erase the provenance/status of a retained
-- working snapshot. Tingo Maria exposed this legacy state.
update public.celestial_regions r
set source = 'overpass:retained-snapshot'
where r.body = 'earth'
  and r.source = 'noxia:materialization-failed'
  and exists (
    select 1 from public.region_features f where f.region_id = r.id
  );

-- The failed v3 attempt expanded Tingo Maria's metadata before its geography
-- was replaced. Restore the stored snapshot extent so metadata and features
-- describe the same persisted map. A future explicit refresh may expand it.
update public.celestial_regions
set radius_km = 1.2,
    bounds = jsonb_build_object(
      'south', center_lat - (1.2 / 111.32),
      'west', center_lon - (1.2 / (111.32 * greatest(0.05, abs(cos(radians(center_lat)))))),
      'north', center_lat + (1.2 / 111.32),
      'east', center_lon + (1.2 / (111.32 * greatest(0.05, abs(cos(radians(center_lat))))))
    )
where slug = 'earth-place-m9p29837-m76p00030'
  and source = 'overpass:retained-snapshot';
