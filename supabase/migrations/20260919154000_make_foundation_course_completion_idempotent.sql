create or replace function public.complete_foundation_course(
  p_profile_id uuid,
  p_course_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_points integer;
  v_already_completed boolean := false;
  v_new_total integer;
  v_awarded integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || p_course_id::text, 0));

  select punkte into v_points
  from public.foundation_kurse
  where id = p_course_id and published = true;

  if v_points is null then
    raise exception 'course_not_found';
  end if;

  select coalesce(quiz_bestanden,false) into v_already_completed
  from public.kurs_fortschritt
  where profile_id = p_profile_id and kurs_id = p_course_id;

  v_already_completed := coalesce(v_already_completed,false);

  insert into public.kurs_fortschritt(
    profile_id, kurs_id, gestartet_at, abgeschlossen_at, letzte_folie,
    quiz_bestanden, punkte_verdient
  ) values (
    p_profile_id, p_course_id, now(), now(), 1,
    true, case when v_already_completed then 0 else v_points end
  )
  on conflict (profile_id,kurs_id) do update set
    abgeschlossen_at = now(),
    quiz_bestanden = true,
    punkte_verdient = greatest(public.kurs_fortschritt.punkte_verdient,
      case when v_already_completed then 0 else v_points end);

  if not v_already_completed and v_points > 0 then
    v_new_total := public.award_knowledge(
      p_profile_id,
      v_points,
      'kurs_abgeschlossen',
      'foundation_course:' || p_course_id::text
    );
    v_awarded := v_points;
  else
    select knowledge_points into v_new_total from public.profiles where id = p_profile_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'points_awarded', v_awarded,
    'course_points', v_points,
    'already_completed', v_already_completed,
    'knowledge_points', coalesce(v_new_total,0)
  );
end;
$$;

revoke all on function public.complete_foundation_course(uuid,uuid) from public;
grant execute on function public.complete_foundation_course(uuid,uuid) to service_role;
