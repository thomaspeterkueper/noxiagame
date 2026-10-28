-- NOXIA-NPC-RELIGION-0002
-- First two Omnizedent pilots, built exactly like the St. Johannes clergy pilot:
-- normal persistent persons with home, work, needs, actor and appearance.
--
-- Sundern: Johanna Lind, Omnizedentin. Her resonance round meets in the real,
--   imported Hubertushalle (OSM community centre). No duplicated tile_entity,
--   no invented building. Employer is a small community institution without
--   payroll (no wage rate for role 'omnizedent'), like the clergy pilot.
-- Tharsis: Teodor Varga, Omnizedent by conviction, technician at the water
--   recycler (paid public-service job). A resonance place on Mars needs a real
--   building first; that is a separate request, not created here.
--
-- Idempotent. Fails closed when a required place or free home is missing.

do $$
declare
  v_tick bigint;
  v_earth uuid;
  v_mars uuid;
  -- Sundern
  v_hall uuid;
  v_s_home uuid;
  v_s_cap integer;
  v_s_res integer;
  v_s_landlord uuid;
  v_s_employer uuid;
  v_johanna uuid;
  v_johanna_actor uuid;
  v_johanna_home uuid;
  v_elias uuid;
  -- Tharsis
  v_m_home uuid;
  v_m_cap integer;
  v_m_res integer;
  v_m_landlord uuid;
  v_recycler uuid;
  v_teodor uuid;
  v_teodor_actor uuid;
  v_teodor_home uuid;
