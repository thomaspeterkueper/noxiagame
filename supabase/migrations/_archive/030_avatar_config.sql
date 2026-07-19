-- supabase/migrations/030_avatar_config.sql
-- Erstellt:     26.06.2026
-- Aktualisiert: 26.06.2026 — Initiale Version
-- Version:      1.0.0
--
-- Erweitert profiles um:
--   avatar_config jsonb  — erweiterbare Erscheinungsbild-Daten
--   faction text         — Fraktionszugehörigkeit (entdeckbar, nicht gewählt)
--
-- avatar_config Schema (alle Felder optional, jsonb wächst ohne Migration):
-- {
--   "suit":    "standard_gray",     -- Anzug-Variante
--   "accent":  "#c9a961",           -- persönliche Akzentfarbe
--   "emblem":  "snake_helix",       -- persönliches Symbol (später)
--   "title":   "Freier Händler",    -- selbst gewählter Titel (später)
--   "bio":     "...",               -- kurze Selbstbeschreibung (später)
--   "3d": {                         -- 3D-Avatar-Daten (später)
--     "hair": "short_dark",
--     "skin": "medium",
--     "eyes": "blue"
--   }
-- }
--
-- faction: NULL = unabhängig, 'helios' = HeliosCorp, 'ssf' = SSF-Mitglied
-- Wird NICHT vom Spieler gewählt — entsteht durch Spielverhalten (HeliosCorp-Mechanik)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_config  jsonb    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS faction        text     DEFAULT NULL
    CHECK (faction IN ('helios', 'ssf', 'independent') OR faction IS NULL);

-- Freunde-Tabelle (symmetrisch: A→B und B→A werden beide gespeichert)
CREATE TABLE IF NOT EXISTS friendships (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted')),
  created_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (profile_id, friend_id),
  CHECK (profile_id != friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_profile ON friendships (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend  ON friendships (friend_id,  status);

-- Reputation-Tabelle (automatisch befüllt durch trade/route.ts)
-- Statt zu berechnen: direkt inkrementell gezählt
CREATE TABLE IF NOT EXISTS location_reputation (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id  uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  deliveries   integer     NOT NULL DEFAULT 0,   -- Anzahl Lieferungen
  total_volume integer     NOT NULL DEFAULT 0,   -- Gesamtvolumen in Tonnen
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (profile_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_location_reputation_profile ON location_reputation (profile_id);

-- RLS
ALTER TABLE friendships         ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_reputation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select_own"    ON friendships;
DROP POLICY IF EXISTS "friendships_service_all"   ON friendships;
DROP POLICY IF EXISTS "reputation_select_own"     ON location_reputation;
DROP POLICY IF EXISTS "reputation_service_all"    ON location_reputation;

CREATE POLICY "friendships_select_own"
  ON friendships FOR SELECT
  USING (profile_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "friendships_service_all"
  ON friendships FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "reputation_select_own"
  ON location_reputation FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "reputation_service_all"
  ON location_reputation FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Kontrolle
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('avatar_config', 'faction')
ORDER BY column_name;
