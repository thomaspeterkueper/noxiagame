-- Minimal social seed for the first clergy pilot.
-- A local acquaintance only: no friendship, no privileged trust, no invented memory event.

do $$
declare
  v_elias uuid;
  v_mika uuid;
begin
  select id into v_elias from public.people
  where person_key='earth-sundern-st-johannes-priest-001'
  limit 1;

  select id into v_mika from public.people
  where person_key='earth-cafe-host'
  limit 1;

  if v_elias is null or v_mika is null then
    raise exception 'NOXIA_CLERGY_ACQUAINTANCE_PERSON_MISSING';
  end if;

  insert into public.person_relationships(
    person_id,other_person_id,relationship_type,
    familiarity,trust,affinity,last_interaction_tick,
    encounter_count_total,recent_encounter_score,relationship_updated_tick
  ) values
    (v_elias,v_mika,'acquaintance',0.18,0.50,0.50,null,0,0,null),
    (v_mika,v_elias,'acquaintance',0.18,0.50,0.50,null,0,0,null)
  on conflict (person_id,other_person_id) do nothing;
end $$;
