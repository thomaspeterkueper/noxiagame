-- supabase/migrations/034_journey_rls.sql
-- RLS für player_journeys + journey_steps
-- Erstellt: 14.07.2026
-- Behebt: "permission denied for table player_journeys"

SET search_path TO public;

-- ── player_journeys ───────────────────────────────────────────────────────────
ALTER TABLE player_journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journeys_select_own"  ON player_journeys;
DROP POLICY IF EXISTS "journeys_insert_own"  ON player_journeys;
DROP POLICY IF EXISTS "journeys_update_own"  ON player_journeys;
DROP POLICY IF EXISTS "journeys_service_all" ON player_journeys;

CREATE POLICY "journeys_select_own"
  ON player_journeys FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "journeys_insert_own"
  ON player_journeys FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "journeys_update_own"
  ON player_journeys FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "journeys_service_all"
  ON player_journeys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── journey_steps ─────────────────────────────────────────────────────────────
ALTER TABLE journey_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journey_steps_select_all" ON journey_steps;
DROP POLICY IF EXISTS "journey_steps_service_all" ON journey_steps;

CREATE POLICY "journey_steps_select_all"
  ON journey_steps FOR SELECT
  USING (true);

CREATE POLICY "journey_steps_service_all"
  ON journey_steps FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Kontrolle
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('player_journeys', 'journey_steps')
ORDER BY tablename, cmd;
