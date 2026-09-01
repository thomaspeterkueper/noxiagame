-- NOXIA runtime-to-canon projection boundary
-- 2026-08-31
--
-- NOXIA owns authoritative simulation/runtime events and temporal runtime states.
-- Their UUID primary keys are NOT KUEPER Knowledge Graph EVT:* / STA:* IDs.
-- Canonical IDs are opaque strings assigned/promoted by KG and are only stored
-- here as optional projections after such a mapping exists.
--
-- Legacy public.events is a separate historical application table and is not
-- part of this runtime-canon boundary.

set search_path to public;

alter table public.simulation_events
  add column if not exists canonical_entity_id text,
  add column if not exists canonical_event_id text;

alter table public.entity_states
  add column if not exists canonical_entity_id text,
  add column if not exists canonical_state_id text;

create index if not exists simulation_events_canonical_entity_idx
  on public.simulation_events(canonical_entity_id)
  where canonical_entity_id is not null;

create index if not exists simulation_events_canonical_event_idx
  on public.simulation_events(canonical_event_id)
  where canonical_event_id is not null;

create index if not exists entity_states_canonical_entity_idx
  on public.entity_states(canonical_entity_id)
  where canonical_entity_id is not null;

create index if not exists entity_states_canonical_state_idx
  on public.entity_states(canonical_state_id)
  where canonical_state_id is not null;

comment on table public.simulation_events is
  'Authoritative NOXIA runtime simulation event stream. simulation_events.id is a NOXIA runtime UUID, never a KG EVT:* identity. Optional canonical_* fields are opaque KG-owned projection targets.';

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

comment on function public.noxia_record_player_build_event() is
  'Authoritative NOXIA runtime audit/event projection for player_builds lifecycle changes; does not create KG EVT:* identities.';

comment on function public.noxia_record_tile_entity_state() is
  'Projects tile_entities mutations into NOXIA runtime simulation_events and temporal runtime entity_states; does not create KG EVT:* or STA:* identities.';
