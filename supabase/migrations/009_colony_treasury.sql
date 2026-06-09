-- Migration 009: Colony Treasury & Tariffs
-- colony_ledger: Einnahmen/Ausgaben pro Tick je Kolonie
-- colony_tariffs: Ressourcen-spezifische Zölle (vorbereitet, initial leer)
-- Stand: Alpha 0.2
--
-- FIX 08.06.2026: colony_ledger-Write-Policy. Die alte Form
--   FOR INSERT USING (false) WITH CHECK (false)
-- wird von Postgres abgelehnt:  "ERROR: only WITH CHECK expression allowed
-- for INSERT" (USING gilt nicht für INSERT). Auf FOR ALL umgestellt — das
-- sperrt zugleich UPDATE/DELETE und ist konsistent mit colony_settings/tariffs.
-- (Service Role umgeht RLS ohnehin; die API bleibt die einzige Schreibstelle.)

-- 1. Colony Ledger
CREATE TABLE IF NOT EXISTS colony_ledger (
  id              bigserial PRIMARY KEY,
  location_id     uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tick            bigint      NOT NULL,           -- Tick-Nummer aus tick_log
  entry_type      text        NOT NULL,           -- 'tax_property' | 'tax_transaction' | 'tax_landing' | 'tariff' | 'payout' | 'other'
  profile_id      uuid        REFERENCES profiles(id) ON DELETE SET NULL, -- wer hat gezahlt (NULL = System)
  resource_type   text,                           -- bei tariff: 'water' | 'energy' | 'metal'
  amount          numeric(12,2) NOT NULL,         -- positiv = Einnahme, negativ = Ausgabe
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CHECK (entry_type IN ('tax_property','tax_transaction','tax_landing','tariff','payout','other'))
);

COMMENT ON TABLE colony_ledger IS
  'Append-only Kassenbuch der Kolonie. Jede Zeile ist ein Vorgang. '
  'Summe über einen Tick = Treasury-Delta dieses Ticks.';

CREATE INDEX IF NOT EXISTS colony_ledger_location_tick
  ON colony_ledger (location_id, tick DESC);

CREATE INDEX IF NOT EXISTS colony_ledger_profile
  ON colony_ledger (profile_id)
  WHERE profile_id IS NOT NULL;

-- RLS
ALTER TABLE colony_ledger ENABLE ROW LEVEL SECURITY;

-- Jeder darf aggregierte Einnahmen sehen (Transparenz)
CREATE POLICY "colony_ledger_select_all"
  ON colony_ledger FOR SELECT
  USING (true);

-- Schreiben nur Service Role (FOR ALL, nicht FOR INSERT — s. Fix-Hinweis oben)
CREATE POLICY "colony_ledger_write_service"
  ON colony_ledger FOR ALL
  USING (false)
  WITH CHECK (false);

-- 2. Colony Tariffs (vorbereitet, noch nicht aktiv in Alpha 0.2)
CREATE TABLE IF NOT EXISTS colony_tariffs (
  location_id     uuid    NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  resource_type   text    NOT NULL CHECK (resource_type IN ('water','energy','metal')),
  rate            numeric(5,4) NOT NULL DEFAULT 0
                  CHECK (rate >= 0 AND rate <= 1),  -- 0.00–1.00
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid    REFERENCES profiles(id) ON DELETE SET NULL,

  PRIMARY KEY (location_id, resource_type)
);

COMMENT ON TABLE colony_tariffs IS
  'Ressourcen-spezifische Importzölle. Tabelle ist vorbereitet, '
  'wird in Alpha 0.2 noch nicht durch die Trade-Route ausgewertet.';

-- Initialdatensätze: alle Ressourcen, alle Kolonien, Rate = 0
INSERT INTO colony_tariffs (location_id, resource_type)
  SELECT l.id, r.res
  FROM locations l
  CROSS JOIN (VALUES ('water'),('energy'),('metal')) AS r(res)
  ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE colony_tariffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colony_tariffs_select_all"
  ON colony_tariffs FOR SELECT
  USING (true);

CREATE POLICY "colony_tariffs_write_service"
  ON colony_tariffs FOR ALL
  USING (false)
  WITH CHECK (false);

-- 3. Treasury-Balance als View (praktisch für Colony View)
CREATE OR REPLACE VIEW colony_treasury AS
  SELECT
    location_id,
    SUM(amount) FILTER (WHERE amount > 0)  AS total_income,
    SUM(amount) FILTER (WHERE amount < 0)  AS total_expenses,
    SUM(amount)                            AS balance,
    MAX(tick)                              AS last_tick
  FROM colony_ledger
  GROUP BY location_id;

COMMENT ON VIEW colony_treasury IS
  'Aggregierte Treasury-Übersicht je Kolonie (Lifetime).';
