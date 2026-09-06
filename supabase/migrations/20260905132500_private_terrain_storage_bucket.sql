-- Private object storage for validated terrain raster tiles.
-- Raster bytes remain outside public relational rows; terrain_tiles stores
-- provenance, bounds, checksum and object location only.

insert into storage.buckets (id, name, public)
values ('terrain', 'terrain', false)
on conflict (id) do update set
  name = excluded.name,
  public = false;

-- No authenticated/client object policies are added here intentionally.
-- Terrain ingestion uses the server-side service-role boundary; gameplay clients
-- consume derived/sampled terrain through NOXIA APIs, not raw DEM objects.
