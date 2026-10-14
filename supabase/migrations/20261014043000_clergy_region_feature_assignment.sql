-- NOXIA-NPC-RELIGION-0001
-- First persistent clergy pilot at a real Earth place: St. Johannes, Sundern.
-- The church remains an observed region_feature. We do not duplicate it as a tile_entity.
-- Clergy payroll is deliberately not activated yet; religious-institution revenue is not modeled.

alter table public.person_assignments
  add column if not exists region_feature_id uuid
  references public.region_features(id) on delete set null;

create index if not exists person_assignments_region_feature_idx
  on public.person_assignments(region_feature_id)
  where region_feature_id is not null;

do $$
declare
  v_location_id uuid;
  v_church_feature_id uuid;
  v_home_id uuid;
  v_landlord_actor_id uuid;
  v_person_id uuid;
  v_person_actor_id uuid;
  v_employer_actor_id uuid;
  v_home_assignment_id uuid;
  v_tick bigint;
  v_home_capacity integer;
  v_home_residents integer;
begin
  select id into v_location_id
  from public.locations
  where slug='earth';

  if v_location_id is null then
    raise exception 'NOXIA_CLERGY_EARTH_LOCATION_MISSING';
  end if;

  select rf.id into v_church_feature_id
  from public.region_features rf
  join public.celestial_regions cr on cr.id=rf.region_id
  where cr.body='earth'
    and rf.properties->>'noxia_source_id'='osm:way:158021286'
    and rf.properties->>'name'='St. Johannes'
  order by rf.created_at
  limit 1;

  if v_church_feature_id is null then
    raise exception 'NOXIA_CLERGY_ST_JOHANNES_FEATURE_MISSING';
  end if;

  select te.id,te.residential_capacity,pea.actor_id
    into v_home_id,v_home_capacity,v_landlord_actor_id
  from public.tile_entities te
  left join public.profile_economic_actors pea on pea.profile_id=te.profile_id
  where te.location_id=v_location_id
    and te.entity_id='habitat'
    and te.status='active'
    and te.owner_class='PLAYER'
    and te.lease_price=480
    and te.latitude_deg between 51.3307 and 51.3310
    and te.longitude_deg between 8.0072 and 8.0076
  order by te.id
  limit 1;

  if v_home_id is null or v_landlord_actor_id is null then
    raise exception 'NOXIA_CLERGY_RENTAL_HOME_MISSING';
  end if;

  select count(*) into v_home_residents
  from public.person_assignments
  where tile_entity_id=v_home_id
    and assignment_type='home'
    and is_active=true;

  if v_home_capacity is null or v_home_residents >= v_home_capacity then
    raise exception 'NOXIA_CLERGY_RENTAL_HOME_FULL';
  end if;

  select coalesce(max(tick_number),0) into v_tick from public.tick_log;

  select id into v_employer_actor_id
  from public.actors
  where kind='institution'
    and display_name='St. Johannes Sundern – Gemeinde'
  order by created_at
  limit 1;

  if v_employer_actor_id is null then
    insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
    values (
      'institution',
      'St. Johannes Sundern – Gemeinde',
      'NOXIA-Gemeindeträger am real importierten Standort St. Johannes in Sundern.',
      '{}'::jsonb,
      '{"domain":"religious_community","tradition":"christian","denomination":"catholic"}'::jsonb
    )
    returning id into v_employer_actor_id;
  end if;

  select id into v_person_id
  from public.people
  where person_key='earth-sundern-st-johannes-priest-001'
  limit 1;

  if v_person_id is null then
    insert into public.people(
      display_name,birth_year,current_location_id,simulation_tier,activity_state,
      last_action,last_decision_factors,last_tick,person_key,bio_short,public_role,
      traits,observable_description
    ) values (
      'Elias Hartmann',
      2066,
      v_location_id,
      'active',
      'idle',
      'settled_in_sundern',
      '{}'::jsonb,
      v_tick,
      'earth-sundern-st-johannes-priest-001',
      'Katholischer Priester in Sundern. Verbindet Gemeindearbeit, Seelsorge, Gottesdienst und einen normalen privaten Alltag.',
      'Pfarrer · St. Johannes',
      '{"patience":0.78,"curiosity":0.61,"sociability":0.69}'::jsonb,
      'Ein Mann mittleren Alters mit ruhiger Haltung; aufmerksam, ohne sich in den Vordergrund zu drängen.'
    )
    returning id into v_person_id;
  end if;

  select actor_id into v_person_actor_id
  from public.person_economic_actors
  where person_id=v_person_id;

  if v_person_actor_id is null then
    insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
    values (
      'npc_person',
      'Elias Hartmann',
      'Persönlicher Wirtschaftsakteur der Living Population.',
      '{}'::jsonb,
      '{}'::jsonb
    )
    returning id into v_person_actor_id;

    insert into public.person_economic_actors(person_id,actor_id)
    values (v_person_id,v_person_actor_id);
  end if;

  insert into public.person_life_state(
    person_id,life_stage,age_ticks,family_desire,last_family_event_tick
  ) values (
    v_person_id,'adult',0,0.5,null
  )
  on conflict (person_id) do nothing;

  insert into public.person_needs(person_id,need_code,satisfaction,updated_tick)
  values
    (v_person_id,'sustenance',0.70,v_tick),
    (v_person_id,'rest',0.70,v_tick),
    (v_person_id,'safety',0.70,v_tick),
    (v_person_id,'social',0.70,v_tick),
    (v_person_id,'purpose',0.70,v_tick),
    (v_person_id,'variety',0.70,v_tick)
  on conflict (person_id,need_code) do nothing;

  if not exists (
    select 1 from public.npc_ledger
    where actor_id=v_person_actor_id
      and ref='bootstrap:person:' || v_person_id::text
  ) then
    insert into public.npc_ledger(
      actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note
    ) values (
      v_person_actor_id,v_tick,'endowment',null,0,980,v_location_id,
      'bootstrap:person:' || v_person_id::text,
      'Bootstrap-Startbestand des neu materialisierten NPC; keine wiederkehrende Einnahme'
    );
  end if;

  select id into v_home_assignment_id
  from public.person_assignments
  where person_id=v_person_id
    and assignment_type='home'
    and is_active=true
  order by created_at
  limit 1;

  if v_home_assignment_id is null then
    insert into public.person_assignments(
      person_id,assignment_type,location_id,tile_entity_id,employer_actor_id,
      role_code,starts_tick,ends_tick,is_active
    ) values (
      v_person_id,'home',v_location_id,v_home_id,null,
      'resident',v_tick,null,true
    )
    returning id into v_home_assignment_id;
  end if;

  insert into public.person_tenancies(
    assignment_id,person_id,location_id,tile_entity_id,landlord_actor_id,
    rent_per_billing,billing_interval_ticks,next_due_tick,status,origin,tenure
  ) values (
    v_home_assignment_id,v_person_id,v_location_id,v_home_id,v_landlord_actor_id,
    480,720,v_tick+720,'active','market','rented'
  )
  on conflict (assignment_id) do nothing;

  if not exists (
    select 1 from public.person_assignments
    where person_id=v_person_id
      and assignment_type='work'
      and is_active=true
  ) then
    insert into public.person_assignments(
      person_id,assignment_type,location_id,tile_entity_id,region_feature_id,
      employer_actor_id,role_code,starts_tick,ends_tick,is_active
    ) values (
      v_person_id,'work',v_location_id,null,v_church_feature_id,
      v_employer_actor_id,'priest',v_tick,null,true
    );
  end if;
end $$;
