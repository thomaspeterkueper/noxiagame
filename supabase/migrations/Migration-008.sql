-- Migration 008: Colony Governance
-- Fügt governor_profile_id zu locations hinzu und erstellt colony_settings
-- Stand: Alpha 0.2

-- 1. Governor-Feld auf locations
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS governor_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN locations.governor_profile_id IS
  'Profil mit dem höchsten Gebäudewert (getSaleQuote) in dieser Kolonie. '
  'Wird vom Tick-Engine neu berechnet. NULL = keine aktive Verwaltung.';

-- 2. Colony Settings (ein Datensatz pro Kolonie)
CREATE TABLE IF NOT EXISTS colony_settings (
  location_id       uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  -- Grundsteuer: Cr pro Gebäude pro Tick (absoluter Betrag)
  tax_property      numeric(10,2) NOT NULL DEFAULT 0,
  -- Transaktionssteuer: Anteil (0.00–1.00) auf jeden Kauf/Verkauf
  tax_transaction   numeric(5,4)  NOT NULL DEFAULT 0
                    CHECK (tax_transaction >= 0 AND tax_transaction <= 1),
  -- Landegebühr: Cr pro Landung (pauschal)
  tax_landing       numeric(10,2) NOT NULL DEFAULT 0,
  -- Alle Sätze >= 0
  CHECK (tax_property  >= 0),
  CHECK (tax_landing   >= 0),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE colony_settings IS
  'Steuerparameter je Kolonie, einstellbar durch den aktuellen Governor.';

-- Initialdatensätze für alle bestehenden Kolonien (alle Sätze = 0)
INSERT INTO colony_settings (location_id)
  SELECT id FROM locations
  ON CONFLICT (location_id) DO NOTHING;

-- 3. RLS
ALTER TABLE colony_settings ENABLE ROW LEVEL SECURITY;

-- Jeder darf lesen (öffentliche Marktinfo)
CREATE POLICY "colony_settings_select_all"
  ON colony_settings FOR SELECT
  USING (true);

-- Schreiben nur über Service Role (API-Route prüft Governor-Status)
CREATE POLICY "colony_settings_write_service"
  ON colony_settings FOR ALL
  USING (false)
  WITH CHECK (false);
