-- supabase/migrations/20260719150000_building_trades.sql
-- Spieler-zu-Spieler Gebäudekauf (NOX-0009)
-- Erstellt: 19.07.2026

SET search_path TO public;

-- asking_price: Eigentümer setzt Verkaufspreis (NULL = nicht zum Verkauf)
ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS asking_price integer;

-- building_trades: Transaktionshistorie für Gebäudeverkäufe
CREATE TABLE IF NOT EXISTS building_trades (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id      uuid        NOT NULL,  -- tile_entities.id (Snapshot, kann gelöscht sein)
  entity_key     text        NOT NULL,  -- building type (mine, solar etc.)
  location_id    uuid        NOT NULL REFERENCES locations(id),
  tile_row       smallint    NOT NULL,
  tile_col       smallint    NOT NULL,
  seller_id      uuid        NOT NULL REFERENCES profiles(id),
  buyer_id       uuid        NOT NULL REFERENCES profiles(id),
  price          integer     NOT NULL,
  traded_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_building_trades_seller
  ON building_trades (seller_id, traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_building_trades_buyer
  ON building_trades (buyer_id, traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_building_trades_location
  ON building_trades (location_id, traded_at DESC);

ALTER TABLE building_trades ENABLE ROW LEVEL SECURITY;

-- Eigene Trades lesen (als Käufer oder Verkäufer)
DROP POLICY IF EXISTS "trades_select_own" ON building_trades;
CREATE POLICY "trades_select_own"
  ON building_trades FOR SELECT
  USING (seller_id = auth.uid() OR buyer_id = auth.uid());

-- Service Role darf alles
DROP POLICY IF EXISTS "trades_service_all" ON building_trades;
CREATE POLICY "trades_service_all"
  ON building_trades FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON building_trades TO service_role;
GRANT ALL ON building_trades TO authenticated;

-- Kontrolle
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tile_entities'
  AND column_name = 'asking_price';