begin
  select coalesce(max(tick_number),0) into v_tick from public.tick_log;
  select id into v_earth from public.locations where slug='earth';
  select id into v_mars from public.locations where slug='mars';
  if v_earth is null or v_mars is null then
    raise exception 'NOXIA_OMNIZEDENT_LOCATION_MISSING';
  end if;

  ---------------------------------------------------------------------------
  -- Sundern: places
  ---------------------------------------------------------------------------
  select rf.id into v_hall
  from public.region_features rf
  join public.celestial_regions cr on cr.id=rf.region_id
  where cr.body='earth'
    and rf.properties->>'noxia_source_id'='osm:way:246890637'
    and rf.properties->>'name'='Hubertushalle'
  order by rf.created_at
  limit 1;
  if v_hall is null then
    raise exception 'NOXIA_OMNIZEDENT_HUBERTUSHALLE_MISSING';
  end if;

  select id into v_s_landlord from public.actors
  where kind='institution' and display_name='Tharsis Hub Sauerland – Öffentliche Dienste'
  order by created_at limit 1;

  -- Public housing in Sundern, the same block as the clergy pilot.
  select te.id, te.residential_capacity into v_s_home, v_s_cap
  from public.tile_entities te
  where te.location_id=v_earth
    and te.entity_id='residential_block'
    and te.owner_class='STATE'
    and te.status='active'
    and te.latitude_deg between 51.32 and 51.35
    and te.longitude_deg between 7.96 and 8.02
  order by te.created_at
  limit 1;

  ---------------------------------------------------------------------------
  -- Sundern: Johanna Lind
  ---------------------------------------------------------------------------
  select id into v_johanna from public.people where person_key='earth-sundern-omnizedent-001' limit 1;

  if v_johanna is null then
    if v_s_home is null or v_s_landlord is null then
      raise exception 'NOXIA_OMNIZEDENT_SUNDERN_HOME_MISSING';
    end if;
    select count(*) into v_s_res from public.person_assignments
    where tile_entity_id=v_s_home and assignment_type='home' and is_active=true;
    if v_s_cap is null or v_s_res >= v_s_cap then
      raise exception 'NOXIA_OMNIZEDENT_SUNDERN_HOME_FULL';
    end if;

    insert into public.people(
      display_name,birth_year,current_location_id,simulation_tier,activity_state,
      last_action,last_decision_factors,last_tick,person_key,bio_short,public_role,
      traits,observable_description
    ) values (
      'Johanna Lind',
      2071,
      v_earth,
      'active',
      'idle',
      'settled_in_sundern',
      '{}'::jsonb,
      v_tick,
      'earth-sundern-omnizedent-001',
      'Omnizedentin in Sundern. Vertritt die Omnizedenz als Philosophie des Werdens, lädt wöchentlich zur offenen Resonanzrunde in die Hubertushalle und streitet gern freundlich über Sinn und Verantwortung.',
      'Omnizedentin · Resonanzrunde Hubertushalle',
      '{"patience":0.72,"curiosity":0.84,"sociability":0.66}'::jsonb,
      'Eine Frau mittleren Alters mit wachem Blick; hört lange zu und fragt dann genau nach.'
    )
    returning id into v_johanna;
  end if;

  select id into v_s_employer from public.actors
  where kind='institution' and display_name='Resonanzkreis Sundern'
  order by created_at limit 1;
  if v_s_employer is null then
    insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
    values (
      'institution',
      'Resonanzkreis Sundern',
      'Offener Gesprächskreis der Omnizedenz in Sundern; trifft sich in der Hubertushalle.',
      '{}'::jsonb,
      '{"domain":"philosophical_community","tradition":"omnizedenz","traditionKind":"philosophical"}'::jsonb
    )
    returning id into v_s_employer;
  end if;

  select actor_id into v_johanna_actor from public.person_economic_actors where person_id=v_johanna;
  if v_johanna_actor is null then
    insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
    values ('npc_person','Johanna Lind','Persönlicher Wirtschaftsakteur der Living Population.','{}'::jsonb,'{}'::jsonb)
    returning id into v_johanna_actor;
    insert into public.person_economic_actors(person_id,actor_id) values (v_johanna,v_johanna_actor);
  end if;

  insert into public.person_life_state(person_id,life_stage,age_ticks,family_desire,last_family_event_tick)
  values (v_johanna,'adult',0,0.5,null)
  on conflict (person_id) do nothing;

  insert into public.person_needs(person_id,need_code,satisfaction,updated_tick)
  values
    (v_johanna,'sustenance',0.70,v_tick),
    (v_johanna,'rest',0.70,v_tick),
    (v_johanna,'safety',0.70,v_tick),
    (v_johanna,'social',0.70,v_tick),
    (v_johanna,'purpose',0.70,v_tick),
    (v_johanna,'variety',0.70,v_tick)
  on conflict (person_id,need_code) do nothing;

  if not exists (select 1 from public.npc_ledger where actor_id=v_johanna_actor and ref='bootstrap:person:'||v_johanna::text) then
    insert into public.npc_ledger(actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note)
    values (v_johanna_actor,v_tick,'endowment',null,0,980,v_earth,'bootstrap:person:'||v_johanna::text,
      'Bootstrap-Startbestand des neu materialisierten NPC; keine wiederkehrende Einnahme');
  end if;

  select id into v_johanna_home from public.person_assignments
  where person_id=v_johanna and assignment_type='home' and is_active=true
  order by created_at limit 1;
  if v_johanna_home is null then
    insert into public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,employer_actor_id,role_code,starts_tick,ends_tick,is_active)
    values (v_johanna,'home',v_earth,v_s_home,null,'resident',v_tick,null,true)
    returning id into v_johanna_home;
    insert into public.person_tenancies(assignment_id,person_id,location_id,tile_entity_id,landlord_actor_id,rent_per_billing,billing_interval_ticks,next_due_tick,status,origin,tenure)
    values (v_johanna_home,v_johanna,v_earth,v_s_home,v_s_landlord,null,720,null,'provided','provided','provided')
    on conflict (assignment_id) do nothing;
  end if;

  if not exists (select 1 from public.person_assignments where person_id=v_johanna and assignment_type='work' and is_active=true) then
    insert into public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,region_feature_id,employer_actor_id,role_code,starts_tick,ends_tick,is_active)
    values (v_johanna,'work',v_earth,null,v_hall,v_s_employer,'omnizedent',v_tick,null,true);
  end if;

  insert into public.person_appearance(person_id,gender_identity,gender_presentation,body_frame,skin_tone_code,hair_style_code,hair_color_code,facial_hair_code,visible_age_band,clothing_profile,cultural_heritage)
  values (
    v_johanna,null,'feminine',
    case mod(abs(hashtextextended(v_johanna::text,23)),3) when 0 then 'slender' when 1 then 'average' else 'broad' end,
    'skin_'||(1+mod(abs(hashtextextended(v_johanna::text,37)),6))::text,
    case mod(abs(hashtextextended(v_johanna::text,41)),4) when 0 then 'short' when 1 then 'long' when 2 then 'curly' else 'braided' end,
    case mod(abs(hashtextextended(v_johanna::text,43)),5) when 0 then 'dark' when 1 then 'brown' when 2 then 'light' when 3 then 'red' else 'grey' end,
    'none','adult','{}'::jsonb,'{}'::jsonb
  )
  on conflict (person_id) do nothing;

  -- One weak local acquaintance with the parish priest of the same small town.
  -- Affinity stays below the 0.5 visitor threshold: no automatic mutual attendance.
  select id into v_elias from public.people where person_key='earth-sundern-st-johannes-priest-001' limit 1;
  if v_elias is not null then
    insert into public.person_relationships(person_id,other_person_id,relationship_type,familiarity,trust,affinity,last_interaction_tick,encounter_count_total,recent_encounter_score,relationship_updated_tick)
    values
      (v_johanna,v_elias,'acquaintance',0.15,0.50,0.48,null,0,0,null),
      (v_elias,v_johanna,'acquaintance',0.15,0.50,0.48,null,0,0,null)
    on conflict (person_id,other_person_id) do nothing;
  end if;

  ---------------------------------------------------------------------------
  -- Tharsis: Teodor Varga
  ---------------------------------------------------------------------------
  select id into v_m_landlord from public.actors
  where kind='institution' and display_name='Mars / Tharsis Hub – Öffentliche Dienste'
  order by created_at limit 1;

  select te.id into v_recycler from public.tile_entities te
  where te.location_id=v_mars and te.entity_id='water_recycler' and te.status='active'
  order by te.created_at limit 1;

  select id into v_teodor from public.people where person_key='mars-tharsis-omnizedent-001' limit 1;

  if v_teodor is null then
    if v_m_landlord is null or v_recycler is null then
      raise exception 'NOXIA_OMNIZEDENT_THARSIS_PLACES_MISSING';
    end if;
    -- Public habitat with a free place.
    select te.id, te.residential_capacity into v_m_home, v_m_cap
    from public.tile_entities te
    where te.location_id=v_mars and te.entity_id='habitat' and te.owner_class='STATE' and te.status='active'
      and coalesce(te.residential_capacity,0) > (
        select count(*) from public.person_assignments pa
        where pa.tile_entity_id=te.id and pa.assignment_type='home' and pa.is_active=true)
    order by te.created_at limit 1;
    if v_m_home is null then
      raise exception 'NOXIA_OMNIZEDENT_THARSIS_HOME_FULL';
    end if;

    insert into public.people(
      display_name,birth_year,current_location_id,simulation_tier,activity_state,
      last_action,last_decision_factors,last_tick,person_key,bio_short,public_role,
      traits,observable_description
    ) values (
      'Teodor Varga',
      2079,
      v_mars,
      'active',
      'idle',
      'settled_in_tharsis',
      '{}'::jsonb,
      v_tick,
      'mars-tharsis-omnizedent-001',
      'Techniker an der Wasseraufbereitung des Tharsis Hub und überzeugter Omnizedent. Fragt bei jeder Knappheit, wessen Möglichkeiten eine Entscheidung öffnet oder verschließt.',
      'Omnizedent · Wasseraufbereitung',
      '{"patience":0.64,"curiosity":0.79,"sociability":0.58}'::jsonb,
      'Ein Mann um die dreißig mit Werkzeugweste; redet gern, wenn das Thema stimmt.'
    )
    returning id into v_teodor;
  end if;

  select actor_id into v_teodor_actor from public.person_economic_actors where person_id=v_teodor;
  if v_teodor_actor is null then
    insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
    values ('npc_person','Teodor Varga','Persönlicher Wirtschaftsakteur der Living Population.','{}'::jsonb,'{}'::jsonb)
    returning id into v_teodor_actor;
    insert into public.person_economic_actors(person_id,actor_id) values (v_teodor,v_teodor_actor);
  end if;

  insert into public.person_life_state(person_id,life_stage,age_ticks,family_desire,last_family_event_tick)
  values (v_teodor,'adult',0,0.5,null)
  on conflict (person_id) do nothing;

  insert into public.person_needs(person_id,need_code,satisfaction,updated_tick)
  values
    (v_teodor,'sustenance',0.70,v_tick),
    (v_teodor,'rest',0.70,v_tick),
    (v_teodor,'safety',0.70,v_tick),
    (v_teodor,'social',0.70,v_tick),
    (v_teodor,'purpose',0.70,v_tick),
    (v_teodor,'variety',0.70,v_tick)
  on conflict (person_id,need_code) do nothing;

  if not exists (select 1 from public.npc_ledger where actor_id=v_teodor_actor and ref='bootstrap:person:'||v_teodor::text) then
    insert into public.npc_ledger(actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note)
    values (v_teodor_actor,v_tick,'endowment',null,0,980,v_mars,'bootstrap:person:'||v_teodor::text,
      'Bootstrap-Startbestand des neu materialisierten NPC; keine wiederkehrende Einnahme');
  end if;

  select id into v_teodor_home from public.person_assignments
  where person_id=v_teodor and assignment_type='home' and is_active=true
  order by created_at limit 1;
  if v_teodor_home is null then
    if v_m_home is null then
      raise exception 'NOXIA_OMNIZEDENT_THARSIS_HOME_FULL';
    end if;
    insert into public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,employer_actor_id,role_code,starts_tick,ends_tick,is_active)
    values (v_teodor,'home',v_mars,v_m_home,null,'resident',v_tick,null,true)
    returning id into v_teodor_home;
    insert into public.person_tenancies(assignment_id,person_id,location_id,tile_entity_id,landlord_actor_id,rent_per_billing,billing_interval_ticks,next_due_tick,status,origin,tenure)
    values (v_teodor_home,v_teodor,v_mars,v_m_home,v_m_landlord,null,720,null,'provided','provided','provided')
    on conflict (assignment_id) do nothing;
  end if;

  if not exists (select 1 from public.person_assignments where person_id=v_teodor and assignment_type='work' and is_active=true) then
    insert into public.person_assignments(person_id,assignment_type,location_id,tile_entity_id,employer_actor_id,role_code,starts_tick,ends_tick,is_active)
    values (v_teodor,'work',v_mars,v_recycler,v_m_landlord,'technician',v_tick,null,true);
  end if;

  insert into public.person_appearance(person_id,gender_identity,gender_presentation,body_frame,skin_tone_code,hair_style_code,hair_color_code,facial_hair_code,visible_age_band,clothing_profile,cultural_heritage)
  values (
    v_teodor,null,'masculine',
    case mod(abs(hashtextextended(v_teodor::text,23)),3) when 0 then 'slender' when 1 then 'average' else 'broad' end,
    'skin_'||(1+mod(abs(hashtextextended(v_teodor::text,37)),6))::text,
    case mod(abs(hashtextextended(v_teodor::text,41)),4) when 0 then 'short' when 1 then 'long' when 2 then 'curly' else 'shaved' end,
    case mod(abs(hashtextextended(v_teodor::text,43)),4) when 0 then 'dark' when 1 then 'brown' when 2 then 'light' else 'red' end,
    case when mod(abs(hashtextextended(v_teodor::text,47)),3)=0 then 'short' else 'none' end,
    'adult','{}'::jsonb,'{}'::jsonb
  )
  on conflict (person_id) do nothing;
end $$;
