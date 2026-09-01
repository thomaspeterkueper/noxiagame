-- NOXIA Object–Relation–Event foundation
-- 2026-08-31
-- Adds the generalized runtime simulation event stream plus temporal entity state history.
-- Legacy public.events remains untouched and keeps its historical bigint/type/payload shape.
-- Existing colony_ledger remains the resource/economy specialization.
-- world_events and historical_milestones are intentionally retained until
-- their roadmap role is decided separately.

create table if not exists public.simulation_events (
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

alter table public.simulation_events
  add column if not exists canonical_entity_id text,
  add column if not exists canonical_event_id text;

create index if not exists simulation_events_subject_idx
  on public.simulation_events(subject_type, subject_id, occurred_at desc);
create index if not exists simulation_events_location_idx
  on public.simulation_events(location_id, occurred_at desc);
create index if not exists simulation_events_tick_idx
  on public.simulation_events(tick) where tick is not null;
create index if not exists simulation_events_effect_group_idx
  on public.simulation_events(effect_group_id);
create index if not exists simulation_events_canonical_entity_idx
  on public.simulation_events(canonical_entity_id) where canonical_entity_id is not null;
create index if not exists simulation_events_canonical_event_idx
  on public.simulation_events(canonical_event_id) where canonical_event_id is not null;

create table if not exists public.entity_states (
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

alter table public.entity_states
  add column if not exists canonical_entity_id text,
  add column if not exists canonical_state_id text;

create unique index if not exists entity_states_one_current_idx
  on public.entity_states(subject_type, subject_id)
  where valid_to is null;
create index if not exists entity_states_history_idx
  on public.entity_states(subject_type, subject_id, valid_from desc);
create index if not exists entity_states_source_event_idx
  on public.entity_states(source_event) where source_event is not null;
create index if not exists entity_states_canonical_entity_idx
  on public.entity_states(canonical_entity_id) where canonical_entity_id is not null;
create index if not exists entity_states_canonical_state_idx
  on public.entity_states(canonical_state_id) where canonical_state_id is not null;

alter table public.simulation_events enable row level security;
alter table public.entity_states enable row level security;

-- These tables are simulation internals. Browser clients receive projections
-- through NOXIA APIs; no anon/authenticated write policy is created here.
-- service_role bypasses RLS and remains the authoritative writer.

comment on table public.simulation_events is
  'Authoritative NOXIA runtime simulation event stream. Legacy public.events remains the historical application event stock.';
comment on column public.simulation_events.id is
  'NOXIA runtime event UUID. Does not replace or imply a KG EVT:* canonical event identity.';
comment on column public.simulation_events.canonical_entity_id is
  'Optional opaque KG canonical subject/entity ID after an explicit KG-approved projection. NOXIA must not mint this value.';
comment on column public.simulation_events.canonical_event_id is
  'Optional opaque KG EVT:* ID after KG promotion/acceptance. NULL for ordinary runtime-only events. NOXIA must not mint this value.';
comment on table public.entity_states is
  'Temporal NOXIA runtime state history derived from simulation_events. entity_states.id is a runtime UUID, never a KG STA:* identity. Optional canonical_* fields are KG-owned projections.';
comment on column public.entity_states.id is
  'NOXIA runtime state UUID. Does not replace or imply a KG STA:* canonical state identity.';
comment on column public.entity_states.canonical_entity_id is
  'Optional opaque KG canonical subject/entity ID. When canonical_state_id is present this subject must, where applicable, agree with KG DESCRIBES_STATE_OF semantics.';
comment on column public.entity_states.canonical_state_id is
  'Optional opaque KG STA:* ID after KG promotion/acceptance. NULL for runtime-only state history. NOXIA must not mint this value.';
