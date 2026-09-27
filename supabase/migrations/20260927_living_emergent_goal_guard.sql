-- NOXIA-LIVING — emergent goal replay guard
-- One active goal of a given semantic identity per person.
create unique index if not exists person_goals_active_identity_uidx
  on public.person_goals(person_id, goal_code, coalesce(subject_type, ''), coalesce(subject_ref, ''))
  where status = 'active';
