-- NOXIA-LIVING-0002 — initial living population representatives beyond Mars
-- Adds a small deterministic active slice to Earth, Moon, Phobos and Prometheus.
-- Location population remains aggregate; these rows are individually simulated representatives.

SET search_path TO public;

DO $$
DECLARE
  loc record;
  home_entity uuid;
  work_entity uuid;
  person_uuid uuid;
  seed record;
BEGIN
  IF to_regclass('public.people') IS NULL
     OR to_regclass('public.person_assignments') IS NULL
     OR to_regclass('public.person_needs') IS NULL
     OR to_regclass('public.person_skills') IS NULL THEN
    RAISE EXCEPTION 'Living Population schema incomplete';
  END IF;

  FOR seed IN
    SELECT * FROM (VALUES
      ('earth','Hana Moreau',2072,'logistics','landing_pad','logistics',0.61,22),
      ('earth','Victor Chen',2067,'administrator','admin','administration',0.64,25),
      ('earth','Amara Ndlovu',2075,'educator','school','education',0.58,17),
      ('earth','Jules Martens',2069,'engineer','shipyard','maintenance',0.63,24),
      ('moon','Imani Brooks',2073,'geologist','mine','geology',0.66,29),
      ('moon','Yuto Sato',2076,'technician','ice_drill','maintenance',0.62,21),
      ('moon','Leila Mansour',2071,'researcher','scanner','research',0.65,26),
      ('moon','Pavel Novak',2068,'administrator','admin','administration',0.59,20),
      ('phobos','Nia Okonkwo',2077,'sensor_operator','scanner','research',0.60,19),
      ('phobos','Emil Sorensen',2070,'logistics','warehouse','logistics',0.64,23),
      ('phobos','Farah Rahimi',2074,'educator','school','education',0.57,16),
      ('phobos','Rafael Costa',2066,'administrator','admin','administration',0.61,22),
      ('prometheus','Mina Park',2075,'sensor_operator','scanner','research',0.67,28),
      ('prometheus','Owen Fraser',2071,'systems_technician','scanner','maintenance',0.63,23),
      ('prometheus','Salma Idris',2073,'data_analyst','scanner','analysis',0.65,24),
      ('prometheus','Theo Lambert',2069,'operations_lead','scanner','operations',0.62,21)
    ) AS s(location_slug,display_name,birth_year,role_code,preferred_building,skill_code,skill_level,experience)
  LOOP
    SELECT id, slug INTO loc FROM public.locations WHERE slug=seed.location_slug LIMIT 1;
    IF loc.id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id INTO home_entity
      FROM public.tile_entities
      WHERE location_id=loc.id AND entity_type='building'
        AND entity_id IN ('habitat','residential_block')
      ORDER BY CASE entity_id WHEN 'habitat' THEN 0 ELSE 1 END, id
      LIMIT 1;

    SELECT id INTO work_entity
      FROM public.tile_entities
      WHERE location_id=loc.id AND entity_type='building' AND entity_id=seed.preferred_building
      ORDER BY id LIMIT 1;

    IF work_entity IS NULL THEN
      SELECT id INTO work_entity FROM public.tile_entities
       WHERE location_id=loc.id AND entity_type='building' ORDER BY id LIMIT 1;
    END IF;
    IF work_entity IS NULL THEN
      CONTINUE;
    END IF;

    person_uuid := (
      substr(md5('noxia-living:'||seed.location_slug||':'||seed.display_name),1,8)||'-'||
      substr(md5('noxia-living:'||seed.location_slug||':'||seed.display_name),9,4)||'-4'||
      substr(md5('noxia-living:'||seed.location_slug||':'||seed.display_name),14,3)||'-8'||
      substr(md5('noxia-living:'||seed.location_slug||':'||seed.display_name),18,3)||'-'||
      substr(md5('noxia-living:'||seed.location_slug||':'||seed.display_name),21,12)
    )::uuid;

    INSERT INTO public.people (id,display_name,birth_year,current_location_id,simulation_tier,activity_state)
    VALUES (person_uuid,seed.display_name,seed.birth_year,loc.id,'active','idle')
    ON CONFLICT (id) DO UPDATE SET
      display_name=EXCLUDED.display_name,
      birth_year=EXCLUDED.birth_year,
      current_location_id=EXCLUDED.current_location_id,
      simulation_tier='active';

    INSERT INTO public.person_assignments (person_id,assignment_type,location_id,tile_entity_id,role_code,is_active)
    VALUES (person_uuid,'work',loc.id,work_entity,seed.role_code,true)
    ON CONFLICT DO NOTHING;

    IF home_entity IS NOT NULL THEN
      INSERT INTO public.person_assignments (person_id,assignment_type,location_id,tile_entity_id,role_code,is_active)
      VALUES (person_uuid,'home',loc.id,home_entity,'resident',true)
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.person_assignments (person_id,assignment_type,location_id,tile_entity_id,role_code,is_active)
      VALUES (person_uuid,'home',loc.id,NULL,'resident',true)
      ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO public.person_needs (person_id,need_code,satisfaction)
    VALUES
      (person_uuid,'sustenance',0.82),(person_uuid,'rest',0.82),(person_uuid,'safety',0.82),
      (person_uuid,'social',0.82),(person_uuid,'purpose',0.82)
    ON CONFLICT (person_id,need_code) DO NOTHING;

    INSERT INTO public.person_skills (person_id,skill_code,level,experience)
    VALUES (person_uuid,seed.skill_code,seed.skill_level,seed.experience)
    ON CONFLICT (person_id,skill_code) DO NOTHING;

    home_entity := NULL;
    work_entity := NULL;
  END LOOP;
END $$;
