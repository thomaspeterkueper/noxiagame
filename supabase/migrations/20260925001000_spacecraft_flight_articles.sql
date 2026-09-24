-- Persist exact spacecraft/Engineering mappings separately from legacy ship types.
-- This table is Core-owned state. Engineering remains authoritative for the
-- referenced frame/authority; NOXIA owns which concrete ship instance carries
-- which approved configuration and which departure facts have been resolved.

create table if not exists public.spacecraft_flight_articles (
  ship_id uuid primary key references public.ships(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  engineering_frame_id text not null,
  engineering_authority_ref text not null,
  configuration_ref text not null,
  actual_start_mass_kg numeric null check (actual_start_mass_kg is null or actual_start_mass_kg > 0),
  crew_mass_resolved boolean not null default false,
  cargo_mass_resolved boolean not null default false,
  mission_equipment_mass_resolved boolean not null default false,
  propellant_state_ref text null,
  departure_site_ref text null,
  departure_site_class text null,
  release_speed_m_s numeric null check (release_speed_m_s is null or release_speed_m_s >= 0),
  target_plane_ref text null,
  target_plane_resolved boolean not null default false,
  state_status text not null default 'configured'
    check (state_status in ('configured','measured','ready','retired')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spacecraft_flight_articles_owner_idx
  on public.spacecraft_flight_articles(owner_profile_id);
create index if not exists spacecraft_flight_articles_frame_idx
  on public.spacecraft_flight_articles(engineering_frame_id);

alter table public.spacecraft_flight_articles enable row level security;

revoke all on table public.spacecraft_flight_articles from public, anon, authenticated;
grant select, insert, update, delete on table public.spacecraft_flight_articles to service_role;

comment on table public.spacecraft_flight_articles is
  'Trusted NOXIA mapping from a concrete ship to a versioned Engineering flight article and resolved physical departure state.';
comment on column public.spacecraft_flight_articles.actual_start_mass_kg is
  'Actual physical launch mass when authoritatively resolved; never inferred from legacy cargo/game units.';
comment on column public.spacecraft_flight_articles.departure_site_class is
  'Engineering launch-site class only after a concrete NOXIA departure site has been explicitly mapped.';
