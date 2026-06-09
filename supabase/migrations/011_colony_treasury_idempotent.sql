-- Migration 011: Grundsteuer idempotent machen
-- Stand: Alpha 0.2
--
-- PROBLEM in 010: collect_property_tax(p_tick) zog bei JEDEM Aufruf erneut ab
-- und schrieb eine weitere Ledger-Zeile — kein Schutz gegen Doppelausführung
-- desselben Ticks. Bei der Lazy-Tick-Engine (Catch-up/Retry) drohte
-- Doppelbesteuerung. Der tick_governance_patch behauptete fälschlich
-- Idempotenz; ERST diese Migration macht sie wahr.
--
-- LÖSUNG:
--   a) Partieller Unique-Index: max. EINE tax_property-Buchung je
--      (Kolonie, Spieler, Tick).
--   b) Funktion umgebaut auf "Insert-zuerst": erst ins Ledger schreiben
--      (ON CONFLICT DO NOTHING), DANN nur für die TATSÄCHLICH neu
--      eingefügten Zeilen Credits abziehen. So bleiben Ledger und Credits
--      immer konsistent; ein zweiter Lauf desselben Ticks tut nichts.
--   c) #variable_conflict use_column — sonst ist `location_id` im
--      ON CONFLICT mehrdeutig (kollidiert mit dem RETURNS-TABLE-Namen).
--
-- Verifiziert (Postgres 16): Lauf 1 bucht, Lauf 2 (gleicher Tick) ändert
-- nichts, Lauf 3 (neuer Tick) bucht wieder.
--
-- HINWEIS: Der Index entsteht problemlos, solange noch keine doppelten
-- tax_property-Zeilen existieren (vor Tick-Integration der Fall). Liegen
-- bereits Duplikate vor, müssten diese zuerst dedupliziert werden.

-- a) Idempotenz-Schlüssel
CREATE UNIQUE INDEX IF NOT EXISTS colony_ledger_tax_property_once
  ON colony_ledger (location_id, profile_id, tick)
  WHERE entry_type = 'tax_property';

-- b) + c) Funktion ersetzen
CREATE OR REPLACE FUNCTION collect_property_tax(p_tick bigint)
RETURNS TABLE(location_id uuid, entries_written int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH taxable AS (
    -- Gebäude je (Spieler, Kolonie) in Kolonien mit Grundsteuer > 0
    SELECT
      te.profile_id,
      te.location_id,
      cs.tax_property,
      COUNT(*) AS building_count,
      (cs.tax_property * COUNT(*))::numeric(12,2) AS amount
    FROM tile_entities te
    JOIN colony_settings cs ON cs.location_id = te.location_id
    WHERE te.entity_type = 'building'
      AND te.profile_id IS NOT NULL
      AND cs.tax_property > 0
    GROUP BY te.profile_id, te.location_id, cs.tax_property
  ),
  affordable AS (
    -- Nur wer die Steuer für DIESE Kolonie aufbringen kann.
    -- (Bekannte Grenze: bei Gebäuden in mehreren Kolonien wird je Kolonie
    --  gegen denselben Startsaldo geprüft — die Summe kann den Saldo leicht
    --  ins Minus drücken. Verhalten wie in 010; spätere Härtung möglich.)
    SELECT t.*
    FROM taxable t
    JOIN profiles p ON p.id = t.profile_id
    WHERE p.credits >= t.amount
  ),
  inserted AS (
    -- INSERT ZUERST. Doppellauf desselben Ticks → Konflikt → keine Zeile.
    INSERT INTO colony_ledger (location_id, tick, entry_type, profile_id, amount, note)
    SELECT
      a.location_id,
      p_tick,
      'tax_property',
      a.profile_id,
      a.amount,
      'Grundsteuer Tick ' || p_tick
    FROM affordable a
    ON CONFLICT (location_id, profile_id, tick) WHERE entry_type = 'tax_property'
    DO NOTHING
    RETURNING colony_ledger.location_id, colony_ledger.profile_id, colony_ledger.amount
  ),
  charged AS (
    -- Credits NUR für tatsächlich neu gebuchte Zeilen abziehen.
    UPDATE profiles p
    SET credits = p.credits - i.amount
    FROM inserted i
    WHERE p.id = i.profile_id
    RETURNING i.location_id
  )
  SELECT c.location_id, COUNT(*)::int AS entries_written
  FROM charged c
  GROUP BY c.location_id;
END;
$$;

COMMENT ON FUNCTION collect_property_tax(bigint) IS
  'Idempotente Grundsteuer (Migration 011): bucht je (Kolonie, Spieler, Tick) '
  'höchstens einmal ins colony_ledger und zieht NUR für neu gebuchte Zeilen '
  'Credits ab. Mehrfachausführung desselben Ticks ist folgenlos.';
