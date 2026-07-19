-- supabase/migrations/20260719140000_ssf_completions.sql
-- SSF Completions: Lernpfad-Abschlüsse von der Solar Science Foundation
-- Erstellt: 19.07.2026
-- Quelle: NOX-SSF-0008 — SSF hat /api/noxia/completion implementiert

SET search_path TO public;

CREATE TABLE IF NOT EXISTS ssf_completions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  noxia_uid    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id      text        NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  source       text        NOT NULL DEFAULT 'ssf',
  UNIQUE(noxia_uid, path_id)
);

CREATE INDEX IF NOT EXISTS idx_ssf_completions_uid
  ON ssf_completions (noxia_uid);

ALTER TABLE ssf_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ssf_completions_select_own" ON ssf_completions;
CREATE POLICY "ssf_completions_select_own"
  ON ssf_completions FOR SELECT
  USING (noxia_uid = auth.uid());

DROP POLICY IF EXISTS "ssf_completions_service_all" ON ssf_completions;
CREATE POLICY "ssf_completions_service_all"
  ON ssf_completions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON ssf_completions TO service_role;
GRANT ALL ON ssf_completions TO authenticated;

-- Kontrolle
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ssf_completions' AND table_schema = 'public'
ORDER BY ordinal_position;
