-- NOXIA-SCHOOL-0001, Schritt 1: Kompetenzen wachsen und verblassen.
--
-- Ein Modell für Personen (person_skills) und Spieler (profile_skills): gleiches Schema,
-- gleiche Formeln wie lib/game/skills/skills.ts. Erfahrung ist die Wahrheit, die Stufe folgt.
-- Additiv: bestehende Seeds bleiben gültig; ihre Spitzenstufe wird aus der aktuellen Stufe gesetzt.
-- Noch keine Inhalte: practice_recipes bleibt leer, bis KG/SSF Rezepte liefern.

-- 1. Personen: Spitzenstufe und letzte Übung ------------------------------------------
alter table public.person_skills
  add column if not exists peak_level numeric(5,4) not null default 0 check (peak_level between 0 and 1),
  add column if not exists last_practiced_tick bigint;

update public.person_skills set peak_level = level where peak_level < level;

-- 2. Spieler: eigene Ablage, gleiches Schema (ADR-npcs-sind-spieler) ---------------------
create table if not exists public.profile_skills (
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  skill_code          text not null check (char_length(trim(skill_code)) > 0),
  level               numeric(5,4) not null default 0 check (level between 0 and 1),
  experience          numeric not null default 0 check (experience >= 0),
  peak_level          numeric(5,4) not null default 0 check (peak_level between 0 and 1),
  last_practiced_tick bigint,
  updated_tick        bigint,
  updated_at          timestamptz not null default now(),
  primary key (profile_id, skill_code)
);

create index if not exists idx_profile_skills_code_level on public.profile_skills (skill_code, level desc);

alter table public.profile_skills enable row level security;
drop policy if exists profile_skills_service on public.profile_skills;
create policy profile_skills_service on public.profile_skills
  for all to service_role using (true) with check (true);
drop policy if exists profile_skills_own_read on public.profile_skills;
create policy profile_skills_own_read on public.profile_skills
  for select to authenticated using (profile_id = auth.uid());
revoke all on public.profile_skills from anon;
grant select on public.profile_skills to authenticated;
grant all on public.profile_skills to service_role;

-- 3. Übungsrezepte (Mechanik; Inhalte kommen aus KG/SSF) --------------------------------
create table if not exists public.practice_recipes (
  code                   text primary key check (char_length(trim(code)) > 0),
  skill_code             text not null,
  capability             text not null check (capability in ('learn', 'practice')),
  difficulty             numeric(4,3) not null default 0.3 check (difficulty between 0 and 1),
  experience             numeric not null check (experience > 0),
  duration_game_minutes  integer not null default 45 check (duration_game_minutes > 0),
  min_level              numeric(5,4) not null default 0 check (min_level between 0 and 1),
  requires_guide         boolean not null default false,
  inputs                 jsonb not null default '[]'::jsonb,   -- [{ "resource": "...", "amount": n }]
  outputs                jsonb not null default '[]'::jsonb,   -- nur bei Gelingen
  kg_module_id           text,                                 -- fachliche Quelle im Knowledge Graph
  active                 boolean not null default false,
  created_at             timestamptz not null default now()
);

alter table public.practice_recipes enable row level security;
drop policy if exists practice_recipes_read on public.practice_recipes;
create policy practice_recipes_read on public.practice_recipes for select using (active);
drop policy if exists practice_recipes_service on public.practice_recipes;
create policy practice_recipes_service on public.practice_recipes
  for all to service_role using (true) with check (true);

-- 4. Bescheinigungen ---------------------------------------------------------------------
create table if not exists public.skill_certificates (
  id                uuid primary key default gen_random_uuid(),
  holder_person_id  uuid references public.people(id) on delete cascade,
  holder_profile_id uuid references public.profiles(id) on delete cascade,
  issuer_actor_id   uuid references public.actors(id) on delete set null,
  tile_entity_id    uuid references public.tile_entities(id) on delete set null,
  skill_code        text not null,
  kind              text not null default 'learner' check (kind in ('learner', 'guide')),
  level             numeric(5,4) not null check (level between 0 and 1),
  issued_tick       bigint not null,
  created_at        timestamptz not null default now(),
  check ((holder_person_id is null) <> (holder_profile_id is null))
);

create index if not exists idx_skill_certificates_person on public.skill_certificates (holder_person_id, skill_code);
create index if not exists idx_skill_certificates_profile on public.skill_certificates (holder_profile_id, skill_code);

alter table public.skill_certificates enable row level security;
drop policy if exists skill_certificates_service on public.skill_certificates;
create policy skill_certificates_service on public.skill_certificates
  for all to service_role using (true) with check (true);
drop policy if exists skill_certificates_own_read on public.skill_certificates;
create policy skill_certificates_own_read on public.skill_certificates
  for select to authenticated using (holder_profile_id = auth.uid());
