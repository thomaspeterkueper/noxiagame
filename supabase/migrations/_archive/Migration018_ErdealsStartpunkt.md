-- Migration 018: Erde als Startpunkt
-- Stand: 20.06.2026 · Alpha 0.1.5
--
-- Fix: population als bigint oder realistische kleinere Zahl verwenden.
-- locations.population ist int4 (max ~2.1 Mrd) — wir nehmen 999999999 (1 Mrd)
-- als symbolischen Wert. Die Erde hat keinen Bevölkerungs-Tick.

-- ── 1) Erde als Location ──────────────────────────────────────────────────────
INSERT INTO locations (slug, name, population, population_max, is_supplied, base_population_max)
VALUES ('earth', 'Erde / LEO-Terminal', 999999999, 999999999, true, 999999999)
ON CONFLICT (slug) DO NOTHING;

-- ── 2) Ressourcen der Erde (reine Exportbasis, kein Verbrauch im Tick) ────────
INSERT INTO location_resources (location_id, resource, stock, production, consumption, base_production)
SELECT l.id, v.resource::resource_type, v.stock, v.production, 0, v.production
FROM locations l,
(VALUES
  ('water',  999999, 9999),
  ('energy', 999999, 9999),
  ('metal',  999999, 9999)
) AS v(resource, stock, production)
WHERE l.slug = 'earth'
ON CONFLICT (location_id, resource) DO NOTHING;

-- ── 3) Marktpreise Erde ───────────────────────────────────────────────────────
INSERT INTO market_prices (location_id, resource, buy_price, sell_price, avg_sell_7)
SELECT l.id, v.resource::resource_type, v.buy, 1, 1
FROM locations l,
(VALUES
  ('water',  60),
  ('energy', 40),
  ('metal',  20)
) AS v(resource, buy)
WHERE l.slug = 'earth'
ON CONFLICT (location_id, resource)
DO UPDATE SET buy_price = EXCLUDED.buy_price, sell_price = 1;

-- ── 4) colony_settings für Erde ──────────────────────────────────────────────
INSERT INTO colony_settings (location_id, tax_property, tax_transaction, tax_landing)
SELECT id, 0, 0, 0
FROM locations WHERE slug = 'earth'
ON CONFLICT (location_id) DO NOTHING;

-- ── 5) grant_starting_energy Funktion ────────────────────────────────────────
CREATE OR REPLACE FUNCTION grant_starting_energy(p_ship_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ship_cargo (ship_id, resource, amount)
  VALUES (p_ship_id, 'energy', 20)
  ON CONFLICT (ship_id, resource)
  DO UPDATE SET amount = GREATEST(ship_cargo.amount, 20);
END;
$$;

-- ── Kontrolle ─────────────────────────────────────────────────────────────────
SELECT l.slug, l.name, mp.resource, mp.buy_price, mp.sell_price
FROM locations l
JOIN market_prices mp ON mp.location_id = l.id
WHERE l.slug = 'earth'
ORDER BY mp.resource;
