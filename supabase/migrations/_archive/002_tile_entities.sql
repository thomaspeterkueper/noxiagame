-- supabase/migrations/002_tile_entities.sql  (FINAL, in einem Stück ausführen)
-- Generalisiert player_buildings → tile_entities:
--  - 3D-Position (tile_level für das 4-Ebenen-System: 0, -1, -2, -3)
--  - entity_type für künftige Fahrzeuge, Spezialisten, Schiffe
--  - built_at für Historie / spätere Alterung
-- Plus: sale_payout + tile_level in player_builds

-- ════════════════════════════════════════════════════════════════
-- 1) Neue Bestandstabelle
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tile_entities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tile_level   smallint NOT NULL DEFAULT 0,
  tile_row     smallint NOT NULL,
  tile_col     smallint NOT NULL,
  entity_type  text NOT NULL DEFAULT 'building',
  entity_id    text NOT NULL,
  built_at     timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tile_level_valid  CHECK (tile_level BETWEEN -3 AND 0),
  CONSTRAINT entity_type_valid CHECK (entity_type IN ('building','vehicle','specialist','ship'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_building_per_tile
  ON tile_entities (location_id, tile_level, tile_row, tile_col)
  WHERE entity_type = 'building';

CREATE INDEX IF NOT EXISTS idx_tile_entities_owner
  ON tile_entities (profile_id, location_id);
CREATE INDEX IF NOT EXISTS idx_tile_entities_grid
  ON tile_entities (location_id, tile_level);

ALTER TABLE tile_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY tile_entities_select ON tile_entities
  FOR SELECT USING (true);

GRANT ALL ON tile_entities TO service_role;

-- ════════════════════════════════════════════════════════════════
-- 2) player_builds erweitern
-- ════════════════════════════════════════════════════════════════
ALTER TABLE player_builds
  ADD COLUMN IF NOT EXISTS sale_payout integer;

ALTER TABLE player_builds
  ADD COLUMN IF NOT EXISTS tile_level smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN player_builds.sale_payout IS
  'Fixierte Auszahlung bei status=selling/sold. Preis gilt zum Verkaufsstart. Kann negativ sein (Entsorgung).';

-- ════════════════════════════════════════════════════════════════
-- 3) Backfill: n-tes Gebäude ↔ n-ter complete-Build derselben
--    (profile, location, building)-Gruppe. Gebäude ohne zugehörigen
--    Build (Alt-Daten) bekommen eindeutige Fallback-Kacheln.
-- ════════════════════════════════════════════════════════════════
WITH numbered_buildings AS (
  SELECT
    pb.*,
    row_number() OVER (
      PARTITION BY pb.profile_id, pb.location_id, pb.building
      ORDER BY pb.id
    ) AS rn
  FROM player_buildings pb
),
numbered_builds AS (
  SELECT
    plb.profile_id,
    plb.location_id,
    plb.buildable_id,
    plb.tile_row,
    plb.tile_col,
    plb.created_at,
    row_number() OVER (
      PARTITION BY plb.profile_id, plb.location_id, plb.buildable_id
      ORDER BY plb.created_at
    ) AS rn
  FROM player_builds plb
  WHERE plb.status = 'complete'
)
INSERT INTO tile_entities
  (profile_id, location_id, tile_level, tile_row, tile_col,
   entity_type, entity_id, built_at)
SELECT
  nb.profile_id,
  nb.location_id,
  0,
  COALESCE(b.tile_row, (nb.rn - 1) / 10),
  COALESCE(b.tile_col, (nb.rn - 1) % 10),
  'building',
  nb.building::text,
  COALESCE(b.created_at, now())
FROM numbered_buildings nb
LEFT JOIN numbered_builds b
  ON  b.profile_id   = nb.profile_id
  AND b.location_id  = nb.location_id
  AND b.buildable_id = nb.building::text
  AND b.rn           = nb.rn;

-- ════════════════════════════════════════════════════════════════
-- 4) Verifikation (Ergebnisse prüfen!)
-- ════════════════════════════════════════════════════════════════
SELECT
  (SELECT count(*) FROM player_buildings) AS bestand_alt,
  (SELECT count(*) FROM tile_entities)    AS bestand_neu;

-- player_buildings NICHT löschen, bis Cron + alle Routes auf
-- tile_entities umgestellt und getestet sind. Dann:
-- DROP TABLE player_buildings;
