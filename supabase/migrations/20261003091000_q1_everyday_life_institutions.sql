-- Q1 institutions for ordinary station life. No coordinates until station geometry is authoritative.
DO $$
DECLARE v_q1 uuid; v_life uuid;
BEGIN
 select id into v_q1 from public.locations where slug='q1';
 if v_q1 is null then raise exception 'Q1 missing'; end if;

 insert into public.building_definitions(key,name,description,category,tier,cost_credits,build_time_ticks,production,consumption,population_bonus,allowed_locations,is_active,sort_order)
 values
 ('learning_commons','Learning Commons','Early-childhood care, mixed-age learning, project studios, simulation labs and mentoring.','services',1,4200,4,'[]','[]',0,array['q1'],true,80),
 ('community_food_hall','Community Food Hall','Everyday shared meals, small vendors and informal social life.','life',1,2600,3,'[]','[]',0,array['q1'],true,81),
 ('recreation_hub','Recreation Hub','Movement, sport, clubs and adaptable community recreation.','life',1,3000,3,'[]','[]',0,array['q1'],true,82),
 ('maker_commons','Maker Commons','Shared repair, fabrication, crafts and supervised practical learning.','services',1,3400,3,'[]','[]',0,array['q1'],true,83),
 ('community_garden','Community Garden','Managed planted public habitat for food, leisure and ecological contact.','life',1,3800,4,'[]','[]',0,array['q1'],true,84)
 on conflict(key) do update set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

 insert into public.tile_entities(location_id,entity_type,entity_id,is_state_owned,owner_class,status)
 select v_q1,'module','q1_everyday_life',true,'STATE','active'
 where not exists(select 1 from public.tile_entities where location_id=v_q1 and entity_type='module' and entity_id='q1_everyday_life');
 select id into v_life from public.tile_entities where location_id=v_q1 and entity_type='module' and entity_id='q1_everyday_life' limit 1;

 insert into public.tile_entities(location_id,parent_id,slot,entity_type,entity_id,is_state_owned,owner_class,status,district_type)
 select v_q1,v_life,x.slot,'building',x.entity_id,true,'STATE','active','everyday_life'
 from (values (1,'learning_commons'),(2,'community_food_hall'),(3,'recreation_hub'),(4,'maker_commons'),(5,'community_garden')) x(slot,entity_id)
 where not exists(select 1 from public.tile_entities te where te.parent_id=v_life and te.slot=x.slot);
END $$;
