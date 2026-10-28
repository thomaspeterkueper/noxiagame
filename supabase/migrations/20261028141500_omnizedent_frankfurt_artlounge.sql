-- NOXIA-NPC-RELIGION-0002
-- Omnizedentin in Frankfurt (Thomas, 28.10.2026: Resonanzrunde in der CAMALEO-ArtLounge).
--
-- Arbeitsort: das reale Haus Mörfelder Landstraße 103 (OSM osm:way:265117408), in dem
--   die ArtLounge liegt. Kein dupliziertes Gebäude, kein Eigentumswechsel.
-- Wohnung: das reale Mehrfamilienhaus Ziegelhüttenweg 15 (OSM osm:way:117819385),
--   rund 350 m entfernt, als Zuweisung an den Grundriss. So wohnen Menschen in
--   nicht gekauften echten Häusern (siehe buy_earth_building: „wer schon dort wohnt,
--   bleibt; Vermieter ist dann der Käufer“). Vermieter bis dahin unbekannt, gestellt.
-- Arbeitgeber: „Resonanzkreis Frankfurt“ ohne Lohnsatz, wie in Sundern.
--
-- Idempotent. Bricht ab, wenn ein Ort fehlt.

do $$
declare
  v_tick bigint;
  v_earth uuid;
  v_lounge uuid;
  v_home uuid;
  v_employer uuid;
  v_person uuid;
  v_actor uuid;
  v_home_assignment uuid;