grant select on public.skill_certificates to authenticated;

-- 5. Formeln (identisch zu lib/game/skills/skills.ts) ------------------------------------
create or replace function public.noxia_skill_level(p_experience numeric)
returns numeric language sql immutable as $$
  select case when p_experience is null or p_experience <= 0 then 0
              else least(1, greatest(0, 1 - exp(-p_experience / 100.0))) end
$$;

create or replace function public.noxia_skill_experience_for_level(p_level numeric)
returns numeric language sql immutable as $$
  select case when p_level <= 0 then 0
              when p_level >= 0.9999 then 100.0 * 9.21
              else -100.0 * ln(1 - p_level) end
$$;

-- Verblassen: 14 Spieltage Schonfrist, dann 1 % des Abstands zum Sockel (halbe Spitzenstufe) je Spieltag.
create or replace function public.noxia_skill_decayed_level(
  p_level numeric, p_peak numeric, p_last_tick bigint, p_tick bigint
) returns numeric language plpgsql immutable as $$
declare v_idle numeric; v_floor numeric;
begin
  if p_last_tick is null then return p_level; end if;
  v_idle := p_tick - p_last_tick - 14 * 24;
  if v_idle <= 0 then return p_level; end if;
  v_floor := coalesce(p_peak, 0) * 0.5;
  if p_level <= v_floor then return p_level; end if;
  return v_floor + (p_level - v_floor) * power(0.99, v_idle / 24.0);
end $$;

-- Ein Schreibweg für beide: genau eines von p_person_id / p_profile_id.
create or replace function public.noxia_gain_skill_experience(
  p_person_id uuid, p_profile_id uuid, p_skill_code text, p_amount numeric, p_tick bigint, p_source text
) returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_level numeric := 0; v_peak numeric := 0; v_last bigint; v_xp numeric;
begin
  if (p_person_id is null) = (p_profile_id is null) then
    raise exception 'exactly one of person or profile is required';
  end if;
  if p_amount is null or p_amount < 0 then raise exception 'experience gain must be >= 0'; end if;

  if p_person_id is not null then
    select level, peak_level, last_practiced_tick into v_level, v_peak, v_last
      from person_skills where person_id = p_person_id and skill_code = p_skill_code for update;
  else
    select level, peak_level, last_practiced_tick into v_level, v_peak, v_last
      from profile_skills where profile_id = p_profile_id and skill_code = p_skill_code for update;
  end if;

  v_level := noxia_skill_decayed_level(coalesce(v_level, 0), coalesce(v_peak, 0), v_last, p_tick);
  v_xp := noxia_skill_experience_for_level(v_level) + p_amount;
  v_level := noxia_skill_level(v_xp);
  v_peak := greatest(coalesce(v_peak, 0), v_level);

  if p_person_id is not null then
    insert into person_skills (person_id, skill_code, level, experience, peak_level, last_practiced_tick, updated_tick)
    values (p_person_id, p_skill_code, v_level, v_xp, v_peak, p_tick, p_tick)
    on conflict (person_id, skill_code) do update set
      level = excluded.level, experience = excluded.experience, peak_level = excluded.peak_level,
      last_practiced_tick = excluded.last_practiced_tick, updated_tick = excluded.updated_tick, updated_at = now();
    insert into population_events (tick, event_type, actor_person_id, subject_type, subject_ref, payload)
    values (p_tick, 'skill_experience', p_person_id, 'skill', p_skill_code,
            jsonb_build_object('amount', p_amount, 'level', v_level, 'source', p_source));
  else
    insert into profile_skills (profile_id, skill_code, level, experience, peak_level, last_practiced_tick, updated_tick)
    values (p_profile_id, p_skill_code, v_level, v_xp, v_peak, p_tick, p_tick)
    on conflict (profile_id, skill_code) do update set
      level = excluded.level, experience = excluded.experience, peak_level = excluded.peak_level,
      last_practiced_tick = excluded.last_practiced_tick, updated_tick = excluded.updated_tick, updated_at = now();
  end if;

  return v_level;
end $$;

revoke all on function public.noxia_gain_skill_experience(uuid, uuid, text, numeric, bigint, text) from public, anon, authenticated;
grant execute on function public.noxia_gain_skill_experience(uuid, uuid, text, numeric, bigint, text) to service_role;

comment on table public.profile_skills is 'Kompetenzen der Spieler – gleiches Schema und gleiche Regeln wie person_skills (NOXIA-SCHOOL-0001).';
comment on table public.practice_recipes is 'Übungen für Schulen und Arbeitsplätze. Mechanik hier, fachlicher Inhalt aus dem Knowledge Graph (kg_module_id).';
comment on table public.skill_certificates is 'Bescheinigungen über Kompetenz (learner) oder Anleitung (guide); lesbar für den Stellenmarkt.';
