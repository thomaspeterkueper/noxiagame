-- supabase/migrations/20260718100000_precreate_actors.sql
-- Fresh-database compatibility for the consolidated 20260719 baseline.
--
-- The consolidated baseline was assembled from a schema export plus archived
-- migrations. Several tables are referenced by FKs, indexes or RLS before they
-- are actually created (or are not created at all in that file). A production
-- schema comparison confirms the historical structures below.
--
-- Precreate only the structural tables here. Cross-table FKs whose referenced
-- tables are created by the baseline itself are restored immediately after the
-- baseline by 20260719010000_restore_legacy_constraints.sql.

SET search_path TO public;

-- `npc_ledger.actor_id` references actors(id) before the baseline adds its later
-- unique index, so actors needs its intended key from the start.
CREATE TABLE IF NOT EXISTS actors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text NOT NULL,
  display_name     text NOT NULL,
  founded_by       uuid,
  bio_short        text,
  personality      jsonb,
  decision_weights jsonb,
  created_at       timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_levels (
  level       integer PRIMARY KEY,
  title       text NOT NULL,
  min_points  integer NOT NULL,
  max_points  integer,
  color       text NOT NULL,
  description text
);

CREATE TABLE IF NOT EXISTS knowledge_transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  amount     integer NOT NULL,
  reason     text NOT NULL,
  task_id    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kurs_fortschritt (
  profile_id       uuid NOT NULL,
  kurs_id          uuid NOT NULL,
  gestartet_at     timestamptz,
  abgeschlossen_at timestamptz,
  letzte_folie     integer NOT NULL DEFAULT 1,
  quiz_bestanden   boolean NOT NULL DEFAULT false,
  punkte_verdient  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, kurs_id)
);

CREATE TABLE IF NOT EXISTS kurs_voraussetzungen (
  kurs_id      uuid NOT NULL,
  benoetigt_id uuid NOT NULL,
  PRIMARY KEY (kurs_id, benoetigt_id)
);

CREATE TABLE IF NOT EXISTS npc_trades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid NOT NULL,
  tick        bigint NOT NULL,
  resource    text NOT NULL,
  amount      numeric NOT NULL CHECK (amount > 0),
  unit_price  numeric NOT NULL,
  location_id uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, tick, resource)
);

CREATE TABLE IF NOT EXISTS ship_types (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  description    text,
  cost_credits   integer NOT NULL DEFAULT 0,
  cargo_max      integer NOT NULL,
  speed_mult     numeric NOT NULL DEFAULT 1.0,
  available_at   text NOT NULL DEFAULT 'moon',
  range_distance integer NOT NULL DEFAULT 28
);

CREATE TABLE IF NOT EXISTS player_journeys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL,
  journey_key  text NOT NULL,
  title        text NOT NULL,
  status       text NOT NULL DEFAULT 'active',
  progress     integer NOT NULL DEFAULT 0,
  progress_max integer NOT NULL DEFAULT 100,
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  selected     boolean DEFAULT true,
  UNIQUE (profile_id, journey_key)
);

CREATE TABLE IF NOT EXISTS journey_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_key       text NOT NULL,
  step_order        integer NOT NULL,
  title             text NOT NULL,
  description       text,
  completion_type   text NOT NULL,
  completion_target text,
  target_value      numeric,
  reward_credits    integer DEFAULT 0,
  reward_knowledge  integer DEFAULT 0,
  optional          boolean DEFAULT false
);
