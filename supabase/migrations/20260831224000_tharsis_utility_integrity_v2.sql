-- supabase/migrations/20260831224000_tharsis_utility_integrity_v2.sql
-- Tharsis Hub — Utility-Integrität V2
--
-- Korrigiert drei im Implementierungs-/Layout-Review gefundene Modellfehler:
--   1. Ring A/B hatten Ankerpunkte, aber keine expliziten Graphkanten.
--   2. Redundanz wurde je Ring behauptet, obwohl einzelne Medien nur auf einem
--      Ring vorhanden waren.
--   3. Objekt↔Ring-Verbindungen waren nur logische Attachments, keine eigenen
--      physischen Feeder.
--
-- Modellgrenze:
-- Das 32×24-Grid bleibt die grobe Oberflächenprojektion. Utility-Kanten sind
-- dedizierte geschützte/unterirdische Leitungssegmente zwischen Ankerpunkten;
-- sie werden NICHT als Straßen-Tiles projiziert. Exakte Mikrotrassen liegen
-- unterhalb der Tile-Auflösung. Dadurch bleiben Fahrwege und Mediennetze
-- getrennte Systeme, ohne künstlich jede Leitung auf ein Straßentile zu legen.

SET search_path TO public;

-- ---------------------------------------------------------------------------
-- 1. Beide Backbones führen alle derzeit in Tharsis modellierten Medien.
--    Zwei Ring-Links zählen damit nur dann als Redundanz, wenn das konkrete
--    Medium tatsächlich auf beiden Pfaden vorhanden ist.
-- ---------------------------------------------------------------------------

UPDATE location_utilities
SET media = ARRAY['power','data','water','wastewater','o2','gas','thermal']::text[]
WHERE location_id = (SELECT id FROM locations WHERE slug = 'mars')
  AND ring IN ('A','B');

-- ---------------------------------------------------------------------------
-- 2. Explizite physische Graphkanten zwischen Backbone-Ankern.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS location_utility_edges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  ring           text NOT NULL CHECK (ring IN ('A','B')),
  from_row       smallint NOT NULL,
  from_col       smallint NOT NULL,
  to_row         smallint NOT NULL,
  to_col         smallint NOT NULL,
  media          text[] NOT NULL DEFAULT '{}',
  length_tiles   smallint NOT NULL CHECK (length_tiles > 0),
  routing_class  text NOT NULL DEFAULT 'dedicated'
                 CHECK (routing_class IN ('dedicated','protected','buried')),
  owner_class    text NOT NULL DEFAULT 'STATE',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, ring, from_row, from_col, to_row, to_col)
);

CREATE INDEX IF NOT EXISTS idx_location_utility_edges_ring
  ON location_utility_edges (location_id, ring);

ALTER TABLE location_utility_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_utility_edges_select" ON location_utility_edges;
CREATE POLICY "location_utility_edges_select"
  ON location_utility_edges FOR SELECT USING (true);

DROP POLICY IF EXISTS "location_utility_edges_service" ON location_utility_edges;
CREATE POLICY "location_utility_edges_service"
  ON location_utility_edges FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON location_utility_edges TO authenticated;
GRANT ALL ON location_utility_edges TO service_role;

DELETE FROM location_utility_edges
WHERE location_id = (SELECT id FROM locations WHERE slug = 'mars');

-- Deterministischer zusammenhängender Baum je Ring:
-- Anker werden stabil nach (row,col) geordnet; jeder Anker nach dem ersten
-- verbindet sich mit dem nächstgelegenen bereits eingebundenen Anker.
WITH mars AS (
  SELECT id AS location_id FROM locations WHERE slug = 'mars'
),
backbone_nodes AS (
  SELECT DISTINCT
    lu.location_id,
    lu.ring,
    lu.node_row,
    lu.node_col
  FROM location_utilities lu
  JOIN mars ON mars.location_id = lu.location_id
  WHERE lu.attaches_entity_id IS NULL
    AND lu.ring IN ('A','B')
),
ordered_nodes AS (
  SELECT
    location_id,
    ring,
    node_row,
    node_col,
    row_number() OVER (PARTITION BY location_id, ring ORDER BY node_row, node_col) AS rn
  FROM backbone_nodes
),
edges AS (
  SELECT
    child.location_id,
    child.ring,
    parent.node_row AS from_row,
    parent.node_col AS from_col,
    child.node_row AS to_row,
    child.node_col AS to_col,
    (abs(child.node_row - parent.node_row) + abs(child.node_col - parent.node_col))::smallint AS length_tiles
  FROM ordered_nodes child
  JOIN LATERAL (
    SELECT p.node_row, p.node_col
    FROM ordered_nodes p
    WHERE p.location_id = child.location_id
      AND p.ring = child.ring
      AND p.rn < child.rn
    ORDER BY
      abs(child.node_row - p.node_row) + abs(child.node_col - p.node_col),
      p.node_row,
      p.node_col
    LIMIT 1
  ) parent ON true
  WHERE child.rn > 1
)
INSERT INTO location_utility_edges
  (location_id, ring, from_row, from_col, to_row, to_col,
   media, length_tiles, routing_class, owner_class)
SELECT
  location_id,
  ring,
  from_row,
  from_col,
  to_row,
  to_col,
  ARRAY['power','data','water','wastewater','o2','gas','thermal']::text[],
  length_tiles,
  'dedicated',
  'STATE'
FROM edges
WHERE length_tiles > 0
ON CONFLICT (location_id, ring, from_row, from_col, to_row, to_col)
DO UPDATE SET
  media = EXCLUDED.media,
  length_tiles = EXCLUDED.length_tiles,
  routing_class = EXCLUDED.routing_class,
  owner_class = 'STATE';

