-- supabase/migrations/033_tile_entities_city.sql
-- NOXIA-CITY-SIMULATION F1–F5 + RESOURCE-0001
-- Erweitert tile_entities um Eigentum, Bodenwert, Deposits und Zonierung
-- Erstellt: 12.07.2026
--
-- Alle Spalten: ADD COLUMN IF NOT EXISTS → idempotent
-- Bestehende Daten bleiben unberührt
-- Standardfall Alpha 0.1/0.2: owner_id = profile_id, owner_class = 'PLAYER'
--
-- Dokumentation:
--   F1: owner_id ≠ occupant_id  (Landverpachtung ab Alpha 0.3)
--   F2: land_value (Henry George Landwertsteuer)
--   F3: owner_class PLAYER|STATE|NPC|CORPORATION
--   F4: HeliosCorp subtil via owner_class = 'CORPORATION'
--   F5: district_type emergent aus Nutzung (berechnet, nicht vorab festgelegt)

-- ═══════════════════════════════════════════════════════════════
-- 1) Eigentum (F1, F3)
-- ═══════════════════════════════════════════════════════════════

-- Eigentümer-Klasse: wer besitzt die Kachel?
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS owner_class text NOT NULL DEFAULT 'PLAYER'
  CONSTRAINT owner_class_valid CHECK (
    owner_class IN ('PLAYER', 'STATE', 'NPC', 'CORPORATION')
  );

-- Explizite owner_id (nullable: STATE/NPC haben keinen profile_id)
-- Standardfall Alpha: owner_id = profile_id
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS owner_id uuid;

-- Pächter / Nutzer (F1: Landnutzung ≠ Landbesitz)
-- nullable: wird erst mit Alpha 0.3 Pachtmechanik befüllt
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS occupant_id uuid;

-- Pachtvertrag-Referenz (F1, Alpha 0.3+)
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS lease_id uuid;

-- ═══════════════════════════════════════════════════════════════
-- 2) Bodenwert (F2 — Henry George Landwertsteuer)
-- ═══════════════════════════════════════════════════════════════

-- Berechneter Bodenwert: Lage × Nutzung × Nachfrage × Ressourcenpotenzial
-- Wird durch Cron oder bei Tick-Berechnung aktualisiert
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS land_value integer NOT NULL DEFAULT 0;

-- Letzter Zeitpunkt der Bodenwert-Berechnung
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS land_value_updated_at timestamptz;

-- ═══════════════════════════════════════════════════════════════
-- 3) Ressourcenvorkommen (RESOURCE-0001)
-- ═══════════════════════════════════════════════════════════════

-- Referenz auf ein geologisches Deposit (nullable: nicht jede Kachel hat eines)
-- Wenn gesetzt: diese Kachel liegt über einem Deposit
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS deposit_id uuid;

-- Deposit-Status: entdeckt oder noch unbekannt
-- Scanner-Gebäude setzt discovered = true
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS deposit_discovered boolean NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════════════════
-- 4) Emergente Zonierung (F5)
-- ═══════════════════════════════════════════════════════════════

-- Wird aus Nutzung der umliegenden Kacheln abgeleitet (nicht vorab festgelegt)
-- Mögliche Werte: residential | industrial | commercial | mixed | infrastructure | empty
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS district_type text;

-- ═══════════════════════════════════════════════════════════════
-- 5) Backfill: bestehende Kacheln auf PLAYER-Standard setzen
-- ═══════════════════════════════════════════════════════════════

-- owner_id = profile_id (Standardfall Alpha)
UPDATE tile_entities
  SET owner_id = profile_id
  WHERE owner_id IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- 6) Indizes
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tile_entities_owner_class
  ON tile_entities (owner_class);

CREATE INDEX IF NOT EXISTS idx_tile_entities_owner_id
  ON tile_entities (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tile_entities_land_value
  ON tile_entities (location_id, land_value DESC)
  WHERE land_value > 0;

CREATE INDEX IF NOT EXISTS idx_tile_entities_deposit
  ON tile_entities (deposit_id)
  WHERE deposit_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 7) Kontrolle
-- ═══════════════════════════════════════════════════════════════

SELECT
  owner_class,
  count(*) AS anzahl,
  count(owner_id) AS mit_owner_id,
  count(deposit_id) AS mit_deposit
FROM tile_entities
GROUP BY owner_class
ORDER BY anzahl DESC;

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'tile_entities'
  AND table_schema = 'public'
ORDER BY ordinal_position;
