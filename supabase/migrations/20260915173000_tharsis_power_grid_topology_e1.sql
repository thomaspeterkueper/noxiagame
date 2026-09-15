-- 20260915173000_tharsis_power_grid_topology_e1.sql
-- Tharsis Hub — Electrical Grid E1
--
-- Forward-only reconciliation of the structural POWER topology only.
-- It intentionally does NOT replay the historical destructive Tharsis seed,
-- does NOT synthesize non-power utilities, and does NOT claim operational
-- continuity, breaker state, transmission MW, load flow, storage MWh/SOC or
-- firm capacity.
--
-- Canonical source: lib/game/seeds/tharsisHubSeed.ts
-- Runtime truth created here:
--   * 59 power backbone nodes on ring A
--   * 41 power backbone nodes on ring B
--   * a connected structural tree per backbone (58 + 40 edges)
--   * two power feeders for each of the 9 canonical energy assets (18 total)
--
-- Existing compatible rows are preserved. Any incompatible/pre-existing state
-- fails closed in the assertions below instead of being rewritten or deleted.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS location_utilities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  ring               text NOT NULL CHECK (ring IN ('A','B')),
  media              text[] NOT NULL DEFAULT '{}',
  node_row           smallint NOT NULL,
  node_col           smallint NOT NULL,
  attaches_entity_id uuid REFERENCES tile_entities(id) ON DELETE SET NULL,
  owner_class        text NOT NULL DEFAULT 'STATE',
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_utilities_ring
  ON location_utilities (location_id, ring);
CREATE INDEX IF NOT EXISTS idx_location_utilities_attaches
  ON location_utilities (attaches_entity_id)
  WHERE attaches_entity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_location_utilities_backbone_node
  ON location_utilities (location_id, ring, node_row, node_col)
  WHERE attaches_entity_id IS NULL;

ALTER TABLE location_utilities ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='location_utilities'
      AND policyname='location_utilities_e1_read_auth'
  ) THEN
    CREATE POLICY location_utilities_e1_read_auth
      ON location_utilities FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='location_utilities'
      AND policyname='location_utilities_e1_service'
  ) THEN
    CREATE POLICY location_utilities_e1_service
      ON location_utilities FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT ON location_utilities TO authenticated;
GRANT ALL ON location_utilities TO service_role;

-- E1 backbone nodes. These are the exact canonical A/B nodes that carry power.
WITH mars AS (
  SELECT id AS location_id FROM locations WHERE slug='mars'
), canonical_nodes(ring, node_row, node_col) AS (
  VALUES
    ('A',11,10),('A',11,11),('A',11,12),('A',11,13),('A',11,14),('A',11,15),('A',11,16),('A',11,17),('A',11,18),
    ('A',11,19),('A',12,19),('A',13,20),('A',14,20),('A',15,20),('A',16,20),('A',18,20),('A',19,20),
    ('A',20,21),('A',20,22),('A',20,23),('A',20,24),('A',20,25),('A',20,26),
    ('A',19,26),('A',18,26),('A',17,26),('A',16,26),('A',15,26),('A',14,26),
    ('A',12,26),('A',12,25),('A',12,24),('A',12,22),('A',12,21),
    ('A',19,9),('A',20,8),('A',20,5),('A',20,4),('A',20,3),('A',20,2),
    ('A',11,9),('A',10,8),('A',9,8),('A',8,7),('A',7,6),('A',6,5),('A',5,4),('A',4,3),('A',3,3),('A',2,3),
    ('A',10,24),('A',9,25),('A',8,25),('A',8,26),('A',5,25),('A',4,25),('A',3,25),('A',2,26),('A',2,27),
    ('B',13,8),('B',14,8),('B',15,8),('B',16,8),('B',17,8),
    ('B',12,8),('B',12,7),('B',12,6),
    ('B',13,6),('B',14,6),('B',15,6),('B',16,6),('B',17,6),('B',18,6),
    ('B',19,5),('B',19,6),('B',19,7),
    ('B',11,6),('B',10,6),('B',9,7),('B',8,6),('B',7,5),('B',6,4),('B',5,3),('B',4,1),('B',3,1),('B',2,1),
    ('B',10,25),('B',9,26),('B',8,27),('B',6,28),('B',5,28),('B',4,28),('B',4,29),('B',3,29),
    ('B',18,22),('B',19,22),('B',21,23),('B',21,24),('B',21,25),('B',21,26)
)
INSERT INTO location_utilities
  (location_id, ring, media, node_row, node_col, attaches_entity_id, owner_class)
SELECT mars.location_id, n.ring, ARRAY['power']::text[], n.node_row, n.node_col, NULL, 'STATE'
FROM mars CROSS JOIN canonical_nodes n
WHERE NOT EXISTS (
  SELECT 1 FROM location_utilities existing
  WHERE existing.location_id = mars.location_id
    AND existing.ring = n.ring
    AND existing.node_row = n.node_row
    AND existing.node_col = n.node_col
    AND existing.attaches_entity_id IS NULL
)
ON CONFLICT DO NOTHING;

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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='location_utility_edges'
      AND policyname='location_utility_edges_e1_read_auth'
  ) THEN
    CREATE POLICY location_utility_edges_e1_read_auth
      ON location_utility_edges FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='location_utility_edges'
      AND policyname='location_utility_edges_e1_service'
  ) THEN
    CREATE POLICY location_utility_edges_e1_service
      ON location_utility_edges FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT ON location_utility_edges TO authenticated;
