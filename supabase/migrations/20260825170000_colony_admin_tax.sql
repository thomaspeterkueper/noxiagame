-- supabase/migrations/20260825170000_colony_admin_tax.sql
-- Erstellt: 25.08.2026
--
-- NOXIA-ECON-0002 — Verwaltung & Kolonie-Steuern
-- Gründungsminimum einer Kolonie umfasst ab sofort eine Verwaltung
-- (found-location/route.ts v1.3.0). Der Eigentümer der Verwaltung legt
-- Steuersätze pro Ressource fest, die bei jedem Handel an diesem Standort
-- erhoben und ihm gutgeschrieben werden.

SET search_path TO public;

-- 1. Verwaltung ist pro Kolonie eindeutig (max. eine pro location_id).
--    Verkaufte Gebäude werden aus tile_entities gelöscht (build/route.ts
--    sell-Action), daher genügt ein einfacher partieller Unique-Index ohne
--    Status-Filter.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_admin_per_location
  ON tile_entities (location_id)
  WHERE entity_id = 'admin';

-- 2. Steuersätze pro Kolonie & Ressource, festgelegt vom Verwaltungs-
--    Eigentümer. resource = '*' ist ein allgemeiner Satz als Fallback,
--    falls keine ressourcenspezifische Rate gesetzt ist.
CREATE TABLE IF NOT EXISTS colony_tax_rates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  resource     text NOT NULL,
  rate_pct     numeric NOT NULL DEFAULT 0 CHECK (rate_pct >= 0 AND rate_pct <= 0.5),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_colony_tax_rates_location
  ON colony_tax_rates (location_id);

-- 3. Ledger aller erhobenen Steuern — Transparenz für Spieler (Verwaltungs-
--    Eigentümer sieht Einnahmen), Auditierbarkeit fürs Weltmodell.
CREATE TABLE IF NOT EXISTS colony_tax_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  admin_owner_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  payer_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resource        text NOT NULL,
  trade_value     numeric NOT NULL,
  rate_pct        numeric NOT NULL,
  tax_amount      numeric NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_colony_tax_ledger_location
  ON colony_tax_ledger (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_colony_tax_ledger_owner
  ON colony_tax_ledger (admin_owner_id, created_at DESC);

-- RLS: Steuersätze sind öffentlich lesbar (Spieler sollen vor dem Handel
-- wissen, was sie zahlen), nur der Verwaltungs-Eigentümer darf sie ändern
-- (Schreibzugriff läuft über Service Role in der API-Route, nicht direkt).
ALTER TABLE colony_tax_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colony_tax_rates_select_all" ON colony_tax_rates;
CREATE POLICY "colony_tax_rates_select_all" ON colony_tax_rates FOR SELECT USING (true);

ALTER TABLE colony_tax_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colony_tax_ledger_select_own" ON colony_tax_ledger;
CREATE POLICY "colony_tax_ledger_select_own" ON colony_tax_ledger FOR SELECT
  USING (auth.uid() = admin_owner_id OR auth.uid() = payer_id);
