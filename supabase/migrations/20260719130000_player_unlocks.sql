-- supabase/migrations/20260719130000_player_unlocks.sql
-- player_unlocks — Schritt 2 (bereits in Supabase ausgeführt)
-- Dokumentiert die Tabelle + RLS + GRANTs
-- Erstellt: 19.07.2026

SET search_path TO public;

CREATE TABLE IF NOT EXISTS player_unlocks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unlock_id     text        NOT NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  source_module text
);

CREATE UNIQUE INDEX IF NOT EXISTS player_unlocks_profile_unlock
  ON player_unlocks (profile_id, unlock_id);

CREATE INDEX IF NOT EXISTS idx_player_unlocks_profile
  ON player_unlocks (profile_id);

ALTER TABLE player_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unlocks_select_own" ON player_unlocks;
CREATE POLICY "unlocks_select_own"
  ON player_unlocks FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "unlocks_service_all" ON player_unlocks;
CREATE POLICY "unlocks_service_all"
  ON player_unlocks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON player_unlocks TO service_role;
GRANT ALL ON player_unlocks TO authenticated;
