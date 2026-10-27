-- NOXIA-SCHOOL-0001, Schritt 2: Übungsablauf mit echten Gütern.
--
-- start: prüft Rezept, Mindeststufe und Anleitung, verbraucht das Material aus dem Vorrat
--        des Gebäudes (Material ist auch bei Misslingen weg) und legt eine Sitzung an.
-- complete: nach Ablauf der Dauer – Ausgang nach Kompetenz, Erfahrung für Lernende und
--        Anleitende, Ergebnisse nur bei Gelingen, Bescheinigungen an Schwellen.
-- Formeln wie lib/game/skills/skills.ts. Lernen kostet nie Geld (NOXIA-SCHOOL-0001).
-- Ergebnisse: Güter ({"resource","amount"}) in den Vorrat, Bedürfnisse ({"need","gain"})
-- für Personen. Spieler-Bedürfnisse folgen, sobald player_needs existiert (NOXIA-LIVING-0012).

create table if not exists public.practice_sessions (
  id                 uuid primary key default gen_random_uuid(),
  command_id         uuid not null unique,
  recipe_code        text not null references public.practice_recipes(code),
  tile_entity_id     uuid not null references public.tile_entities(id) on delete cascade,
  learner_person_id  uuid references public.people(id) on delete cascade,
  learner_profile_id uuid references public.profiles(id) on delete cascade,
  guide_person_id    uuid references public.people(id) on delete set null,
  guide_profile_id   uuid references public.profiles(id) on delete set null,
  guide_kind         text not null default 'none' check (guide_kind in ('none', 'staff', 'person', 'player')),
  status             text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  started_tick       bigint not null,
  due_tick           bigint not null,
  completed_tick     bigint,
  result             jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  check ((learner_person_id is null) <> (learner_profile_id is null)),
  check (guide_person_id is null or guide_profile_id is null),
  check (due_tick >= started_tick)
);

create index if not exists idx_practice_sessions_building on public.practice_sessions (tile_entity_id, status, due_tick);
create index if not exists idx_practice_sessions_learner_profile on public.practice_sessions (learner_profile_id, started_tick desc);
create index if not exists idx_practice_sessions_learner_person on public.practice_sessions (learner_person_id, started_tick desc);

alter table public.practice_sessions enable row level security;
drop policy if exists practice_sessions_service on public.practice_sessions;
create policy practice_sessions_service on public.practice_sessions
  for all to service_role using (true) with check (true);
drop policy if exists practice_sessions_own_read on public.practice_sessions;
create policy practice_sessions_own_read on public.practice_sessions
  for select to authenticated using (learner_profile_id = auth.uid() or guide_profile_id = auth.uid());
grant select on public.practice_sessions to authenticated;

-- Aktuelle Stufe (mit Verblassen) einer Person oder eines Spielers.
create or replace function public.noxia_current_skill_level(
  p_person_id uuid, p_profile_id uuid, p_skill_code text, p_tick bigint
) returns numeric language sql stable set search_path = public as $$
  select coalesce((
    select noxia_skill_decayed_level(level, peak_level, last_practiced_tick, p_tick)
      from person_skills where p_person_id is not null and person_id = p_person_id and skill_code = p_skill_code
    union all
    select noxia_skill_decayed_level(level, peak_level, last_practiced_tick, p_tick)
      from profile_skills where p_profile_id is not null and profile_id = p_profile_id and skill_code = p_skill_code
    limit 1), 0)
$$;

