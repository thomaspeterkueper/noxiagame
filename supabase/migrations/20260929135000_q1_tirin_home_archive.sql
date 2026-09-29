-- Q1 canonical place hierarchy for Tirin Kal.
-- Uses module hierarchy instead of invented map coordinates: Q1 spatial geometry is not closed yet.

DO $$
DECLARE
  v_q1 uuid;
  v_tirin uuid;
  v_altbogen uuid;
  v_archive_district uuid;
  v_home uuid;
  v_archive uuid;
BEGIN
  SELECT id INTO v_q1 FROM public.locations WHERE slug='q1';
  SELECT id INTO v_tirin FROM public.people WHERE person_key='tirin-kal';
  IF v_q1 IS NULL OR v_tirin IS NULL THEN
    RAISE EXCEPTION 'Q1/Tirin canon anchor must exist first';
  END IF;

  INSERT INTO public.building_definitions
    (key,name,description,category,tier,cost_credits,build_time_ticks,production,consumption,population_bonus,allowed_locations,is_active,sort_order)
  VALUES
    ('archive_library','Archive & Library','Public archive, library and media-history workspace.','services',1,3200,3,'[]'::jsonb,'[]'::jsonb,0,ARRAY['q1'],true,75)
  ON CONFLICT (key) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category,
    allowed_locations=EXCLUDED.allowed_locations, is_active=true;

  INSERT INTO public.tile_entities(location_id,entity_type,entity_id,is_state_owned,owner_class,status)
  SELECT v_q1,'module','q1_altbogen',true,'STATE','active'
  WHERE NOT EXISTS (SELECT 1 FROM public.tile_entities WHERE location_id=v_q1 AND entity_type='module' AND entity_id='q1_altbogen');
  SELECT id INTO v_altbogen FROM public.tile_entities WHERE location_id=v_q1 AND entity_type='module' AND entity_id='q1_altbogen' ORDER BY created_at LIMIT 1;

  INSERT INTO public.tile_entities(location_id,entity_type,entity_id,is_state_owned,owner_class,status)
  SELECT v_q1,'module','q1_archive_culture_district',true,'STATE','active'
  WHERE NOT EXISTS (SELECT 1 FROM public.tile_entities WHERE location_id=v_q1 AND entity_type='module' AND entity_id='q1_archive_culture_district');
  SELECT id INTO v_archive_district FROM public.tile_entities WHERE location_id=v_q1 AND entity_type='module' AND entity_id='q1_archive_culture_district' ORDER BY created_at LIMIT 1;

  INSERT INTO public.tile_entities(location_id,parent_id,slot,entity_type,entity_id,is_state_owned,owner_class,status,district_type)
  SELECT v_q1,v_altbogen,1,'building','habitat',true,'STATE','active','altbogen'
  WHERE NOT EXISTS (SELECT 1 FROM public.tile_entities WHERE parent_id=v_altbogen AND slot=1);
  SELECT id INTO v_home FROM public.tile_entities WHERE parent_id=v_altbogen AND slot=1 LIMIT 1;

  INSERT INTO public.tile_entities(location_id,parent_id,slot,entity_type,entity_id,is_state_owned,owner_class,status,district_type)
  SELECT v_q1,v_archive_district,1,'building','archive_library',true,'STATE','active','archive_culture'
  WHERE NOT EXISTS (SELECT 1 FROM public.tile_entities WHERE parent_id=v_archive_district AND slot=1);
  SELECT id INTO v_archive FROM public.tile_entities WHERE parent_id=v_archive_district AND slot=1 LIMIT 1;

  INSERT INTO public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,role_code,is_active)
  VALUES(v_tirin,'home',v_q1,v_home,'resident',true)
  ON CONFLICT (person_id) WHERE assignment_type='home' AND is_active=true
  DO UPDATE SET location_id=EXCLUDED.location_id,tile_entity_id=EXCLUDED.tile_entity_id,role_code=EXCLUDED.role_code,updated_at=now();

  INSERT INTO public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,role_code,is_active)
  VALUES(v_tirin,'work',v_q1,v_archive,'author_researcher',true)
  ON CONFLICT (person_id) WHERE assignment_type='work' AND is_active=true
  DO UPDATE SET location_id=EXCLUDED.location_id,tile_entity_id=EXCLUDED.tile_entity_id,role_code=EXCLUDED.role_code,updated_at=now();
END $$;
