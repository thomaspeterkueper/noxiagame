-- supabase/migrations/003_base_values.sql
-- Fix für zwei sich aufschaukelnde Cron-Bugs:
--   1) population_max += habitatBonus  (jeden Tick erneut!)
--   2) production += gebäudeBonus      (jeden Tick erneut!)
-- Lösung: Basiswerte speichern, Cron berechnet jeden Tick frisch:
--   population_max = base + Habitate × 100
--   production     = base + Gebäude-Boni
-- Nebeneffekt: Kapazität/Produktion sinken automatisch bei Verkauf.

-- ════════════════════════════════════════════════════════════════
-- 1) Basis-Spalten
-- ════════════════════════════════════════════════════════════════
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS base_population_max integer;

ALTER TABLE location_resources
  ADD COLUMN IF NOT EXISTS base_production integer;

-- ════════════════════════════════════════════════════════════════
-- 2) Basiswerte setzen = aktuelle Werte MINUS Gebäude-Anteil.
--    ACHTUNG: Durch die Bugs sind die aktuellen Werte aufgebläht
--    (Bonus wurde über viele Ticks mehrfach addiert). Die Formel
--    unten zieht nur EINEN Bonus ab – prüfe die Ergebnisse und
--    korrigiere base-Werte ggf. manuell auf die ursprünglichen
--    Seed-Werte aus 001a_noxia_tables.sql!
-- ════════════════════════════════════════════════════════════════
UPDATE locations l
SET base_population_max = GREATEST(0,
  l.population_max - 100 * (
    SELECT count(*) FROM tile_entities te
    WHERE te.location_id = l.id
      AND te.entity_type = 'building'
      AND te.entity_id = 'habitat'
  )
);

UPDATE location_resources lr
SET base_production = GREATEST(0,
  lr.production
  - CASE WHEN lr.resource = 'metal' THEN 5 * (
      SELECT count(*) FROM tile_entities te
      WHERE te.location_id = lr.location_id
        AND te.entity_type = 'building' AND te.entity_id = 'mine')
    ELSE 0 END
  - CASE WHEN lr.resource = 'energy' THEN 4 * (
      SELECT count(*) FROM tile_entities te
      WHERE te.location_id = lr.location_id
        AND te.entity_type = 'building' AND te.entity_id = 'solar')
    ELSE 0 END
);

-- ════════════════════════════════════════════════════════════════
-- 3) Kontrolle: base-Werte mit den Seed-Werten vergleichen!
--    Falls aufgebläht → manuell auf Seeds zurücksetzen, z.B.:
--    UPDATE locations SET base_population_max = <seed>
--      WHERE slug = 'moon';
--    UPDATE location_resources SET base_production = <seed>
--      WHERE location_id = ... AND resource = '...';
-- ════════════════════════════════════════════════════════════════
SELECT l.slug, l.population, l.population_max, l.base_population_max
FROM locations l;

SELECT l.slug, lr.resource, lr.production, lr.base_production
FROM location_resources lr
JOIN locations l ON l.id = lr.location_id
ORDER BY l.slug, lr.resource;
