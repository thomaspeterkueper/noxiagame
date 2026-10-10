-- NOXIA settlement social-infrastructure MVP:
-- seed one canonical Earth cafe host using the existing Living Population model.
-- No new conversation pipeline and no special money creation.

set search_path to public;

do $$
declare
  v_earth uuid;
  v_cafe uuid;
  v_owner_profile uuid;
  v_employer_actor uuid;
  v_home uuid;
  v_person uuid;
begin
  select id into v_earth from public.locations where slug='earth' limit 1;
  if v_earth is null then
    raise notice 'Cafe host seed skipped: earth not found';
    return;
  end if;

  -- Prefer a concretely materialized local place; fall back to the oldest
  -- active Earth cafe. Do not hardcode generated entity UUIDs.
  select te.id, te.profile_id
    into v_cafe, v_owner_profile
  from public.tile_entities te
  where te.location_id=v_earth
    and te.entity_type='building'
    and te.entity_id='cafe'
    and te.status='active'
  order by
    case when coalesce(te.spatial_region_id,'') like 'earth-place-%' then 0 else 1 end,
    te.created_at,
    te.id
  limit 1;

  if v_cafe is null then
    raise notice 'Cafe host seed skipped: no active Earth cafe found';
    return;
  end if;

  if v_owner_profile is not null then
    select actor_id into v_employer_actor
    from public.profile_economic_actors
    where profile_id=v_owner_profile;
  end if;

  select p.id into v_person
  from public.people p
  where p.person_key='earth-cafe-host'
  limit 1;

  if v_person is null then
    insert into public.people(
      display_name,birth_year,current_location_id,simulation_tier,activity_state,
      person_key,bio_short,public_role,traits,observable_description
    ) values (
      'Mika Berger',2058,v_earth,'active','idle',
      'earth-cafe-host',
      'Betreibt den Tresen des Startcafés und kennt die alltäglichen Wege in die NOXIA-Welt.',
      'Wirt · Orientierung',
      '{"sociability":0.78,"patience":0.74,"curiosity":0.58}'::jsonb,
      'Eine ruhige Person hinter dem Tresen, aufmerksam für neue Gesichter.'
    )
    returning id into v_person;
  else
    update public.people
    set current_location_id=v_earth,
        public_role='Wirt · Orientierung',
        updated_at=now()
    where id=v_person;
  end if;

  insert into public.person_needs(person_id,need_code,satisfaction)
  select v_person,need_code,satisfaction
  from (values
    ('sustenance',0.80::numeric),
    ('rest',0.78::numeric),
    ('safety',0.82::numeric),
    ('social',0.84::numeric),
    ('purpose',0.86::numeric),
    ('variety',0.72::numeric)
  ) as n(need_code,satisfaction)
  on conflict (person_id,need_code) do nothing;

  if not exists (
    select 1 from public.person_assignments
    where person_id=v_person
      and assignment_type='work'
      and tile_entity_id=v_cafe
      and is_active=true
  ) then
    insert into public.person_assignments(
      person_id,assignment_type,location_id,tile_entity_id,
      employer_actor_id,role_code,is_active
    ) values (
      v_person,'work',v_earth,v_cafe,v_employer_actor,'service',true
    );
  end if;

  -- Give the host a real home without inventing private rent. Prefer STATE.
  select te.id into v_home
  from public.tile_entities te
  left join public.residential_occupancy ro on ro.tile_entity_id=te.id
  where te.location_id=v_earth
    and te.entity_type='building'
    and te.status='active'
    and te.residential_capacity is not null
    and te.owner_class='STATE'
    and coalesce(ro.free_places,te.residential_capacity)>0
  order by te.created_at,te.id
  limit 1;

  if v_home is not null and not exists (
    select 1 from public.person_assignments
    where person_id=v_person and assignment_type='home' and is_active=true
  ) then
    insert into public.person_assignments(
      person_id,assignment_type,location_id,tile_entity_id,role_code,is_active
    ) values (
      v_person,'home',v_earth,v_home,'resident',true
    );
  end if;
end $$;