begin
  select coalesce(max(tick_number),0) into v_tick from public.tick_log;
  select id into v_earth from public.locations where slug='earth';
  if v_earth is null then raise exception 'NOXIA_OMNIZEDENT_EARTH_MISSING'; end if;

  select rf.id into v_lounge from public.region_features rf
  join public.celestial_regions cr on cr.id=rf.region_id
  where cr.body='earth' and rf.properties->>'noxia_source_id'='osm:way:265117408'
    and rf.properties->>'addr:street'='Mörfelder Landstraße' and rf.properties->>'addr:housenumber'='103'
  order by rf.created_at limit 1;
  if v_lounge is null then raise exception 'NOXIA_OMNIZEDENT_ARTLOUNGE_MISSING'; end if;

  select rf.id into v_home from public.region_features rf
  join public.celestial_regions cr on cr.id=rf.region_id
  where cr.body='earth' and rf.properties->>'noxia_source_id'='osm:way:117819385'
    and rf.properties->>'addr:street'='Ziegelhüttenweg' and rf.properties->>'addr:housenumber'='15'
  order by rf.created_at limit 1;
  if v_home is null then raise exception 'NOXIA_OMNIZEDENT_FRANKFURT_HOME_MISSING'; end if;

  select id into v_person from public.people where person_key='earth-frankfurt-omnizedent-001' limit 1;
  if v_person is null then
    insert into public.people(
      display_name,birth_year,current_location_id,simulation_tier,activity_state,
      last_action,last_decision_factors,last_tick,person_key,bio_short,public_role,
      traits,observable_description
    ) values (
      'Samira Haddad',
      2068,
      v_earth,
      'active',
      'idle',
      'settled_in_frankfurt',
      '{}'::jsonb,
      v_tick,
      'earth-frankfurt-omnizedent-001',
      'Omnizedentin in Frankfurt-Sachsenhausen. Lädt jede Woche zur offenen Resonanzrunde in die CAMALEO-ArtLounge, verbindet Gespräche über das Werden mit Musik und Kunst und hört Menschen aus vielen Ländern gern zu.',
      'Omnizedentin · Resonanzrunde ArtLounge',
      '{"patience":0.70,"curiosity":0.86,"sociability":0.78}'::jsonb,
      'Eine Frau mit Notizbuch unter dem Arm; spricht ruhig und lacht oft.'
    ) returning id into v_person;
  end if;

  select id into v_employer from public.actors
  where kind='institution' and display_name='Resonanzkreis Frankfurt' order by created_at limit 1;
  if v_employer is null then
    insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
    values ('institution','Resonanzkreis Frankfurt',
      'Offener Gesprächskreis der Omnizedenz in Frankfurt; trifft sich in der CAMALEO-ArtLounge, Mörfelder Landstraße 103.',
      '{}'::jsonb,
      '{"domain":"philosophical_community","tradition":"omnizedenz","traditionKind":"philosophical"}'::jsonb)
    returning id into v_employer;
  end if;

  select actor_id into v_actor from public.person_economic_actors where person_id=v_person;
  if v_actor is null then
    insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
    values ('npc_person','Samira Haddad','Persönlicher Wirtschaftsakteur der Living Population.','{}'::jsonb,'{}'::jsonb)
    returning id into v_actor;
    insert into public.person_economic_actors(person_id,actor_id) values (v_person,v_actor);
  end if;

  insert into public.person_life_state(person_id,life_stage,age_ticks,family_desire,last_family_event_tick)
  values (v_person,'adult',0,0.5,null) on conflict (person_id) do nothing;

  insert into public.person_needs(person_id,need_code,satisfaction,updated_tick)
  values (v_person,'sustenance',0.70,v_tick),(v_person,'rest',0.70,v_tick),(v_person,'safety',0.70,v_tick),
         (v_person,'social',0.70,v_tick),(v_person,'purpose',0.70,v_tick),(v_person,'variety',0.70,v_tick)
  on conflict (person_id,need_code) do nothing;

  if not exists (select 1 from public.npc_ledger where actor_id=v_actor and ref='bootstrap:person:'||v_person::text) then
    insert into public.npc_ledger(actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note)
    values (v_actor,v_tick,'endowment',null,0,980,v_earth,'bootstrap:person:'||v_person::text,
      'Bootstrap-Startbestand des neu materialisierten NPC; keine wiederkehrende Einnahme');
  end if;

  select id into v_home_assignment from public.person_assignments
  where person_id=v_person and assignment_type='home' and is_active=true order by created_at limit 1;
  if v_home_assignment is null then
    insert into public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,region_feature_id,employer_actor_id,role_code,starts_tick,ends_tick,is_active)
    values (v_person,'home',v_earth,null,v_home,null,'resident',v_tick,null,true)
    returning id into v_home_assignment;
    insert into public.person_tenancies(assignment_id,person_id,location_id,tile_entity_id,landlord_actor_id,rent_per_billing,billing_interval_ticks,next_due_tick,status,origin,tenure)
    values (v_home_assignment,v_person,v_earth,null,null,null,720,null,'provided','provided','provided')
    on conflict (assignment_id) do nothing;
  end if;

  if not exists (select 1 from public.person_assignments where person_id=v_person and assignment_type='work' and is_active=true) then
    insert into public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,region_feature_id,employer_actor_id,role_code,starts_tick,ends_tick,is_active)
    values (v_person,'work',v_earth,null,v_lounge,v_employer,'omnizedent',v_tick,null,true);
  end if;

  insert into public.person_appearance(person_id,gender_identity,gender_presentation,body_frame,skin_tone_code,hair_style_code,hair_color_code,facial_hair_code,visible_age_band,clothing_profile,cultural_heritage)
  values (
    v_person,null,'feminine',
    case mod(abs(hashtextextended(v_person::text,23)),3) when 0 then 'slender' when 1 then 'average' else 'broad' end,
    'skin_'||(1+mod(abs(hashtextextended(v_person::text,37)),6))::text,
    case mod(abs(hashtextextended(v_person::text,41)),4) when 0 then 'short' when 1 then 'long' when 2 then 'curly' else 'braided' end,
    case mod(abs(hashtextextended(v_person::text,43)),4) when 0 then 'dark' when 1 then 'brown' when 2 then 'grey' else 'light' end,
    'none','adult','{}'::jsonb,'{}'::jsonb
  ) on conflict (person_id) do nothing;
end $$;
