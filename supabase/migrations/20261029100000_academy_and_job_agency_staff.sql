-- Personal für die Akademie und die Agentur für Arbeit.
-- Wunsch Thomas (29.10.2026): „Außerdem braucht auch die Akademie Personal, mit dem man
-- reden kann.“ Dazu R-21 Punkt 1 (Gastronomie): Personal der Agentur für Arbeit.
--
-- Befund: Die Akademie der Erde (school, staatlich) hatte eine Lehrkraft und keine
-- Personalplätze (staff_capacity leer); run_venue_staffing kannte die Art nicht. Der
-- Innenraum hat drei Plätze für Personal: Sekretariat, Rednerpult, Lehrbereich.
--
-- Neu:
--   * school und job_agency in noxia_staffed_kinds().
--   * Rollen je Platz: Akademie 1 Lehrkraft (die bisherige), 2 Sekretariat, 3 Lehrkraft;
--     Agentur 1 Vermittlung, 2 Beratung, 3 Büro (Lohnschlüssel job_advisor, 65 Cr/Tag).
--   * Staatliche Akademien und Agenturen mit Lage auf der Erde: 3 Personalplätze.
--     Mars, Phobos: unverändert (keine Lage für Bewerber, kein Arbeitgeber am Haus).
--   * Übergangsreserve (NOXIA-FIN-0001, ausgewiesene Emission): 14 Tageslöhne der neuen
--     Plätze für den öffentlichen Akteur der Erde,
--     ref bootstrap:employer:<actor>:public_services:academy_job_agency.
-- Eingestellt wird beim nächsten Lauf von run_venue_staffing (Bevölkerungs-Cron).

set search_path to public;

create or replace function public.noxia_staffed_kinds() returns text[]
language sql immutable as $$
  select array['cafe', 'bar', 'restaurant', 'hotel', 'nightclub', 'bank', 'travel_agency', 'school', 'job_agency']::text[]
$$;

insert into public.role_wage_rates (role_code, daily_credits)
values ('job_advisor', 65)
on conflict (role_code) do nothing;

insert into public.building_staff_roles (entity_id, slot, role_code, label) values
  ('school', 1, 'educator', 'Lehrkraft'),
  ('school', 2, 'administrator', 'Sekretariat'),
  ('school', 3, 'educator', 'Lehrbereich'),
  ('job_agency', 1, 'job_advisor', 'Vermittlung'),
  ('job_agency', 2, 'job_advisor', 'Beratung'),
  ('job_agency', 3, 'administrator', 'Büro')
on conflict (entity_id, slot) do nothing;

update public.tile_entities te
   set staff_capacity = 3
  from public.locations l
 where l.id = te.location_id and l.slug = 'earth'
   and te.entity_id in ('school', 'job_agency') and te.is_state_owned and te.status = 'active'
   and coalesce(te.staff_capacity, 0) < 3;

-- Übergangsreserve für die neuen Plätze (nur Plätze, die noch niemand besetzt).
do $$
declare
  v_earth uuid;
  v_actor uuid;
  v_daily integer;
  v_tick bigint;
  v_ref text;
begin
  select id into v_earth from public.locations where slug = 'earth';
  select actor_id into v_actor from public.location_public_actors where location_id = v_earth;
  if v_actor is null then return; end if;
  v_ref := 'bootstrap:employer:' || v_actor::text || ':public_services:academy_job_agency';
  if exists (select 1 from public.npc_ledger where actor_id = v_actor and ref = v_ref) then return; end if;
  select coalesce(sum(w.daily_credits), 0) into v_daily
    from public.tile_entities te
    join generate_series(1, 8) s(slot) on s.slot <= coalesce(te.staff_capacity, 0)
    join public.building_staff_roles r on r.entity_id = te.entity_id and r.slot = s.slot
    join public.role_wage_rates w on w.role_code = r.role_code
   where te.location_id = v_earth and te.is_state_owned and te.status = 'active'
     and te.entity_id in ('school', 'job_agency')
     and s.slot > (select count(*) from public.person_assignments a
                    where a.tile_entity_id = te.id and a.assignment_type = 'work' and a.is_active);
  if v_daily = 0 then return; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_actor, v_tick, 'endowment', null, 0, 14 * v_daily, v_earth, v_ref,
          'Bootstrap-Übergangsreserve: 14 Tageslöhne für das neue Personal von Akademie und Agentur für Arbeit');
end $$;
