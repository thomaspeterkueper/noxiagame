-- supabase/migrations/20260720000000_state_concessions.sql
-- C: Staatliche Konzessionen — Spieler pachten staatliche Gebäude
-- Erstellt: 20.07.2026
--
-- Mechanik:
--   STATE-Gebäude (Shipyard, Bank etc.) können als Konzession an Spieler vergeben werden.
--   Der Spieler zahlt eine Pacht pro Tick und erhält occupant_id-Status.
--   owner_class bleibt STATE — Eigentum bleibt beim Staat.
--   occupant_id = Spieler-ID → Spieler kann das Gebäude nutzen wie ein eigenes.

SET search_path TO public;

-- lease_price: Pacht pro Tick die der Staat für ein Gebäude verlangt (NULL = nicht verpachtbar)
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS lease_price integer;

-- concessions: aktive Pachtverträge
CREATE TABLE IF NOT EXISTS concessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid        NOT NULL REFERENCES tile_entities(id) ON DELETE CASCADE,
  lessee_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id   uuid        NOT NULL REFERENCES locations(id),
  lease_price   integer     NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,             -- NULL = unbegrenzt bis Kündigung
  active        boolean     NOT NULL DEFAULT true,
  UNIQUE(entity_id)                      -- Ein Gebäude kann nur einen aktiven Pächter haben
);

CREATE INDEX IF NOT EXISTS idx_concessions_lessee
  ON concessions (lessee_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_concessions_entity
  ON concessions (entity_id)
  WHERE active = true;

-- RLS
ALTER TABLE concessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "concessions_select_own" ON concessions;
CREATE POLICY "concessions_select_own"
  ON concessions FOR SELECT
  USING (lessee_id = auth.uid());

DROP POLICY IF EXISTS "concessions_select_public" ON concessions;
CREATE POLICY "concessions_select_public"
  ON concessions FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "concessions_service_all" ON concessions;
CREATE POLICY "concessions_service_all"
  ON concessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON concessions TO service_role;
GRANT ALL ON concessions TO authenticated;

-- Initiale STATE-Gebäude mit Pachtpreisen ausstatten
-- Shipyard, Bank: strategisch wichtig → höherer Preis
UPDATE tile_entities
SET lease_price = CASE entity_id
  WHEN 'shipyard'       THEN 200
  WHEN 'bank'           THEN 150
  WHEN 'warehouse'      THEN 80
  WHEN 'admin'          THEN 100
  WHEN 'landing_pad'    THEN 60
  WHEN 'docking_bay'    THEN 60
  WHEN 'school'         THEN 50
  WHEN 'command_center' THEN 120
  ELSE NULL
END
WHERE owner_class = 'STATE';

-- Kontrolle
SELECT entity_id, count(*) as anzahl, avg(lease_price) as avg_preis
FROM tile_entities
WHERE owner_class = 'STATE'
GROUP BY entity_id
ORDER BY avg_preis DESC NULLS LAST;
