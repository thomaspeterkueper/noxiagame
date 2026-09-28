-- Separate shared Phobos prospect discoveries from per-player mission participation.
-- region_resources remains the shared world state; events records who performed a scan.

create index if not exists idx_events_profile_type_location
  on public.events (profile_id, type, location_id, created_at desc);

with phobos_location as (
  select id
  from public.locations
  where slug = 'phobos'
  limit 1
), legacy_participants as (
  select distinct on (p.id)
    p.id as profile_id,
    r.discovered_at,
    r.id as prospect_id
  from public.region_resources r
  join public.profiles p
    on p.id::text = r.properties ->> 'discovered_by'
  where r.properties @> '{"body":"phobos","surface_hub":"stickney-alpha"}'::jsonb
    and r.discovered_at is not null
  order by p.id, r.discovered_at asc
)
insert into public.events (profile_id, location_id, type, payload, created_at)
select
  lp.profile_id,
  pl.id,
  'phobos_prospect_scan',
  jsonb_build_object(
    'body', 'phobos',
    'surfaceHub', 'stickney-alpha',
    'legacyBackfill', true,
    'prospectId', lp.prospect_id
  ),
  coalesce(lp.discovered_at, now())
from legacy_participants lp
cross join phobos_location pl
where not exists (
  select 1
  from public.events e
  where e.profile_id = lp.profile_id
    and e.location_id = pl.id
    and e.type = 'phobos_prospect_scan'
);

update public.region_resources
set properties = properties - 'discovered_by'
where properties @> '{"body":"phobos","surface_hub":"stickney-alpha"}'::jsonb
  and properties ? 'discovered_by';