-- Vorrat eines Gebäudes; wird beim ersten Bedarf angelegt (gleiche Form wie Produktionsanlagen).
create or replace function public.noxia_building_inventory(p_tile_entity_id uuid)
returns uuid language plpgsql set search_path = public as $$
declare v_id uuid; v_location uuid;
begin
  select id into v_id from logistics_inventories
   where storage_kind = 'native' and subject_type = 'tile_entity' and subject_id = p_tile_entity_id;
  if v_id is not null then return v_id; end if;
  select location_id into v_location from tile_entities where id = p_tile_entity_id;
  if not found then raise exception 'NOXIA_PRACTICE_BUILDING_NOT_FOUND:%', p_tile_entity_id using errcode = 'P0001'; end if;
  insert into logistics_inventories (location_id, inventory_kind, storage_kind, subject_type, subject_id, label)
  values (v_location, 'facility', 'native', 'tile_entity', p_tile_entity_id, 'Vorrat')
  on conflict (storage_kind, subject_type, subject_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from logistics_inventories
     where storage_kind = 'native' and subject_type = 'tile_entity' and subject_id = p_tile_entity_id;
  end if;
  return v_id;
end $$;

create or replace function public.noxia_start_practice(
  p_command_id uuid,
  p_learner_person_id uuid, p_learner_profile_id uuid,
  p_recipe_code text, p_tile_entity_id uuid,
  p_guide_person_id uuid, p_guide_profile_id uuid,
  p_tick bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_existing practice_sessions%rowtype;
  v_recipe practice_recipes%rowtype;
  v_level numeric;
  v_guide_kind text := 'none';
  v_guide_person uuid := p_guide_person_id;
  v_guide_profile uuid := p_guide_profile_id;
  v_inventory uuid;
  v_input jsonb;
  v_session uuid;
begin
  if (p_learner_person_id is null) = (p_learner_profile_id is null) then
    raise exception 'NOXIA_PRACTICE_LEARNER_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_existing from practice_sessions where command_id = p_command_id;
  if found then return jsonb_build_object('ok', true, 'sessionId', v_existing.id, 'dueTick', v_existing.due_tick, 'idempotent', true); end if;

  select * into v_recipe from practice_recipes where code = p_recipe_code and active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'recipe-unavailable'); end if;

  if exists (select 1 from practice_sessions where status = 'running'
              and (learner_person_id = p_learner_person_id or learner_profile_id = p_learner_profile_id)) then
    return jsonb_build_object('ok', false, 'reason', 'already-practising');
  end if;

  v_level := noxia_current_skill_level(p_learner_person_id, p_learner_profile_id, v_recipe.skill_code, p_tick);
  if v_level < v_recipe.min_level then return jsonb_build_object('ok', false, 'reason', 'below-min-level'); end if;

  -- Anleitung: genannte Person/Spieler ab Stufe 0,7, sonst eine Lehrkraft am Gebäude.
  if v_guide_person is not null or v_guide_profile is not null then
    if v_guide_person = p_learner_person_id or v_guide_profile = p_learner_profile_id then
      return jsonb_build_object('ok', false, 'reason', 'cannot-guide-self');
    end if;
    if noxia_current_skill_level(v_guide_person, v_guide_profile, v_recipe.skill_code, p_tick) < 0.7 then
      return jsonb_build_object('ok', false, 'reason', 'guide-not-competent');
    end if;
    v_guide_kind := case when v_guide_person is not null then 'person' else 'player' end;
  else
    select pa.person_id into v_guide_person
      from person_assignments pa
     where pa.tile_entity_id = p_tile_entity_id and pa.assignment_type = 'work'
       and pa.is_active and pa.role_code = 'educator'
       and pa.person_id is distinct from p_learner_person_id
     order by pa.created_at limit 1;
    if v_guide_person is not null then v_guide_kind := 'staff'; end if;
  end if;
  if v_recipe.requires_guide and v_guide_kind = 'none' then
    return jsonb_build_object('ok', false, 'reason', 'needs-guide');
  end if;

  -- Material verbrauchen (fehlt etwas, wird alles zurückgerollt).
  v_inventory := noxia_building_inventory(p_tile_entity_id);
  begin
    for v_input in select * from jsonb_array_elements(v_recipe.inputs) loop
      perform noxia_adjust_inventory_amount(v_inventory, (v_input->>'resource')::resource_type, -((v_input->>'amount')::integer));
    end loop;
  exception when others then
    if sqlerrm like 'NOXIA_INVENTORY_STOCK_INSUFFICIENT%' then
      return jsonb_build_object('ok', false, 'reason', 'materials-missing', 'detail', sqlerrm);
    end if;
    raise;
  end;

  insert into practice_sessions (command_id, recipe_code, tile_entity_id, learner_person_id, learner_profile_id,
                                 guide_person_id, guide_profile_id, guide_kind, started_tick, due_tick)
  values (p_command_id, v_recipe.code, p_tile_entity_id, p_learner_person_id, p_learner_profile_id,
          v_guide_person, v_guide_profile, v_guide_kind, p_tick,
          p_tick + greatest(1, ceil(v_recipe.duration_game_minutes / 60.0))::bigint)
  returning id into v_session;

  return jsonb_build_object('ok', true, 'sessionId', v_session, 'guideKind', v_guide_kind,
                            'dueTick', p_tick + greatest(1, ceil(v_recipe.duration_game_minutes / 60.0))::bigint);
end $$;

create or replace function public.noxia_complete_practice(p_session_id uuid, p_roll numeric, p_tick bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s practice_sessions%rowtype;
  r practice_recipes%rowtype;
  v_level_before numeric; v_level_after numeric; v_chance numeric; v_ok boolean;
  v_guided boolean; v_xp numeric; v_guide_xp numeric := 0;
  v_inventory uuid; v_out jsonb; v_issuer uuid; v_band numeric; v_guided_count integer;
  v_certs jsonb := '[]'::jsonb; v_result jsonb;
begin
  select * into s from practice_sessions where id = p_session_id for update;
  if not found then raise exception 'NOXIA_PRACTICE_SESSION_NOT_FOUND:%', p_session_id using errcode = 'P0001'; end if;
  if s.status <> 'running' then return s.result || jsonb_build_object('idempotent', true); end if;
  if p_tick < s.due_tick then return jsonb_build_object('ok', false, 'reason', 'not-due', 'dueTick', s.due_tick); end if;

  select * into r from practice_recipes where code = s.recipe_code;
  v_guided := s.guide_kind <> 'none';
  v_level_before := noxia_current_skill_level(s.learner_person_id, s.learner_profile_id, r.skill_code, p_tick);
  v_chance := least(1, greatest(0, 0.35 + 0.6 * v_level_before + case when v_guided then 0.2 else 0 end - 0.5 * r.difficulty));
  v_ok := coalesce(p_roll, 1) < v_chance;
  v_xp := r.experience * case when v_ok then 1 else 0.4 end;

  v_level_after := noxia_gain_skill_experience(s.learner_person_id, s.learner_profile_id, r.skill_code, v_xp, p_tick, 'practice:' || r.code);

  if v_guided and (s.guide_person_id is not null or s.guide_profile_id is not null) then
    v_guide_xp := r.experience * 0.25;
    perform noxia_gain_skill_experience(s.guide_person_id, s.guide_profile_id, r.skill_code, v_guide_xp, p_tick, 'guide:' || r.code);
  end if;

  if v_ok then
    v_inventory := noxia_building_inventory(s.tile_entity_id);
    for v_out in select * from jsonb_array_elements(r.outputs) loop
      if v_out ? 'resource' then
        perform noxia_adjust_inventory_amount(v_inventory, (v_out->>'resource')::resource_type, (v_out->>'amount')::integer);
      elsif v_out ? 'need' and s.learner_person_id is not null then
        update person_needs set satisfaction = least(1, satisfaction + (v_out->>'gain')::numeric), updated_tick = p_tick
         where person_id = s.learner_person_id and need_code = v_out->>'need';
      end if;
    end loop;
  end if;

  -- Bescheinigungen: Lernende an den Schwellen 0,3 / 0,5 / 0,7; Anleitende nach 10 und 30 Anleitungen.
  select lpa.actor_id into v_issuer
    from tile_entities te join location_public_actors lpa on lpa.location_id = te.location_id
   where te.id = s.tile_entity_id limit 1;
  foreach v_band in array array[0.3, 0.5, 0.7] loop
    if v_level_before < v_band and v_level_after >= v_band then
      insert into skill_certificates (holder_person_id, holder_profile_id, issuer_actor_id, tile_entity_id, skill_code, kind, level, issued_tick)
      values (s.learner_person_id, s.learner_profile_id, v_issuer, s.tile_entity_id, r.skill_code, 'learner', v_band, p_tick);
      v_certs := v_certs || jsonb_build_object('kind', 'learner', 'level', v_band);
    end if;
  end loop;
  if s.guide_kind in ('person', 'player') then
    select count(*) into v_guided_count from practice_sessions ps join practice_recipes pr on pr.code = ps.recipe_code
     where ps.status <> 'running' and pr.skill_code = r.skill_code
       and ((s.guide_person_id is not null and ps.guide_person_id = s.guide_person_id)
         or (s.guide_profile_id is not null and ps.guide_profile_id = s.guide_profile_id));
    if v_guided_count + 1 in (10, 30) then
      insert into skill_certificates (holder_person_id, holder_profile_id, issuer_actor_id, tile_entity_id, skill_code, kind, level, issued_tick)
      values (s.guide_person_id, s.guide_profile_id, v_issuer, s.tile_entity_id, r.skill_code, 'guide',
              noxia_current_skill_level(s.guide_person_id, s.guide_profile_id, r.skill_code, p_tick), p_tick);
      v_certs := v_certs || jsonb_build_object('kind', 'guide', 'guided', v_guided_count + 1);
    end if;
  end if;

  v_result := jsonb_build_object('ok', true, 'succeeded', v_ok, 'skillCode', r.skill_code,
    'levelBefore', round(v_level_before, 4), 'levelAfter', round(v_level_after, 4),
    'experience', v_xp, 'guideExperience', v_guide_xp, 'outputs', case when v_ok then r.outputs else '[]'::jsonb end,
    'certificates', v_certs);
  update practice_sessions set status = case when v_ok then 'succeeded' else 'failed' end,
         completed_tick = p_tick, result = v_result where id = s.id;
  return v_result;
end $$;

revoke all on function public.noxia_start_practice(uuid, uuid, uuid, text, uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.noxia_complete_practice(uuid, numeric, bigint) from public, anon, authenticated;
revoke all on function public.noxia_building_inventory(uuid) from public, anon, authenticated;
grant execute on function public.noxia_start_practice(uuid, uuid, uuid, text, uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.noxia_complete_practice(uuid, numeric, bigint) to service_role;
grant execute on function public.noxia_building_inventory(uuid) to service_role;
grant execute on function public.noxia_current_skill_level(uuid, uuid, text, bigint) to service_role;

comment on table public.practice_sessions is 'Laufende und abgeschlossene Übungen (NOXIA-SCHOOL-0001). Material wird beim Start verbraucht, Ergebnisse nur bei Gelingen.';
