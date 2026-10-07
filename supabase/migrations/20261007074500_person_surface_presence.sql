-- Authoritative coarse outdoor/surface presence for active people.
-- Coordinates are body/local-scene metres when known. Building anchoring is
-- allowed to be coarse; unknown travel remains unknown rather than fabricated.

create table if not exists public.person_surface_presence (
  person_id uuid primary key references public.people(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  source_kind text not null check (source_kind in ('building_anchor','street_route','explicit')),
  source_ref text not null,
  x_m double precision,
  y_m double precision,
  latitude_deg double precision,
  longitude_deg double precision,
  altitude_m double precision,
  spatial_region_id text,
  confidence numeric(5,4) not null default 1 check (confidence between 0 and 1),
  updated_tick bigint not null,
  updated_at timestamptz not null default now(),
  check ((x_m is null) = (y_m is null)),
  check (latitude_deg is null or latitude_deg between -90 and 90),
  check (longitude_deg is null or longitude_deg between -180 and 180)
);

create index if not exists idx_person_surface_presence_location
  on public.person_surface_presence(location_id, spatial_region_id);
alter table public.person_surface_presence enable row level security;
drop policy if exists person_surface_presence_service on public.person_surface_presence;
create policy person_surface_presence_service on public.person_surface_presence
  for all to service_role using (true) with check (true);
revoke all on public.person_surface_presence from anon, authenticated;
grant all on public.person_surface_presence to service_role;
