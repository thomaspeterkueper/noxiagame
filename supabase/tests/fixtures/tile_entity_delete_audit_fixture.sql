-- Disposable PostgreSQL fixture for the DELETE-audit trigger integration test.
-- Deliberately minimal contract schema, NOT a substitute for a full Supabase
-- migration replay or an authorization/ownership integration test.
-- Execute only on an empty throwaway database.
create role anon nologin;
create role authenticated nologin;

create table public.tile_entities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  location_id uuid not null,
  tile_level smallint not null default 0,
  tile_row smallint not null default 0,
  tile_col smallint not null default 0,
  entity_type text not null default 'building',
  entity_id text not null,
  owner_class text not null default 'PLAYER',
  condition smallint not null default 100,
  status text not null default 'active',
  source_ref text,
  spatial_region_id uuid,
  latitude_deg double precision,
  longitude_deg double precision,
  footprint_width_m double precision,
  footprint_depth_m double precision,
  rotation_deg double precision
);

create table public.simulation_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  subject_type text not null,
  subject_id uuid,
  actor_id uuid,
  location_id uuid,
  tick bigint,
  effect_group_id uuid not null default gen_random_uuid(),
  effects jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  canonical_entity_id text,
  canonical_event_id text,
  constraint simulation_events_effects_array check (jsonb_typeof(effects) = 'array'),
  constraint simulation_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.entity_states (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  properties jsonb not null default '{}'::jsonb,
  source_event uuid references public.simulation_events(id) on delete set null,
  canonical_entity_id text,
  canonical_state_id text,
  created_at timestamptz not null default now(),
  constraint entity_states_valid_range check (valid_to is null or valid_to > valid_from),
  constraint entity_states_properties_object check (jsonb_typeof(properties) = 'object')
);
create unique index entity_states_one_current_idx
  on public.entity_states(subject_type, subject_id) where valid_to is null;

create table public.person_assignments (
  tile_entity_id uuid not null references public.tile_entities(id)
);

-- A purchased, unoccupied Earth building with an open historical state.
-- Fixed UUIDs make post-ROLLBACK assertions deterministic.
insert into public.tile_entities (
  id, profile_id, location_id, entity_type, entity_id, source_ref,
  latitude_deg, longitude_deg, footprint_width_m, footprint_depth_m, rotation_deg
) values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  'building', 'acquired_building', 'osm:way:1234567',
  50.3101, 8.4052, 12.5, 9.75, 17.0
);
insert into public.entity_states (subject_type, subject_id, valid_from, properties)
values ('tile_entity', '00000000-0000-4000-8000-000000000001',
        clock_timestamp() - interval '1 day', '{"entity_type":"building"}'::jsonb);
