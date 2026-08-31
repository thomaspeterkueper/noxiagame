-- NOXIA Object–Relation–Event foundation
-- 2026-08-31
-- Adds a generalized event stream plus temporal entity state history.
-- Existing colony_ledger remains the resource/economy specialization.
-- world_events and historical_milestones are intentionally retained until
-- their roadmap role is decided separately.

create table if not exists public.events (
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
  constraint events_effects_array check (jsonb_typeof(effects) = 'array'),
  constraint events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists events_subject_idx
  on public.events(subject_type, subject_id, occurred_at desc);
create index if not exists events_location_idx
  on public.events(location_id, occurred_at desc);
create index if not exists events_tick_idx
  on public.events(tick) where tick is not null;
create index if not exists events_effect_group_idx
  on public.events(effect_group_id);

create table if not exists public.entity_states (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  properties jsonb not null default '{}'::jsonb,
  source_event uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint entity_states_valid_range check (valid_to is null or valid_to > valid_from),
  constraint entity_states_properties_object check (jsonb_typeof(properties) = 'object')
);

create unique index if not exists entity_states_one_current_idx
  on public.entity_states(subject_type, subject_id)
  where valid_to is null;
create index if not exists entity_states_history_idx
  on public.entity_states(subject_type, subject_id, valid_from desc);
create index if not exists entity_states_source_event_idx
  on public.entity_states(source_event) where source_event is not null;

alter table public.events enable row level security;
alter table public.entity_states enable row level security;

-- These tables are simulation internals. Browser clients receive projections
-- through NOXIA APIs; no anon/authenticated write policy is created here.
-- service_role bypasses RLS and remains the authoritative writer.

comment on table public.events is
  'Generalized NOXIA simulation event stream. One event may carry grouped effects; colony_ledger remains the specialized resource ledger.';
comment on table public.entity_states is
  'Temporal state history derived from simulation events. valid_to IS NULL denotes the current state.';
