-- Migration 010: Governor-Berechnung + Grundsteuer im Tick
-- Erweitert die Tick-Logik um:
--   a) Governor neu berechnen (größter Gebäudewert je Kolonie)
--   b) Grundsteuer buchen
-- Stand: Alpha 0.2
--
-- HINWEIS: Diese Migration fügt nur die SQL-Hilfsfunktionen hinzu.
-- Die Einbindung in lib/game/tick.ts erfolgt in der Code-Änderung.

-- Funktion: Governor je Kolonie neu berechnen
-- Logik: Wer hat die meisten Gebäude (COUNT) in tile_entities?
-- Später erweiterbar auf Gebäudewert (getSaleQuote) sobald das serverseitig berechenbar ist.
CREATE OR REPLACE FUNCTION recalculate_governors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE locations l
  SET governor_profile_id = sub.profile_id
  FROM (
    SELECT
      location_id,
      profile_id,
      COUNT(*) AS building_count
    FROM tile_entities
    WHERE entity_type = 'building'
      AND profile_id IS NOT NULL
    GROUP BY location_id, profile_id
    ORDER BY location_id, building_count DESC
  ) sub
  WHERE l.id = sub.location_id
    -- Nur den Spieler mit den meisten Gebäuden nehmen
    AND sub.building_count = (
      SELECT MAX(building_count2)
      FROM (
        SELECT COUNT(*) AS building_count2
        FROM tile_entities te2
        WHERE te2.location_id = l.id
          AND te2.entity_type = 'building'
          AND te2.profile_id IS NOT NULL
        GROUP BY te2.profile_id
      ) maxsub
    );

  -- Kolonien ohne Gebäude: Governor auf NULL setzen
  UPDATE locations
  SET governor_profile_id = NULL
  WHERE id NOT IN (
    SELECT DISTINCT location_id
    FROM tile_entities
    WHERE entity_type = 'building'
      AND profile_id IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION recalculate_governors() IS
  'Setzt governor_profile_id auf den Spieler mit den meisten Gebäuden je Kolonie. '
  'Wird einmal pro Tick aufgerufen. Bei Gleichstand: erster Eintrag (ältestes Gebäude).';

-- Funktion: Grundsteuer für einen Tick buchen
CREATE OR REPLACE FUNCTION collect_property_tax(p_tick bigint)
RETURNS TABLE(location_id uuid, entries_written int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH taxable AS (
    -- Alle Gebäude in Kolonien mit Grundsteuer > 0
    SELECT
      te.profile_id,
      te.location_id,
      cs.tax_property,
      COUNT(*) AS building_count
    FROM tile_entities te
    JOIN colony_settings cs ON cs.location_id = te.location_id
    WHERE te.entity_type = 'building'
      AND te.profile_id IS NOT NULL
      AND cs.tax_property > 0
    GROUP BY te.profile_id, te.location_id, cs.tax_property
  ),
  charged AS (
    -- Steuer vom Spieler abziehen
    UPDATE profiles p
    SET credits = p.credits - (t.tax_property * t.building_count)
    FROM taxable t
    WHERE p.id = t.profile_id
      AND p.credits >= (t.tax_property * t.building_count) -- kein Kredit ins Negative (vorerst)
    RETURNING t.location_id, t.profile_id,
              (t.tax_property * t.building_count) AS amount_charged
  ),
  ledger_entries AS (
    -- In colony_ledger buchen
    INSERT INTO colony_ledger (location_id, tick, entry_type, profile_id, amount, note)
    SELECT
      c.location_id,
      p_tick,
      'tax_property',
      c.profile_id,
      c.amount_charged,
      'Grundsteuer Tick ' || p_tick
    FROM charged c
    RETURNING location_id
  )
  SELECT le.location_id, COUNT(*)::int AS entries_written
  FROM ledger_entries le
  GROUP BY le.location_id;
END;
$$;

COMMENT ON FUNCTION collect_property_tax(bigint) IS
  'Zieht Grundsteuer von allen Gebäude-Eigentümern ab und bucht ins colony_ledger. '
  'Spieler ohne ausreichende Credits werden in diesem Tick übersprungen (kein Minus). '
  'Gibt zurück: wie viele Buchungen je Kolonie.';
