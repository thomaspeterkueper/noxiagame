-- Complete the first clergy pilot with persistent presentation and one weak
-- initial-state local acquaintance. No heritage inference and no fabricated memory/event.

do $$
declare
  v_person_id uuid;
  v_mika_id uuid;
begin
  select id into v_person_id
  from public.people
  where person_key='earth-sundern-st-johannes-priest-001'
  limit 1;

  if v_person_id is null then
    raise exception 'NOXIA_CLERGY_PILOT_PERSON_MISSING';
  end if;

  insert into public.person_appearance(
    person_id,
    gender_identity,
    gender_presentation,
    body_frame,
    skin_tone_code,
    hair_style_code,
    hair_color_code,
    facial_hair_code,
    visible_age_band,
    clothing_profile,
    cultural_heritage
  )
  values (
    v_person_id,
    null,
    case
      when mod(abs(hashtextextended(v_person_id::text, 11)), 20) = 0 then 'androgynous'
      when mod(abs(hashtextextended(v_person_id::text, 11)), 2) = 0 then 'feminine'
      else 'masculine'
    end,
    case mod(abs(hashtextextended(v_person_id::text, 23)), 3)
      when 0 then 'slender'
      when 1 then 'average'
      else 'broad'
    end,
    'skin_' || (1 + mod(abs(hashtextextended(v_person_id::text, 37)), 6))::text,
    case mod(abs(hashtextextended(v_person_id::text, 41)), 5)
      when 0 then 'short'
      when 1 then 'long'
      when 2 then 'curly'
      when 3 then 'braided'
      else 'shaved'
    end,
    case mod(abs(hashtextextended(v_person_id::text, 43)), 5)
      when 0 then 'dark'
      when 1 then 'brown'
      when 2 then 'light'
      when 3 then 'red'
      else 'grey'
    end,
    case
      when mod(abs(hashtextextended(v_person_id::text, 47)), 5) = 0 then 'short'
      else 'none'
    end,
    'adult',
    '{}'::jsonb,
    '{}'::jsonb
  )
  on conflict (person_id) do nothing;

  select id into v_mika_id
  from public.people
  where person_key='earth-cafe-host'
  limit 1;

  if v_mika_id is not null then
    insert into public.person_relationships(
      person_id,other_person_id,relationship_type,
      familiarity,trust,affinity,last_interaction_tick,
      encounter_count_total,recent_encounter_score,relationship_updated_tick
    )
    values
      (v_person_id,v_mika_id,'acquaintance',0.18,0.50,0.52,null,0,0,null),
      (v_mika_id,v_person_id,'acquaintance',0.18,0.50,0.52,null,0,0,null)
    on conflict (person_id,other_person_id) do nothing;
  end if;
end $$;
