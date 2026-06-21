-- supabase/migrations/021_earth_stock_reset.sql
-- Erstellt:     20.06.2026
--
-- Setzt location_resources für Erde und Prometheus zurück.
-- Der Cron hat vor dem simulate_tick-Fix stocks leergefressen und
-- consumption auf ~10 Mio./Tick gesetzt. simulate_tick = false verhindert
-- neue Writes, aber alte Werte müssen bereinigt werden.
--
-- Idempotent.

UPDATE location_resources lr
SET
  stock       = 50000,
  production  = 9999,
  consumption = 0
FROM locations l
WHERE lr.location_id = l.id
  AND l.slug = 'earth';

UPDATE location_resources lr
SET
  stock       = CASE lr.resource WHEN 'energy' THEN 2000 ELSE 300 END,
  production  = CASE lr.resource WHEN 'energy' THEN 9999 ELSE 0   END,
  consumption = 0
FROM locations l
WHERE lr.location_id = l.id
  AND l.slug = 'prometheus';

-- Kontrolle:
SELECT l.slug, lr.resource, lr.stock, lr.production, lr.consumption
FROM location_resources lr
JOIN locations l ON l.id = lr.location_id
WHERE l.slug IN ('earth', 'prometheus')
ORDER BY l.slug, lr.resource;
