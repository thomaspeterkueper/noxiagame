-- supabase/migrations/027_bank.sql
-- Erstellt:     22.06.2026
-- Version:      1.0.0
--
-- Zwei neue Tabellen für das Bank-System:
--   bank_accounts  — ein Konto pro Spieler pro Location (Einlage + Kredit)
--   bank_ledger    — append-only Buchungshistorie (Zinsen, Einzahlungen etc.)
--
-- Zinsen werden vom Tick-Cron gebucht (nicht hier).
-- Kreditlimit wird serverseitig aus trade_transactions berechnet (nicht gespeichert).

-- ── bank_accounts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id  uuid        NOT NULL REFERENCES locations(id)  ON DELETE CASCADE,
  deposit      numeric     NOT NULL DEFAULT 0 CHECK (deposit >= 0),
  loan         numeric     NOT NULL DEFAULT 0 CHECK (loan    >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (profile_id, location_id)
);

-- ── bank_ledger ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_ledger (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id   uuid        NOT NULL REFERENCES locations(id)  ON DELETE CASCADE,
  entry_type    text        NOT NULL CHECK (entry_type IN (
                              'deposit',       -- Einzahlung
                              'withdrawal',    -- Auszahlung
                              'loan_taken',    -- Kredit aufgenommen
                              'loan_repaid',   -- Kredit getilgt
                              'interest_deposit', -- Zinsgutschrift auf Einlage
                              'interest_loan'     -- Zinslast auf Kredit
                            )),
  amount        numeric     NOT NULL CHECK (amount > 0),
  balance_after numeric     NOT NULL,  -- Snapshot Einlage oder Kredit nach Buchung
  note          text,
  tick          integer,               -- Tick-Nummer bei Zins-Buchungen
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index für schnelle Abfragen pro Spieler/Location
CREATE INDEX IF NOT EXISTS idx_bank_ledger_profile_loc
  ON bank_ledger (profile_id, location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_profile
  ON bank_accounts (profile_id);

-- ── updated_at Trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_accounts_updated_at ON bank_accounts;
CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_bank_accounts_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_ledger   ENABLE ROW LEVEL SECURITY;

-- Spieler lesen nur eigene Konten
CREATE POLICY IF NOT EXISTS "bank_accounts_select_own"
  ON bank_accounts FOR SELECT
  USING (profile_id = auth.uid());

-- Service Role schreibt (API-Route nutzt service_role_key)
CREATE POLICY IF NOT EXISTS "bank_accounts_service_all"
  ON bank_accounts FOR ALL
  USING    (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "bank_ledger_select_own"
  ON bank_ledger FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY IF NOT EXISTS "bank_ledger_service_all"
  ON bank_ledger FOR ALL
  USING    (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
