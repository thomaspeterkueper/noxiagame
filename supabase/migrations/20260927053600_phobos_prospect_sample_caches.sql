-- Persistent map/logistics nodes for discovered Stickney prospects.
-- These inventories double as the field cache from which a scientific sample
-- can be returned to Base Alpha through the generic surface logistics core.

set search_path to public;

with phobos_location as (
  select id from locations where slug='phobos' limit 1
), discovered as (
  select rr.*
  from region_resources rr
  where rr.discovered_at is not null
    and rr.properties @> '{"body":"phobos","surface_hub":"stickney-alpha"}'::jsonb
)
insert into logistics_inventories (
  id, owner_profile_id, location_id, inventory_kind, storage_kind,
  subject_type, subject_id, label, capacity,
  public_deposit, public_withdraw, active, metadata
)
select
  gen_random_uuid(), null, pl.id, 'facility', 'native',
  'region_resource', d.id,
  'Stickney Prospect · ' || initcap(replace(d.resource_type,'_',' ')),
  4, false, true, true,
  jsonb_build_object(
    'role','prospect_sample_cache',
    'body','phobos',
    'surfaceHub','stickney-alpha',
    'prospectId',d.id,
    'resourceType',d.resource_type,
    'xM',d.x_m,
    'yM',d.y_m,
    'provenance',coalesce(d.properties->>'provenance','derived-gameplay-model')
  )
from discovered d
cross join phobos_location pl
where not exists (
  select 1 from logistics_inventories li
  where li.storage_kind='native'
    and li.subject_type='region_resource'
    and li.subject_id=d.id
);
