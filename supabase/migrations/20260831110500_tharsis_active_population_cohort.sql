-- NOX-LIVING-20260831 — controlled active cohort for canonical Tharsis Hub.
-- 30 additional unnamed representatives (person_key NULL). Together with the
-- existing eight v0.1 Mars representatives this keeps the active unnamed slice
-- bounded at 38 while locations.population remains the aggregate truth (497).

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.noxia_population_tharsis_uuid(ref text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT (substr(md5('noxia-tharsis:'||ref),1,8)||'-'||
          substr(md5('noxia-tharsis:'||ref),9,4)||'-4'||
          substr(md5('noxia-tharsis:'||ref),14,3)||'-8'||
          substr(md5('noxia-tharsis:'||ref),18,3)||'-'||
          substr(md5('noxia-tharsis:'||ref),21,12))::uuid
$$;

DO $$
DECLARE
  mars_id uuid;
  person_uuid uuid;
  home_entity uuid;
  work_entity uuid;
  home_seed text;
  seed record;
  unnamed_active integer;
BEGIN
  SELECT id INTO mars_id FROM locations WHERE slug='mars' LIMIT 1;
  IF mars_id IS NULL THEN RAISE EXCEPTION 'Tharsis active cohort: mars location missing'; END IF;

  IF (SELECT population FROM locations WHERE id=mars_id) <> 497 THEN
    RAISE EXCEPTION 'Tharsis active cohort requires canonical aggregate population 497';
  END IF;

  FOR seed IN SELECT * FROM (VALUES
      (1,'medical_clinician','medicine',0.72,'building','medical_core'),
      (2,'medical_clinician','medicine',0.66,'building','medical_core'),
      (3,'medical_technician','emergency_medicine',0.61,'building','medical_core'),
      (4,'medical_technician','emergency_medicine',0.59,'building','medical_annex'),
      (5,'eclss_operator','eclss',0.68,'building','eclss_hub_1'),
      (6,'eclss_operator','eclss',0.63,'building','eclss_hub_2'),
      (7,'eclss_operator','eclss',0.61,'building','eclss_hub_3'),
      (8,'water_process_operator','water_systems',0.64,'building','water_isru_1'),
      (9,'power_operator','power_systems',0.70,'building','reactor_module_1'),
      (10,'power_operator','power_systems',0.65,'building','reactor_module_3'),
      (11,'power_operator','power_systems',0.62,'building','reactor_module_5'),
      (12,'black_start_technician','power_systems',0.67,'building','black_start_1'),
      (13,'black_start_technician','power_systems',0.60,'building','black_start_2'),
      (14,'logistics_operator','logistics',0.64,'building','logistics_hub'),
      (15,'logistics_operator','logistics',0.58,'building','logistics_hub'),
      (16,'landing_operations','logistics',0.66,'building','landing_pad'),
      (17,'landing_operations','logistics',0.57,'building','landing_pad'),
      (18,'precision_technician','maintenance',0.67,'building','workshop_clean'),
      (19,'heavy_technician','maintenance',0.69,'building','workshop_heavy'),
      (20,'materials_technician','materials',0.62,'building','material_complex_1'),
      (21,'materials_technician','materials',0.59,'building','material_complex_2'),
      (22,'field_geologist','geology',0.71,'building','water_isru_1'),
      (23,'field_geologist','geology',0.64,'building','water_isru_2'),
      (24,'field_geologist','geology',0.60,'building','water_isru_3'),
      (25,'rescue_rover_operator','rover_operations',0.68,'vehicle','rescue_rover_1'),
      (26,'cargo_rover_operator','rover_operations',0.63,'vehicle','cargo_transporter_1'),
      (27,'maintenance_rover_operator','rover_operations',0.61,'vehicle','maintenance_vehicle_1'),
      (28,'operations_administration','administration',0.65,'building','command_node_1'),
      (29,'operations_administration','administration',0.60,'building','command_node_1'),
      (30,'operations_administration','administration',0.63,'building','command_node_2')
    ) AS s(ordinal,role_code,skill_code,skill_level,work_kind,work_seed_id)
  LOOP
    person_uuid := noxia_population_tharsis_uuid('person:active-cohort:'||lpad(seed.ordinal::text,3,'0'));
    home_seed := 'habitat_cluster_'||(((seed.ordinal - 1) % 6) + 1)::text;
    home_entity := noxia_population_tharsis_uuid('building:'||home_seed);
    work_entity := noxia_population_tharsis_uuid(seed.work_kind||':'||seed.work_seed_id);

    IF NOT EXISTS (
      SELECT 1 FROM tile_entities
      WHERE id=home_entity AND location_id=mars_id AND entity_type='building' AND entity_id='habitat_cluster'
    ) THEN
      RAISE EXCEPTION 'Tharsis active cohort: home seed % missing', home_seed;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM tile_entities
      WHERE id=work_entity AND location_id=mars_id AND entity_type=seed.work_kind
    ) THEN
      RAISE EXCEPTION 'Tharsis active cohort: work seed %.% missing', seed.work_kind, seed.work_seed_id;
    END IF;

    INSERT INTO people (
      id, person_key, display_name, birth_year, current_location_id,
      simulation_tier, activity_state, last_decision_factors
    ) VALUES (
      person_uuid, NULL, 'Tharsis Crew '||lpad(seed.ordinal::text,3,'0'), NULL, mars_id,
      'active', 'idle', '{"source":"NOX-LIVING-20260831"}'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      person_key=NULL,
      current_location_id=EXCLUDED.current_location_id,
      simulation_tier='active',
      updated_at=now();

    UPDATE person_assignments
      SET location_id=mars_id, tile_entity_id=home_entity, role_code='resident', updated_at=now()
      WHERE person_id=person_uuid AND assignment_type='home' AND is_active=true;
    IF NOT FOUND THEN
      INSERT INTO person_assignments
        (person_id,assignment_type,location_id,tile_entity_id,role_code,starts_tick,is_active)
      VALUES (person_uuid,'home',mars_id,home_entity,'resident',0,true);
    END IF;

    UPDATE person_assignments
      SET location_id=mars_id, tile_entity_id=work_entity, role_code=seed.role_code, updated_at=now()
      WHERE person_id=person_uuid AND assignment_type='work' AND is_active=true;
    IF NOT FOUND THEN
      INSERT INTO person_assignments
        (person_id,assignment_type,location_id,tile_entity_id,role_code,starts_tick,is_active)
      VALUES (person_uuid,'work',mars_id,work_entity,seed.role_code,0,true);
    END IF;

    INSERT INTO person_needs (person_id,need_code,satisfaction,updated_tick)
    VALUES
      (person_uuid,'sustenance',0.82,0),
      (person_uuid,'rest',0.82,0),
      (person_uuid,'safety',0.86,0),
      (person_uuid,'social',0.78,0),
      (person_uuid,'purpose',0.84,0)
    ON CONFLICT (person_id,need_code) DO NOTHING;

    INSERT INTO person_skills (person_id,skill_code,level,experience,updated_tick)
    VALUES (person_uuid,seed.skill_code,seed.skill_level,0,0)
    ON CONFLICT (person_id,skill_code) DO UPDATE SET
      level=GREATEST(person_skills.level,EXCLUDED.level),
      updated_at=now();
  END LOOP;

  SELECT count(*) INTO unnamed_active
  FROM people
  WHERE current_location_id=mars_id AND simulation_tier='active' AND person_key IS NULL;

  IF unnamed_active < 20 OR unnamed_active > 50 THEN
    RAISE EXCEPTION 'Tharsis active unnamed cohort out of bounds: % (expected 20..50)', unnamed_active;
  END IF;

  IF EXISTS (
    SELECT 1 FROM people p
    WHERE p.current_location_id=mars_id AND p.simulation_tier='active' AND p.person_key IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM person_assignments pa JOIN tile_entities te ON te.id=pa.tile_entity_id
        WHERE pa.person_id=p.id AND pa.assignment_type='home' AND pa.is_active=true
          AND pa.location_id=mars_id AND te.location_id=mars_id AND te.entity_id='habitat_cluster'
      )
  ) THEN
    RAISE EXCEPTION 'Tharsis active cohort contains person without valid habitat assignment';
  END IF;

  IF EXISTS (
    SELECT 1 FROM people p
    WHERE p.current_location_id=mars_id AND p.simulation_tier='active' AND p.person_key IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM person_assignments pa JOIN tile_entities te ON te.id=pa.tile_entity_id
        WHERE pa.person_id=p.id AND pa.assignment_type='work' AND pa.is_active=true
          AND pa.location_id=mars_id AND te.location_id=mars_id
      )
  ) THEN
    RAISE EXCEPTION 'Tharsis active cohort contains person without valid work assignment';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.noxia_population_tharsis_uuid(text);
