-- Planetary terrain object storage foundation.
--
-- Terrain raster bytes are server-authoritative source data. Keep the bucket
-- private; gameplay clients receive derived samples/buildability, never raw DEM
-- objects. Service-role access does not require a storage.objects client policy.

do $$
declare
  existing storage.buckets%rowtype;
begin
  select * into existing
  from storage.buckets
  where id = 'terrain';

  if found then
    if existing.name is distinct from 'terrain'
       or existing.public is distinct from false then
      raise exception 'terrain storage bucket exists with incompatible configuration';
    end if;
  else
    insert into storage.buckets (id, name, public, allowed_mime_types)
    values (
      'terrain',
      'terrain',
      false,
      array['image/tiff', 'application/octet-stream']::text[]
    );
  end if;
end $$;
