-- NOXIA Core: consume current KUEPER Engineering Earth->LEO authority r2.
--
-- ENG-EARTH-LEO-ASCENT-r1 / ENG-SCV-0003 is superseded and must not authorize
-- new ascents. Historical rows remain historical; this migration adds the extra
-- trusted state required by r2 and a separate inactive r2 reference identity.

set search_path = public;

alter table public.spacecraft_flight_articles
  add column if not exists high_lift_state_ref text null;

alter table public.spacecraft_flight_articles
  add column if not exists target_inclination_deg numeric null;

alter table public.spacecraft_flight_articles
  drop constraint if exists spacecraft_flight_articles_target_inclination_check;

alter table public.spacecraft_flight_articles
  add constraint spacecraft_flight_articles_target_inclination_check
  check (
    target_inclination_deg is null
    or (target_inclination_deg >= 0 and target_inclination_deg <= 180)
  );

comment on column public.spacecraft_flight_articles.high_lift_state_ref is
  'Trusted NOXIA resolution token for the exact Engineering high-lift state required by the selected ascent authority; null remains unresolved.';

comment on column public.spacecraft_flight_articles.target_inclination_deg is
  'Resolved target orbital inclination in degrees for Engineering plane-compatibility authorization; null remains unresolved.';

-- Preserve the historical r1 reference identity, but make its superseded status
-- explicit. Do not rewrite it into the physically different r2 vehicle.
update public.vehicle_instances
set emergent_state = coalesce(emergent_state, '{}'::jsonb) || jsonb_build_object(
      'engineeringAuthorityStatus', 'superseded',
      'supersededByAuthorityRef', 'ENG-EARTH-LEO-ASCENT-r2'
    ),
    updated_at = now()
where canonical_key = 'noxia:spacecraft:asce-p85-r1:reference-001';

-- r2 identity only. This deliberately does not assert an owner, launch site,
-- resolved masses, propellant state, high-lift state, target plane or readiness.
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
  'noxia:spacecraft:asce-p85-r2:reference-001',
  'ENG-SCV-0004',
  'ASCE-P85 r2 · Referenzfluggerät 001',
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
    'engineeringAuthorityRef', 'ENG-EARTH-LEO-ASCENT-r2',
    'configurationRef', 'ASCE-P85-Wing-A-Pure-SSTO-3E-HL145-170-r2'
  ),
  jsonb_build_object(
    'provisioningStatus', 'reference-unassigned',
    'flightArticleRequired', true,
    'physicalCapacityAuthority', 'unresolved',
    'launchSiteStatus', 'unresolved',
    'propellantStateStatus', 'unresolved',
    'highLiftStateStatus', 'unresolved',
    'targetPlaneStatus', 'unresolved'
  )
)
on conflict (canonical_key) do update
set frame_id = excluded.frame_id,
    label = excluded.label,
    modifications = excluded.modifications,
    emergent_state = excluded.emergent_state,
    updated_at = now();

comment on table public.spacecraft_flight_articles is
  'Trusted NOXIA mapping from a concrete ship to a versioned Engineering flight article and resolved physical departure state. Earth r2 additionally requires explicit high-lift state and target inclination.';