-- ---------------------------------------------------------------------------
-- 3. Physische Feeder Objekt ↔ Backbone.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS location_utility_feeders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  entity_id      uuid NOT NULL REFERENCES tile_entities(id) ON DELETE CASCADE,
  ring           text NOT NULL CHECK (ring IN ('A','B')),
  object_row     smallint NOT NULL,
  object_col     smallint NOT NULL,
  node_row       smallint NOT NULL,
  node_col       smallint NOT NULL,
  media          text[] NOT NULL DEFAULT '{}',
  length_tiles   smallint NOT NULL CHECK (length_tiles > 0),
  routing_class  text NOT NULL DEFAULT 'dedicated'
                 CHECK (routing_class IN ('dedicated','protected','buried')),
  owner_class    text NOT NULL DEFAULT 'STATE',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, entity_id, ring, node_row, node_col)
);

CREATE INDEX IF NOT EXISTS idx_location_utility_feeders_entity
  ON location_utility_feeders (location_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_location_utility_feeders_ring
  ON location_utility_feeders (location_id, ring);

ALTER TABLE location_utility_feeders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_utility_feeders_select" ON location_utility_feeders;
CREATE POLICY "location_utility_feeders_select"
  ON location_utility_feeders FOR SELECT USING (true);

DROP POLICY IF EXISTS "location_utility_feeders_service" ON location_utility_feeders;
CREATE POLICY "location_utility_feeders_service"
  ON location_utility_feeders FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON location_utility_feeders TO authenticated;
GRANT ALL ON location_utility_feeders TO service_role;

DELETE FROM location_utility_feeders
WHERE location_id = (SELECT id FROM locations WHERE slug = 'mars');

INSERT INTO location_utility_feeders
  (location_id, entity_id, ring,
   object_row, object_col, node_row, node_col,
   media, length_tiles, routing_class, owner_class)
SELECT DISTINCT
  lu.location_id,
  lu.attaches_entity_id,
  lu.ring,
  te.tile_row,
  te.tile_col,
  lu.node_row,
  lu.node_col,
  ARRAY['power','data','water','wastewater','o2','gas','thermal']::text[],
  (abs(te.tile_row - lu.node_row) + abs(te.tile_col - lu.node_col))::smallint,
  'dedicated',
  'STATE'
FROM location_utilities lu
JOIN tile_entities te ON te.id = lu.attaches_entity_id
WHERE lu.location_id = (SELECT id FROM locations WHERE slug = 'mars')
  AND lu.attaches_entity_id IS NOT NULL
  AND lu.ring IN ('A','B')
  AND (abs(te.tile_row - lu.node_row) + abs(te.tile_col - lu.node_col)) > 0
ON CONFLICT (location_id, entity_id, ring, node_row, node_col)
DO UPDATE SET
  object_row = EXCLUDED.object_row,
  object_col = EXCLUDED.object_col,
  media = EXCLUDED.media,
  length_tiles = EXCLUDED.length_tiles,
  routing_class = EXCLUDED.routing_class,
  owner_class = 'STATE';

-- ---------------------------------------------------------------------------
-- 4. Integritätsprüfungen auf Datenebene.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  mars_id uuid;
  missing_count integer;
BEGIN
  SELECT id INTO mars_id FROM locations WHERE slug = 'mars';
  IF mars_id IS NULL THEN
    RAISE EXCEPTION 'Tharsis Utility V2: location mars nicht gefunden';
  END IF;

  -- Jeder Backbone-Anker außer dem ersten geordneten Anker pro Ring muss
  -- mindestens eine explizite Kante besitzen. Der Aufbau oben ergibt je Ring
  -- exakt n-1 Kanten für n Knoten und damit einen zusammenhängenden Baum.
  WITH counts AS (
    SELECT
      ring,
      count(DISTINCT (node_row, node_col)) FILTER (WHERE attaches_entity_id IS NULL) AS node_count
    FROM location_utilities
    WHERE location_id = mars_id
    GROUP BY ring
  ), edge_counts AS (
    SELECT ring, count(*) AS edge_count
    FROM location_utility_edges
    WHERE location_id = mars_id
    GROUP BY ring
  )
  SELECT count(*) INTO missing_count
  FROM counts c
  LEFT JOIN edge_counts e USING (ring)
  WHERE coalesce(e.edge_count, 0) <> greatest(c.node_count - 1, 0);

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Tharsis Utility V2: Backbone-Kantenzahl verletzt n-1-Baumregel';
  END IF;

  -- Jeder kritische Seed-Bestand, der im bisherigen Utility-Modell angebunden
  -- war, muss jetzt zwei physische Feeder besitzen: A und B.
  SELECT count(*) INTO missing_count
  FROM (
    SELECT lu.attaches_entity_id
    FROM location_utilities lu
    WHERE lu.location_id = mars_id
      AND lu.attaches_entity_id IS NOT NULL
    GROUP BY lu.attaches_entity_id
    HAVING count(DISTINCT lu.ring) = 2
  ) expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM location_utility_feeders f
    WHERE f.location_id = mars_id
      AND f.entity_id = expected.attaches_entity_id
    GROUP BY f.entity_id
    HAVING count(DISTINCT f.ring) = 2
       AND bool_and(ARRAY['power','data','water','wastewater','o2','gas','thermal']::text[] <@ f.media)
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Tharsis Utility V2: % doppelt angebundene Objekte ohne zwei vollständige physische Feeder', missing_count;
  END IF;
END $$;
