-- NOXIA-LIVING-0001 — kontrollierte Testpopulation v0.1
-- 8 persistente Personen an Mars (falls vorhanden).
-- Idempotent durch feste UUIDs. Gebäude bleiben Source of Truth in tile_entities.

SET search_path TO public;

DO $$
DECLARE
  mars_id uuid;
  fallback_building uuid;
  home_building uuid;
  science_building uuid;
  mine_building uuid;
  admin_building uuid;
  logistics_building uuid;
BEGIN
  SELECT id INTO mars_id FROM locations WHERE slug = 'mars' LIMIT 1;
  IF mars_id IS NULL THEN
    RAISE NOTICE 'Living Population seed skipped: location mars not found';
    RETURN;
  END IF;

  SELECT id INTO fallback_building
  FROM tile_entities
  WHERE location_id = mars_id AND entity_type = 'building'
  ORDER BY built_at NULLS LAST, id
  LIMIT 1;

  SELECT id INTO home_building
  FROM tile_entities
  WHERE location_id = mars_id AND entity_type = 'building' AND entity_id = 'habitat'
  ORDER BY built_at NULLS LAST, id
  LIMIT 1;
  home_building := COALESCE(home_building, fallback_building);

  SELECT id INTO science_building
  FROM tile_entities
  WHERE location_id = mars_id AND entity_type = 'building' AND entity_id IN ('school','academy','research_lab')
  ORDER BY CASE entity_id WHEN 'research_lab' THEN 0 WHEN 'academy' THEN 1 ELSE 2 END, built_at NULLS LAST, id
  LIMIT 1;
  science_building := COALESCE(science_building, fallback_building);

  SELECT id INTO mine_building
  FROM tile_entities
  WHERE location_id = mars_id AND entity_type = 'building' AND entity_id IN ('mine','ice_drill','water_extractor')
  ORDER BY built_at NULLS LAST, id
  LIMIT 1;
  mine_building := COALESCE(mine_building, fallback_building);

  SELECT id INTO admin_building
  FROM tile_entities
  WHERE location_id = mars_id AND entity_type = 'building' AND entity_id IN ('admin','command_center','bank')
  ORDER BY built_at NULLS LAST, id
  LIMIT 1;
  admin_building := COALESCE(admin_building, fallback_building);

  SELECT id INTO logistics_building
  FROM tile_entities
  WHERE location_id = mars_id AND entity_type = 'building' AND entity_id IN ('warehouse','landing_pad','docking_bay','shipyard')
  ORDER BY built_at NULLS LAST, id
  LIMIT 1;
  logistics_building := COALESCE(logistics_building, fallback_building);

  INSERT INTO people (id, display_name, birth_year, current_location_id, simulation_tier, activity_state)
  VALUES
    ('51000000-0000-4000-8000-000000000001','Mara Voss',2068,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000002','Kenji Arata',2071,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000003','Lina Okafor',2074,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000004','Samir Haddad',2065,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000005','Elena Ruiz',2077,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000006','Noah Becker',2070,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000007','Asha Menon',2073,mars_id,'active','idle'),
    ('51000000-0000-4000-8000-000000000008','Tomas Eriksen',2066,mars_id,'active','idle')
  ON CONFLICT (id) DO UPDATE SET current_location_id = EXCLUDED.current_location_id;

  INSERT INTO person_assignments (person_id, assignment_type, location_id, tile_entity_id, role_code, is_active)
  VALUES
    ('51000000-0000-4000-8000-000000000001','home',mars_id,home_building,'resident',true),
    ('51000000-0000-4000-8000-000000000002','home',mars_id,home_building,'resident',true),
    ('51000000-0000-4000-8000-000000000003','home',mars_id,home_building,'resident',true),
    ('51000000-0000-4000-8000-000000000004','home',mars_id,home_building,'resident',true),
    ('51000000-0000-4000-8000-000000000005','home',mars_id,home_building,'resident',true),
    ('51000000-0000-4000-8000-000000000006','home',mars_id,home_building,'resident',true),
    ('51000000-0000-4000-8000-000000000007','home',mars_id,home_building,'resident',true),
    ('51000000-0000-4000-8000-000000000008','home',mars_id,home_building,'resident',true)
  ON CONFLICT DO NOTHING;

  INSERT INTO person_assignments (person_id, assignment_type, location_id, tile_entity_id, role_code, is_active)
  VALUES
    ('51000000-0000-4000-8000-000000000001','work',mars_id,science_building,'scientist',true),
    ('51000000-0000-4000-8000-000000000002','work',mars_id,mine_building,'geologist',true),
    ('51000000-0000-4000-8000-000000000003','work',mars_id,mine_building,'technician',true),
    ('51000000-0000-4000-8000-000000000004','work',mars_id,logistics_building,'operator',true),
    ('51000000-0000-4000-8000-000000000005','work',mars_id,science_building,'scientist',true),
    ('51000000-0000-4000-8000-000000000006','work',mars_id,admin_building,'administrator',true),
    ('51000000-0000-4000-8000-000000000007','work',mars_id,logistics_building,'trader',true),
    ('51000000-0000-4000-8000-000000000008','work',mars_id,mine_building,'operator',true)
  ON CONFLICT DO NOTHING;

  INSERT INTO person_needs (person_id, need_code, satisfaction)
  SELECT p.id, n.need_code, 0.75 + ((row_number() OVER ()) % 5) * 0.04
  FROM people p
  CROSS JOIN (VALUES ('sustenance'),('rest'),('safety'),('social'),('purpose')) AS n(need_code)
  WHERE p.id::text LIKE '51000000-0000-4000-8000-00000000000%'
  ON CONFLICT (person_id, need_code) DO NOTHING;

  INSERT INTO person_skills (person_id, skill_code, level, experience)
  VALUES
    ('51000000-0000-4000-8000-000000000001','research',0.62,24),
    ('51000000-0000-4000-8000-000000000002','geology',0.68,31),
    ('51000000-0000-4000-8000-000000000003','maintenance',0.59,18),
    ('51000000-0000-4000-8000-000000000004','logistics',0.55,17),
    ('51000000-0000-4000-8000-000000000005','materials',0.64,27),
    ('51000000-0000-4000-8000-000000000006','administration',0.57,19),
    ('51000000-0000-4000-8000-000000000007','logistics',0.61,22),
    ('51000000-0000-4000-8000-000000000008','maintenance',0.52,15)
  ON CONFLICT (person_id, skill_code) DO NOTHING;
END $$;
