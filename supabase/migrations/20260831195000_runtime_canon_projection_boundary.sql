-- NOXIA runtime-to-canon projection boundary
-- 2026-08-31
--
-- NOXIA owns authoritative simulation/runtime events and temporal runtime states.
-- Their UUID primary keys are NOT KUEPER Knowledge Graph EVT:* / STA:* IDs.
-- Canonical IDs are opaque strings assigned/promoted by KG and are only stored
-- here as optional projections after such a mapping exists.
--
-- Runtime-only UI/tick/gameplay events require no KG identity.
-- Cross-system relation semantics remain KG-owned; NOXIA consumes the KG
-- relation registry and runtime-projection contract instead of inventing
-- parallel global relation types.

set search_path to public;

alter table public.events
  add column if not exists canonical_entity_id text,
  add column if not exists canonical_event_id text;

create index if not exists events_canonical_entity_idx
  on public.events(canonical_entity_id)
  where canonical_entity_id is not null;

create index if not exists events_canonical_event_idx
  on public.events(canonical_event_id)
  where canonical_event_id is not null;

comment on table public.events is
  'Authoritative NOXIA runtime simulation event stream. events.id is a NOXIA runtime UUID, never a KG EVT:* identity. Optional canonical_* fields are opaque KG-owned projection targets.';

comment on column public.events.id is
  'NOXIA runtime event UUID. Does not replace or imply a KG EVT:* canonical event identity.';

comment on column public.events.canonical_entity_id is
  'Optional opaque KG canonical subject/entity ID after an explicit KG-approved projection. NOXIA must not mint this value.';

comment on column public.events.canonical_event_id is
  'Optional opaque KG EVT:* ID after KG promotion/acceptance. NULL for ordinary runtime-only events. NOXIA must not mint this value.';

-- Fresh repository replay currently creates entity_states in a later historical
-- migration (20260831_noxia_events_entity_states.sql). Production had the table
-- already when this migration originally ran. Keep this migration valid in both
-- histories; the later migration carries the same canonical columns/indexes.
DO $$
BEGIN
  IF to_regclass('public.entity_states') IS NOT NULL THEN
    ALTER TABLE public.entity_states
      ADD COLUMN IF NOT EXISTS canonical_entity_id text,
      ADD COLUMN IF NOT EXISTS canonical_state_id text;

    CREATE INDEX IF NOT EXISTS entity_states_canonical_entity_idx
      ON public.entity_states(canonical_entity_id)
      WHERE canonical_entity_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS entity_states_canonical_state_idx
      ON public.entity_states(canonical_state_id)
      WHERE canonical_state_id IS NOT NULL;

    COMMENT ON TABLE public.entity_states IS
      'Temporal NOXIA runtime state history derived from simulation events. entity_states.id is a runtime UUID, never a KG STA:* identity. Optional canonical_* fields are KG-owned projections.';

    COMMENT ON COLUMN public.entity_states.id IS
      'NOXIA runtime state UUID. Does not replace or imply a KG STA:* canonical state identity.';

    COMMENT ON COLUMN public.entity_states.canonical_entity_id IS
      'Optional opaque KG canonical subject/entity ID. When canonical_state_id is present this subject must, where applicable, agree with KG DESCRIBES_STATE_OF semantics.';

    COMMENT ON COLUMN public.entity_states.canonical_state_id IS
      'Optional opaque KG STA:* ID after KG promotion/acceptance. NULL for runtime-only state history. NOXIA must not mint this value.';
  END IF;
END $$;

comment on function public.noxia_record_player_build_event() is
  'Authoritative NOXIA runtime audit/event projection for player_builds lifecycle changes; does not create KG EVT:* identities.';

comment on function public.noxia_record_tile_entity_state() is
  'Projects tile_entities mutations into NOXIA runtime events and temporal runtime entity_states; does not create KG EVT:* or STA:* identities.';
