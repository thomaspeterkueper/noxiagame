-- NOX-LIVING-20260831 — aktive Tharsis-Testkohorte aus kanonischem Start-Seed
-- 36 unbenannte aktive Personen innerhalb der aggregierten Gesamtbevölkerung 497.
-- Idempotent; alle Wohn-/Arbeitszuweisungen referenzieren reale Tharsis-Seedobjekte.

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.noxia_population_uuid(ref text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT (substr(md5('noxia-population:'||ref),1,8)||'-'||
          substr(md5('noxia-population:'||ref),9,4)||'-4'||
          substr(md5('noxia-population:'||ref),14,3)||'-8'||
          substr(md5('noxia-population:'||ref),18,3)||'-'||
          substr(md5('noxia-population:'||ref),21,12))::uuid;
$$;

CREATE OR REPLACE FUNCTION public.noxia_tharsis_ref_uuid(ref text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT (substr(md5('noxia-tharsis:'||ref),1,8)||'-'||
          substr(md5('noxia-tharsis:'||ref),9,4)||'-4'||
          substr(md5('noxia-tharsis:'||ref),14,3)||'-8'||
          substr(md5('noxia-tharsis:'||ref),18,3)||'-'||
          substr(md5('noxia-tharsis:'||ref),21,12))::uuid;
$$;

DO $$
DECLARE
  mars_id uuid;
  g integer;
  v_person_id uuid;
  home_seed text;
  work_seed text;
  v_role_code text;
  v_skill_code text;
  home_id uuid;
  work_id uuid;
BEGIN
  SELECT id INTO mars_id FROM locations WHERE slug = 'mars';
  IF mars_id IS NULL THEN
    RAISE EXCEPTION 'Tharsis active population seed: locations.slug=mars missing';
  END IF;

  IF (SELECT population FROM locations WHERE id = mars_id) <> 497 THEN
    RAISE EXCEPTION 'Tharsis active population seed requires aggregate population=497';
  END IF;

  FOR g IN 1..36 LOOP
    v_person_id := noxia_population_uuid('tharsis-active:'||g);
    home_seed := 'habitat_cluster_' || (((g - 1) % 6) + 1)::text;

    CASE ((g - 1) % 9)
      WHEN 0 THEN work_seed := 'medical_core';       v_role_code := 'medical';        v_skill_code := 'medicine';
      WHEN 1 THEN work_seed := 'eclss_hub_1';        v_role_code := 'eclss';          v_skill_code := 'maintenance';
      WHEN 2 THEN work_seed := 'water_isru_1';       v_role_code := 'water';          v_skill_code := 'process_engineering';
      WHEN 3 THEN work_seed := 'reactor_module_1';   v_role_code := 'energy';         v_skill_code := 'power_systems';
      WHEN 4 THEN work_seed := 'logistics_hub';      v_role_code := 'logistics';      v_skill_code := 'logistics';
      WHEN 5 THEN work_seed := 'workshop_heavy';     v_role_code := 'technician';     v_skill_code := 'maintenance';
      WHEN 6 THEN work_seed := 'material_complex_1'; v_role_code := 'geologist';      v_skill_code := 'geology';
      WHEN 7 THEN work_seed := 'logistics_hub';      v_role_code := 'rover_operator'; v_skill_code := 'vehicle_operations';
      ELSE        work_seed := 'command_node_1';     v_role_code := 'administrator';  v_skill_code := 'administration';
    END CASE;

    home_id := noxia_tharsis_ref_uuid('building:'||home_seed);
    work_id := noxia_tharsis_ref_uuid('building:'||work_seed);

    IF NOT EXISTS (SELECT 1 FROM tile_entities WHERE id = home_id AND location_id = mars_id AND entity_id = 'habitat_cluster') THEN
      RAISE EXCEPTION 'Tharsis active population seed: home object % missing', home_seed;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM tile_entities WHERE id = work_id AND location_id = mars_id) THEN
      RAISE EXCEPTION 'Tharsis active population seed: work object % missing', work_seed;
    END IF;

    INSERT INTO people (
      id, person_key, display_name, birth_year, current_location_id,
      simulation_tier, activity_state, last_action, last_decision_factors, last_tick
    ) VALUES (
      v_person_id, NULL, 'Tharsis Crew '||lpad(g::text,2,'0'), NULL, mars_id,
      'active', 'idle', NULL, '{"seed":"NOX-LIVING-20260831"}'::jsonb, 0
    )
    ON CONFLICT (id) DO UPDATE SET
      current_location_id = EXCLUDED.current_location_id,
      simulation_tier = 'active',
      updated_at = now();

    INSERT INTO person_assignments
      (id, person_id, assignment_type, location_id, tile_entity_id, employer_actor_id, role_code, starts_tick, is_active)
    VALUES
      (noxia_population_uuid('home:'||g), v_person_id, 'home', mars_id, home_id, NULL, NULL, 0, true)
    ON CONFLICT (id) DO UPDATE SET
      location_id = EXCLUDED.location_id, tile_entity_id = EXCLUDED.tile_entity_id,
      is_active = true, updated_at = now();

    INSERT INTO person_assignments
      (id, person_id, assignment_type, location_id, tile_entity_id, employer_actor_id, role_code, starts_tick, is_active)
    VALUES
      (noxia_population_uuid('work:'||g), v_person_id, 'work', mars_id, work_id, NULL, v_role_code, 0, true)
    ON CONFLICT (id) DO UPDATE SET
      location_id = EXCLUDED.location_id, tile_entity_id = EXCLUDED.tile_entity_id,
      role_code = EXCLUDED.role_code, is_active = true, updated_at = now();

    INSERT INTO person_needs (person_id, need_code, satisfaction, updated_tick)
    VALUES
      (v_person_id,'sustenance',0.90,0),
      (v_person_id,'rest',0.90,0),
      (v_person_id,'safety',0.95,0),
      (v_person_id,'social',0.80,0),
      (v_person_id,'purpose',0.85,0)
    ON CONFLICT (person_id, need_code) DO NOTHING;

    INSERT INTO person_skills (person_id, skill_code, level, experience, updated_tick)
    VALUES (v_person_id, v_skill_code, 0.55 + (((g - 1) % 4)::numeric * 0.05), 0, 0)
    ON CONFLICT (person_id, skill_code) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END LOOP;
END $$;

-- Akzeptanz: 36 kontrollierte unbenannte aktive Personen, vollständige Needs,
-- genau je ein aktives Zuhause/Arbeitsobjekt und ausschließlich reale Seed-IDs.
DO $$
DECLARE
  mars_id uuid := (SELECT id FROM locations WHERE slug='mars');
  cohort integer;
BEGIN
  SELECT count(*) INTO cohort
  FROM people
  WHERE id IN (SELECT noxia_population_uuid('tharsis-active:'||g) FROM generate_series(1,36) g)
    AND current_location_id = mars_id
    AND simulation_tier = 'active'
    AND person_key IS NULL;
  IF cohort <> 36 THEN RAISE EXCEPTION 'Expected 36 active unnamed Tharsis seed people, got %', cohort; END IF;

  IF EXISTS (
    SELECT p.id FROM people p
    WHERE p.id IN (SELECT noxia_population_uuid('tharsis-active:'||g) FROM generate_series(1,36) g)
      AND (SELECT count(*) FROM person_needs n WHERE n.person_id=p.id) <> 5
  ) THEN RAISE EXCEPTION 'Tharsis active population seed: incomplete needs'; END IF;

  IF EXISTS (
    SELECT p.id FROM people p
    WHERE p.id IN (SELECT noxia_population_uuid('tharsis-active:'||g) FROM generate_series(1,36) g)
      AND ((SELECT count(*) FROM person_assignments a WHERE a.person_id=p.id AND a.assignment_type='home' AND a.is_active) <> 1
        OR (SELECT count(*) FROM person_assignments a WHERE a.person_id=p.id AND a.assignment_type='work' AND a.is_active) <> 1)
  ) THEN RAISE EXCEPTION 'Tharsis active population seed: assignment cardinality invalid'; END IF;

  IF EXISTS (
    SELECT 1 FROM person_assignments a
    JOIN people p ON p.id=a.person_id
    LEFT JOIN tile_entities te ON te.id=a.tile_entity_id
    WHERE p.id IN (SELECT noxia_population_uuid('tharsis-active:'||g) FROM generate_series(1,36) g)
      AND a.is_active AND (a.tile_entity_id IS NULL OR te.id IS NULL OR te.location_id <> mars_id)
  ) THEN RAISE EXCEPTION 'Tharsis active population seed: dangling/non-Tharsis assignment'; END IF;

  IF (SELECT population FROM locations WHERE id=mars_id) <> 497 THEN
    RAISE EXCEPTION 'Tharsis aggregate population changed unexpectedly';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.noxia_tharsis_ref_uuid(text);
DROP FUNCTION IF EXISTS public.noxia_population_uuid(text);
