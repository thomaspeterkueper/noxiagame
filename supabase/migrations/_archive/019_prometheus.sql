-- supabase/migrations/019_prometheus.sql
-- Erstellt:     20.06.2026
-- Aktualisiert: 20.06.2026
--
-- Prometheus — L5-Station (Erde-Mond-System, 60° hinter der Erde).
-- Band 1-2 Ära (2087): ~500-800 Personen, operationell. Soma arbeitet hier.
--
-- Charakter: Energieautark (Solar), Wasser und Metall importabhängig.
--   → Energie günstig (Eigenproduktion), Wasser/Metall teuer.
--   → Kaufen: ja (alle drei). Verkaufen: vorerst nur Energie (sell_price > 1).
--      Wasser/Metall: sell_price = 1 (de facto kein Ankauf).
--
-- Orbital: L5 = gleicher Radius + Periode wie Erde, phase = −π/3 (60° zurück).
-- Erde↔Prometheus: konstant ~45 Einheiten → ~11s Reisezeit. Physikalisch korrekt.
--
-- Kein Bevölkerungs-Tick (wie Erde): population_max sehr hoch gesetzt,
-- is_supplied = true dauerhaft. Der Cron-Tick überspringt Prometheus nicht —
-- er läuft, aber die Werte sind stabil weil production >> consumption.
-- (Langfristig: eigener NPC-Tick für Prometheus, der Soma-Narrative folgt.)
--
-- Idempotent: ON CONFLICT DO NOTHING / DO UPDATE.

-- ── 1) Location ───────────────────────────────────────────────────────────────
INSERT INTO locations (slug, name, description, population, population_max, is_supplied, base_population_max)
VALUES (
  'prometheus',
  'Prometheus Station',
  'L5-Lagrange-Punkt. Energieautark, abgelegen. Hier beginnt alles.',
  650, 999999, true, 999999
)
ON CONFLICT (slug) DO NOTHING;

-- ── 2) Ressourcen ─────────────────────────────────────────────────────────────
-- Energie: Eigenproduktion via Solar-Array (hohe base_production).
-- Wasser/Metall: Importabhängig, kleiner Puffer, kein Eigenoutput.
INSERT INTO location_resources (location_id, resource, stock, production, consumption, base_production)
SELECT l.id, v.resource::resource_type, v.stock, v.production, v.consumption, v.production
FROM locations l,
(VALUES
  ('water',   80,    0, 3),
  ('energy', 400, 9999, 4),
  ('metal',  120,    0, 2)
) AS v(resource, stock, production, consumption)
WHERE l.slug = 'prometheus'
ON CONFLICT (location_id, resource) DO NOTHING;

-- ── 3) Marktpreise ────────────────────────────────────────────────────────────
-- Energie: günstig kaufen (40 Cr), Spieler können auch verkaufen (sell_price 30).
-- Wasser:  teuer (Station kauft von außen), kein Rückkauf (sell_price 1).
-- Metall:  teuer, kein Rückkauf.
INSERT INTO market_prices (location_id, resource, buy_price, sell_price, avg_sell_7)
SELECT l.id, v.resource::resource_type, v.buy, v.sell, v.sell
FROM locations l,
(VALUES
  ('water',  160,  1, 1),
  ('energy',  40, 30, 30),
  ('metal',  110,  1, 1)
) AS v(resource, buy, sell)
WHERE l.slug = 'prometheus'
ON CONFLICT (location_id, resource)
DO UPDATE SET buy_price = EXCLUDED.buy_price, sell_price = EXCLUDED.sell_price,
              avg_sell_7 = EXCLUDED.avg_sell_7;

-- ── 4) Colony Settings (steuerfrei, keine Governance-Komplexität jetzt) ───────
INSERT INTO colony_settings (location_id, tax_property, tax_transaction, tax_landing)
SELECT id, 0, 0, 0
FROM locations WHERE slug = 'prometheus'
ON CONFLICT (location_id) DO NOTHING;

-- ── 5) FLIGHT_ENERGY für Prometheus ──────────────────────────────────────────
-- Prometheus liegt im Lagrange-Punkt — kein Gravitationsfeld zu überwinden.
-- Alle Flüge zu/von Prometheus kosten wenig Energie (nur Bahnkorrektur).
-- Werte in ships.ts FLIGHT_ENERGY müssen entsprechend ergänzt werden (Code-Änderung).
-- Diese Migration ist reine DB-Seite; ships.ts wird separat angepasst.

-- ── Kontrolle ─────────────────────────────────────────────────────────────────
SELECT l.slug, l.name, l.population,
       mp.resource, mp.buy_price, mp.sell_price
FROM locations l
JOIN market_prices mp ON mp.location_id = l.id
WHERE l.slug = 'prometheus'
ORDER BY mp.resource;
