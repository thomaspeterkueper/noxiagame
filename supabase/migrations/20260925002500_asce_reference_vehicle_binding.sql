-- Tie each spacecraft flight article to the shared canonical vehicle identity.
-- Existing table is empty at rollout; NOT NULL prevents future parallel identity.

alter table public.spacecraft_flight_articles
  add column if not exists vehicle_instance_id uuid;

alter table public.spacecraft_flight_articles
  drop constraint if exists spacecraft_flight_articles_vehicle_instance_id_fkey;
alter table public.spacecraft_flight_articles
  add constraint spacecraft_flight_articles_vehicle_instance_id_fkey
  foreign key (vehicle_instance_id) references public.vehicle_instances(id) on delete restrict;

create unique index if not exists spacecraft_flight_articles_vehicle_instance_uidx
  on public.spacecraft_flight_articles(vehicle_instance_id);

alter table public.spacecraft_flight_articles
  alter column vehicle_instance_id set not null;

-- One canonical, deliberately inactive ASCE reference vehicle. This creates
-- identity only. It does NOT assert ownership, location, payload capability,
-- propellant readiness, launch-site clearance or flight readiness.
insert into public.vehicle_instances (
  canonical_key,
  frame_id,
  label,
  owner_profile_id,
  location_id,
  current_node_inventory_id,
  status,
  condition,
  wear,
  cargo_capacity_t,
  energy,
  crew_ids,
  modules,
  modifications,
  emergent_state
)
values (
  'noxia:spacecraft:asce-p85-r1:reference-001',
  'ENG-SCV-0003',
  'ASCE-P85 · Referenzfluggerät 001',
  null,
  null,
  null,
  'inactive',
  100,
  0,
  0,
  '[]'::jsonb,
  '{}'::uuid[],
  '[]'::jsonb,
  jsonb_build_object(
    'engineeringAuthorityRef', 'ENG-EARTH-LEO-ASCENT-r1',
    'configurationRef', 'ASCE-P85-Wing-A-Pure-SSTO-160-r1'
  ),
  jsonb_build_object(
    'provisioningStatus', 'reference-unassigned',
    'flightArticleRequired', true,
    'physicalCapacityAuthority', 'unresolved',
    'launchSiteStatus', 'unresolved'
  )
)
on conflict (canonical_key) do update
set frame_id = excluded.frame_id,
    label = excluded.label,
    modifications = excluded.modifications,
    emergent_state = excluded.emergent_state,
    updated_at = now();

comment on column public.spacecraft_flight_articles.vehicle_instance_id is
  'Exact shared vehicle identity for this spacecraft flight article; its frame_id must match the Engineering frame consumed by ascent authority.';
