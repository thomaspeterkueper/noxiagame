-- Q1 public places used by residents including Tirin Kal.
DO $$
DECLARE v_q1 uuid; v_alt uuid; v_archive uuid; v_harbour uuid; v_transfer uuid;
BEGIN
 SELECT id INTO v_q1 FROM public.locations WHERE slug='q1';
 SELECT id INTO v_alt FROM public.tile_entities WHERE location_id=v_q1 AND entity_type='module' AND entity_id='q1_altbogen' LIMIT 1;
 SELECT id INTO v_archive FROM public.tile_entities WHERE location_id=v_q1 AND entity_type='module' AND entity_id='q1_archive_culture_district' LIMIT 1;
 IF v_q1 IS NULL OR v_alt IS NULL OR v_archive IS NULL THEN RAISE EXCEPTION 'Q1 place anchors missing'; END IF;

 INSERT INTO public.building_definitions(key,name,description,category,tier,cost_credits,build_time_ticks,production,consumption,population_bonus,allowed_locations,is_active,sort_order)
 VALUES
 ('cafe','Café','Small public food and social venue.','life',1,900,1,'[]','[]',0,null,true,70),
 ('observation_gallery','Observation Gallery','Publicly accessible viewing and quiet observation space.','services',1,1200,2,'[]','[]',0,null,true,71),
 ('heritage_corridor','Heritage Technical Corridor','Older technical passage showing multiple station generations.','infrastructure',1,0,1,'[]','[]',0,ARRAY['q1'],true,72),
 ('station_harbour','Station Harbour','Passenger, logistics and dock-transfer public interface.','infrastructure',1,0,1,'[]','[]',0,ARRAY['q1'],true,73)
 ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,category=EXCLUDED.category,is_active=true;

 INSERT INTO public.tile_entities(location_id,entity_type,entity_id,is_state_owned,owner_class,status)
 SELECT v_q1,'module','q1_harbour_district',true,'STATE','active' WHERE NOT EXISTS(select 1 from public.tile_entities where location_id=v_q1 and entity_type='module' and entity_id='q1_harbour_district');
 SELECT id INTO v_harbour FROM public.tile_entities WHERE location_id=v_q1 AND entity_type='module' AND entity_id='q1_harbour_district' LIMIT 1;
 INSERT INTO public.tile_entities(location_id,entity_type,entity_id,is_state_owned,owner_class,status)
 SELECT v_q1,'module','q1_transfer_node',true,'STATE','active' WHERE NOT EXISTS(select 1 from public.tile_entities where location_id=v_q1 and entity_type='module' and entity_id='q1_transfer_node');
 SELECT id INTO v_transfer FROM public.tile_entities WHERE location_id=v_q1 AND entity_type='module' AND entity_id='q1_transfer_node' LIMIT 1;

 INSERT INTO public.tile_entities(location_id,parent_id,slot,entity_type,entity_id,is_state_owned,owner_class,status,district_type)
 SELECT v_q1,v_transfer,1,'building','cafe',true,'STATE','active','transfer' WHERE NOT EXISTS(select 1 from public.tile_entities where parent_id=v_transfer and slot=1);
 INSERT INTO public.tile_entities(location_id,parent_id,slot,entity_type,entity_id,is_state_owned,owner_class,status,district_type)
 SELECT v_q1,v_archive,2,'building','observation_gallery',true,'STATE','active','archive_culture' WHERE NOT EXISTS(select 1 from public.tile_entities where parent_id=v_archive and slot=2);
 INSERT INTO public.tile_entities(location_id,parent_id,slot,entity_type,entity_id,is_state_owned,owner_class,status,district_type)
 SELECT v_q1,v_alt,2,'building','heritage_corridor',true,'STATE','active','altbogen' WHERE NOT EXISTS(select 1 from public.tile_entities where parent_id=v_alt and slot=2);
 INSERT INTO public.tile_entities(location_id,parent_id,slot,entity_type,entity_id,is_state_owned,owner_class,status,district_type)
 SELECT v_q1,v_harbour,1,'building','station_harbour',true,'STATE','active','harbour' WHERE NOT EXISTS(select 1 from public.tile_entities where parent_id=v_harbour and slot=1);
END $$;