GRANT ALL ON location_utility_edges TO service_role;

-- E1 physical edges. The canonical seed provides backbone nodes, not breaker
-- segments. We persist one deterministic connected structural tree per A/B
-- backbone. This proves physical reachability only; it is NOT an operational
-- continuity or N-1 power-flow claim.
WITH mars AS (
  SELECT id AS location_id FROM locations WHERE slug='mars'
), power_nodes AS (
  SELECT DISTINCT lu.location_id, lu.ring, lu.node_row, lu.node_col
  FROM location_utilities lu
  JOIN mars ON mars.location_id = lu.location_id
  WHERE lu.attaches_entity_id IS NULL
    AND lu.ring IN ('A','B')
    AND ARRAY['power']::text[] <@ lu.media
), ordered_nodes AS (
  SELECT *, row_number() OVER (
    PARTITION BY location_id, ring ORDER BY node_row, node_col
  ) AS rn
  FROM power_nodes
), edges AS (
  SELECT
    child.location_id,
    child.ring,
    parent.node_row AS from_row,
    parent.node_col AS from_col,
    child.node_row AS to_row,
    child.node_col AS to_col,
    (abs(child.node_row-parent.node_row)+abs(child.node_col-parent.node_col))::smallint AS length_tiles
  FROM ordered_nodes child
  JOIN LATERAL (
    SELECT p.node_row, p.node_col
    FROM ordered_nodes p
    WHERE p.location_id=child.location_id
      AND p.ring=child.ring
      AND p.rn < child.rn
    ORDER BY abs(child.node_row-p.node_row)+abs(child.node_col-p.node_col), p.node_row, p.node_col
    LIMIT 1
  ) parent ON true
  WHERE child.rn > 1
)
INSERT INTO location_utility_edges
  (location_id, ring, from_row, from_col, to_row, to_col, media, length_tiles, routing_class, owner_class)
SELECT location_id, ring, from_row, from_col, to_row, to_col,
       ARRAY['power']::text[], length_tiles, 'dedicated', 'STATE'
FROM edges
WHERE length_tiles > 0
ON CONFLICT (location_id, ring, from_row, from_col, to_row, to_col) DO NOTHING;

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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='location_utility_feeders'
      AND policyname='location_utility_feeders_e1_read_auth'
  ) THEN
    CREATE POLICY location_utility_feeders_e1_read_auth
      ON location_utility_feeders FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='location_utility_feeders'
      AND policyname='location_utility_feeders_e1_service'
  ) THEN
    CREATE POLICY location_utility_feeders_e1_service
      ON location_utility_feeders FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT ON location_utility_feeders TO authenticated;
GRANT ALL ON location_utility_feeders TO service_role;

-- E1 energy feeders. Each of the six reactor modules and three black-start
-- nodes must have one independent structural feed from A and one from B.
WITH mars AS (
  SELECT id AS location_id FROM locations WHERE slug='mars'
), feeder_targets(seed_object_id, entity_key, object_row, object_col, ring, node_row, node_col) AS (
  VALUES
    ('reactor_module_1','reactor_module',5,27,'A',5,25),
    ('reactor_module_1','reactor_module',5,27,'B',5,28),
    ('reactor_module_2','reactor_module',4,27,'A',4,25),
    ('reactor_module_2','reactor_module',4,27,'B',4,28),
    ('black_start_1','black_start',6,27,'A',5,25),
    ('black_start_1','black_start',6,27,'B',6,28),
    ('reactor_module_3','reactor_module',5,1,'A',5,4),
    ('reactor_module_3','reactor_module',5,1,'B',4,1),
    ('reactor_module_4','reactor_module',6,1,'A',6,5),
    ('reactor_module_4','reactor_module',6,1,'B',5,3),
    ('black_start_2','black_start',6,2,'A',6,5),
    ('black_start_2','black_start',6,2,'B',5,3),
    ('reactor_module_5','reactor_module',21,27,'A',20,26),
    ('reactor_module_5','reactor_module',21,27,'B',21,26),
    ('reactor_module_6','reactor_module',22,27,'A',20,26),
    ('reactor_module_6','reactor_module',22,27,'B',21,26),
    ('black_start_3','black_start',22,26,'A',20,25),
    ('black_start_3','black_start',22,26,'B',21,26)
), resolved AS (
  SELECT
    mars.location_id,
    te.id AS entity_id,
    t.ring,
    t.object_row,
    t.object_col,
    t.node_row,
    t.node_col,
    (abs(t.object_row-t.node_row)+abs(t.object_col-t.node_col))::smallint AS length_tiles
  FROM mars
  CROSS JOIN feeder_targets t
  JOIN tile_entities te
    ON te.location_id=mars.location_id
   AND te.entity_type='building'
   AND te.entity_id=t.entity_key
   AND te.tile_row=t.object_row
   AND te.tile_col=t.object_col
)
INSERT INTO location_utility_feeders
  (location_id, entity_id, ring, object_row, object_col, node_row, node_col,
   media, length_tiles, routing_class, owner_class)
