-- 20260915164500_tharsis_energy_reconciliation.sql
-- Tharsis Hub — additive Energy-Reconciliation E0
--
-- Production can legitimately contain the older Mars alpha layout without the
-- historical destructive 20260830190000_tharsis_hub_start_seed migration.
-- This forward-only reconciliation materializes ONLY the nine canonical energy
-- assets whose exact cells are free. It deliberately does not delete, move or
-- reinterpret any existing Mars alpha building and it does not synthesize the
-- later location_utilities model when that schema is absent.
--
-- Canonical source: lib/game/seeds/tharsisHubSeed.ts
--   D1: reactor (5,27), reactor (4,27), black-start (6,27)
--   D2: reactor (5,1),  reactor (6,1),  black-start (6,2)
--   D3: reactor (21,27), reactor (22,27), black-start (22,26)
--
-- Safety properties:
--   * fail closed if any target cell contains a non-canonical occupant;
--   * preserve an already-present exact STATE asset;
--   * never DELETE/UPDATE existing tile_entities;
--   * register missing building definitions but never overwrite later ones;
--   * keep electrical MW availability, storage depth and grid throughput unresolved.

SET search_path TO public;

INSERT INTO building_definitions
  (key, name, description, category, tier, cost_credits, build_time_ticks,
   production, consumption, population_bonus, allowed_locations, is_active)
VALUES
  ('reactor_module','Reaktormodul','Nennleistung ca. 1,25 MW · 2 Module je Energie-Komplex','production',2,12000,10,
   '[{"resource":"energy","amount":8}]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('black_start','Black-Start-/Speicherknoten','Integrierter Schwarzstart- und Speicherknoten je Energie-Komplex','infrastructure',2,5000,4,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  mars_id uuid;
  bad_definition text;
  collision record;
  reactor_count integer;
  black_start_count integer;
BEGIN
  SELECT id INTO mars_id
  FROM locations
  WHERE slug = 'mars'
  LIMIT 1;

  IF mars_id IS NULL THEN
    RAISE EXCEPTION 'Tharsis energy reconciliation: location mars not found';
  END IF;

  -- Existing definitions are accepted only when their gameplay semantics still
  -- match the canonical seed. A later incompatible definition must be resolved
  -- deliberately rather than silently overwritten by this reconciliation.
  SELECT key INTO bad_definition
  FROM building_definitions
  WHERE key = 'reactor_module'
    AND NOT (
      category = 'production'
      AND tier = 2
      AND production = '[{"resource":"energy","amount":8}]'::jsonb
      AND consumption = '[]'::jsonb
      AND 0 = population_bonus
      AND is_active = true
      AND (allowed_locations IS NULL OR 'mars' = ANY(allowed_locations))
    )
  LIMIT 1;

  IF bad_definition IS NOT NULL THEN
    RAISE EXCEPTION 'Tharsis energy reconciliation: incompatible building definition %', bad_definition;
  END IF;

  SELECT key INTO bad_definition
  FROM building_definitions
  WHERE key = 'black_start'
    AND NOT (
      category = 'infrastructure'
      AND tier = 2
      AND production = '[]'::jsonb
      AND consumption = '[]'::jsonb
      AND 0 = population_bonus
      AND is_active = true
      AND (allowed_locations IS NULL OR 'mars' = ANY(allowed_locations))
    )
  LIMIT 1;

  IF bad_definition IS NOT NULL THEN
    RAISE EXCEPTION 'Tharsis energy reconciliation: incompatible building definition %', bad_definition;
  END IF;

  -- Validate every target before inserting anything. Exact canonical STATE rows
  -- are idempotent; every other occupant is a hard conflict.
  FOR collision IN
    WITH targets(row_no, col_no, expected_entity) AS (
      VALUES
        (5::smallint, 27::smallint, 'reactor_module'::text),
        (4::smallint, 27::smallint, 'reactor_module'::text),
        (6::smallint, 27::smallint, 'black_start'::text),
        (5::smallint,  1::smallint, 'reactor_module'::text),
        (6::smallint,  1::smallint, 'reactor_module'::text),
        (6::smallint,  2::smallint, 'black_start'::text),
        (21::smallint, 27::smallint, 'reactor_module'::text),
        (22::smallint, 27::smallint, 'reactor_module'::text),
        (22::smallint, 26::smallint, 'black_start'::text)
    )
    SELECT
      t.row_no,
      t.col_no,
      t.expected_entity,
      te.id,
      te.entity_id,
      te.owner_class,
      te.is_state_owned
    FROM targets t
    JOIN tile_entities te
      ON te.location_id = mars_id
     AND te.tile_level = 0
     AND te.tile_row = t.row_no
     AND te.tile_col = t.col_no
    WHERE NOT (
      te.entity_type = 'building'
      AND te.entity_id = t.expected_entity
      AND te.owner_class = 'STATE'
      AND te.is_state_owned = true
      AND te.owner_id IS NULL
      AND te.profile_id IS NULL
    )
  LOOP
    RAISE EXCEPTION
      'Tharsis energy reconciliation: target cell (%,%) for % occupied by incompatible asset % (%)',
      collision.row_no,
      collision.col_no,
      collision.expected_entity,
      collision.entity_id,
      collision.id;
  END LOOP;

  WITH targets(row_no, col_no, expected_entity) AS (
    VALUES
      (5::smallint, 27::smallint, 'reactor_module'::text),
      (4::smallint, 27::smallint, 'reactor_module'::text),
      (6::smallint, 27::smallint, 'black_start'::text),
      (5::smallint,  1::smallint, 'reactor_module'::text),
      (6::smallint,  1::smallint, 'reactor_module'::text),
      (6::smallint,  2::smallint, 'black_start'::text),
      (21::smallint, 27::smallint, 'reactor_module'::text),
      (22::smallint, 27::smallint, 'reactor_module'::text),
      (22::smallint, 26::smallint, 'black_start'::text)
  )
  INSERT INTO tile_entities
    (profile_id, location_id, tile_level, tile_row, tile_col,
     entity_type, entity_id, condition, status,
     owner_class, owner_id, is_state_owned)
  SELECT
    NULL,
    mars_id,
    0,
    t.row_no,
    t.col_no,
    'building',
    t.expected_entity,
    100,
    'active',
    'STATE',
    NULL,
    true
  FROM targets t
  WHERE NOT EXISTS (
    SELECT 1
    FROM tile_entities te
    WHERE te.location_id = mars_id
      AND te.tile_level = 0
      AND te.tile_row = t.row_no
      AND te.tile_col = t.col_no
  );

  SELECT count(*) INTO reactor_count
  FROM tile_entities
  WHERE location_id = mars_id
    AND tile_level = 0
    AND entity_type = 'building'
    AND entity_id = 'reactor_module'
    AND owner_class = 'STATE'
    AND is_state_owned = true
    AND (tile_row, tile_col) IN ((5,27),(4,27),(5,1),(6,1),(21,27),(22,27));

  SELECT count(*) INTO black_start_count
  FROM tile_entities
  WHERE location_id = mars_id
    AND tile_level = 0
    AND entity_type = 'building'
    AND entity_id = 'black_start'
    AND owner_class = 'STATE'
    AND is_state_owned = true
    AND (tile_row, tile_col) IN ((6,27),(6,2),(22,26));

  IF reactor_count <> 6 OR black_start_count <> 3 THEN
    RAISE EXCEPTION
      'Tharsis energy reconciliation incomplete: reactors=% black_start=%',
      reactor_count,
      black_start_count;
  END IF;
END $$;
