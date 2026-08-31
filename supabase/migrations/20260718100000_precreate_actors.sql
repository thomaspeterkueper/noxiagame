-- supabase/migrations/20260718100000_precreate_actors.sql
-- Fresh-database compatibility for the consolidated 20260719 baseline.
--
-- The baseline creates `actors` without an inline PK/UNIQUE constraint and only
-- adds the unique index later, but `npc_ledger.actor_id` references actors(id)
-- before that index exists. PostgreSQL therefore rejects the FK during a clean
-- replay. Precreating the historical actors table with its intended primary key
-- preserves the baseline schema while making the replay order valid.

SET search_path TO public;

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