SELECT location_id, entity_id, ring, object_row, object_col, node_row, node_col,
       ARRAY['power']::text[], length_tiles, 'dedicated', 'STATE'
FROM resolved
WHERE length_tiles > 0
ON CONFLICT (location_id, entity_id, ring, node_row, node_col) DO NOTHING;

-- Fail closed: E1 is accepted only when both structural backbones and all
-- canonical energy feeds are materially present. Counts refer to canonical
-- POWER rows only; no electrical operating state is inferred here.
DO $$
DECLARE
  mars_id uuid;
  a_nodes integer;
  b_nodes integer;
  a_edges integer;
  b_edges integer;
  matching_feeders integer;
  dual_fed_assets integer;
BEGIN
  SELECT id INTO mars_id FROM locations WHERE slug='mars';
  IF mars_id IS NULL THEN
    RAISE EXCEPTION 'Tharsis E1: location mars not found';
  END IF;

  SELECT count(DISTINCT (node_row,node_col)) INTO a_nodes
  FROM location_utilities
  WHERE location_id=mars_id AND ring='A' AND attaches_entity_id IS NULL
    AND ARRAY['power']::text[] <@ media;
  SELECT count(DISTINCT (node_row,node_col)) INTO b_nodes
  FROM location_utilities
  WHERE location_id=mars_id AND ring='B' AND attaches_entity_id IS NULL
    AND ARRAY['power']::text[] <@ media;

  IF a_nodes <> 59 OR b_nodes <> 41 THEN
    RAISE EXCEPTION 'Tharsis E1: canonical power backbone mismatch (A %, expected 59; B %, expected 41)', a_nodes, b_nodes;
  END IF;

  SELECT count(*) INTO a_edges
  FROM location_utility_edges
  WHERE location_id=mars_id AND ring='A' AND ARRAY['power']::text[] <@ media;
  SELECT count(*) INTO b_edges
  FROM location_utility_edges
  WHERE location_id=mars_id AND ring='B' AND ARRAY['power']::text[] <@ media;

  IF a_edges <> 58 OR b_edges <> 40 THEN
    RAISE EXCEPTION 'Tharsis E1: structural tree mismatch (A %, expected 58; B %, expected 40)', a_edges, b_edges;
  END IF;

  WITH expected(entity_key, object_row, object_col, ring, node_row, node_col) AS (
    VALUES
      ('reactor_module',5,27,'A',5,25),('reactor_module',5,27,'B',5,28),
      ('reactor_module',4,27,'A',4,25),('reactor_module',4,27,'B',4,28),
      ('black_start',6,27,'A',5,25),('black_start',6,27,'B',6,28),
      ('reactor_module',5,1,'A',5,4),('reactor_module',5,1,'B',4,1),
      ('reactor_module',6,1,'A',6,5),('reactor_module',6,1,'B',5,3),
      ('black_start',6,2,'A',6,5),('black_start',6,2,'B',5,3),
      ('reactor_module',21,27,'A',20,26),('reactor_module',21,27,'B',21,26),
      ('reactor_module',22,27,'A',20,26),('reactor_module',22,27,'B',21,26),
      ('black_start',22,26,'A',20,25),('black_start',22,26,'B',21,26)
  )
  SELECT count(*) INTO matching_feeders
  FROM expected e
  WHERE EXISTS (
    SELECT 1
    FROM location_utility_feeders f
    JOIN tile_entities te ON te.id=f.entity_id
    WHERE f.location_id=mars_id
      AND te.entity_type='building'
      AND te.entity_id=e.entity_key
      AND te.tile_row=e.object_row AND te.tile_col=e.object_col
      AND f.ring=e.ring
      AND f.node_row=e.node_row AND f.node_col=e.node_col
      AND ARRAY['power']::text[] <@ f.media
  );

  SELECT count(*) INTO dual_fed_assets
  FROM (
    SELECT f.entity_id
    FROM location_utility_feeders f
    JOIN tile_entities te ON te.id=f.entity_id
    WHERE f.location_id=mars_id
      AND te.entity_type='building'
      AND te.entity_id IN ('reactor_module','black_start')
      AND ARRAY['power']::text[] <@ f.media
    GROUP BY f.entity_id
    HAVING count(DISTINCT f.ring)=2
  ) dual;

  IF matching_feeders <> 18 OR dual_fed_assets <> 9 THEN
    RAISE EXCEPTION 'Tharsis E1: energy feeder mismatch (% canonical feeders, % dual-fed assets; expected 18/9)', matching_feeders, dual_fed_assets;
  END IF;
END $$;
