-- supabase/migrations/005_price_avg.sql
-- Punkt 4 (Durchschnittsbewertung) + Retention für price_history.
--
-- Statt getSaleQuote bei jedem Verkauf 7 History-Zeilen mitteln zu lassen,
-- pflegen wir einen gleitenden Schnitt direkt an market_prices fort
-- (O(1)-Lesen, unabhängig vom Wachstum der History-Tabelle).
-- price_history bleibt für Charts/Archiv, wird aber per Retention gedeckelt.

-- 1) Aggregat-Spalte: gleitender 7-Tick-Schnitt des Verkaufspreises
ALTER TABLE market_prices
  ADD COLUMN IF NOT EXISTS avg_sell_7 integer;

COMMENT ON COLUMN market_prices.avg_sell_7 IS
  'Gleitender Schnitt sell_price der letzten ~7 Ticks. Vom Tick fortgeschrieben. Basis für getSaleQuote (statt manipulierbarem Spot-Preis). NULL = noch keine Historie → Quote fällt auf sell_price zurück.';

-- 2) Index für die 7-Tick-Abfrage im Tick (location+resource, neueste zuerst)
CREATE INDEX IF NOT EXISTS idx_price_history_lookup
  ON price_history (location_id, resource, tick_number DESC);

-- 3) Initialwert aus vorhandener Historie (letzte 7 Ticks je Ort/Ressource)
UPDATE market_prices mp
SET avg_sell_7 = sub.avg_sell
FROM (
  SELECT location_id, resource, round(avg(sell_price))::int AS avg_sell
  FROM (
    SELECT location_id, resource, sell_price,
           row_number() OVER (
             PARTITION BY location_id, resource
             ORDER BY tick_number DESC
           ) AS rn
    FROM price_history
  ) ranked
  WHERE rn <= 7
  GROUP BY location_id, resource
) sub
WHERE mp.location_id = sub.location_id
  AND mp.resource    = sub.resource;

-- Kontrolle: avg_sell_7 sollte jetzt nahe sell_price liegen
SELECT location_id, resource, sell_price, avg_sell_7 FROM market_prices ORDER BY resource;
