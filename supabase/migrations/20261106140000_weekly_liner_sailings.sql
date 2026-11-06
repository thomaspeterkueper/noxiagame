-- 20261106140000_weekly_liner_sailings.sql
-- Erstellt:     06.11.2026
-- Aktualisiert: 06.11.2026 — Linienfracht: Epona fährt jede Woche, auch mit wenig Ladung; Ticket für Zugezogene
-- Version:      1.0.0
--
-- Entschieden (Thomas, 06.11.2026, NOXIA-FIN-0002 Frage 7: „Ja mach das“):
-- Die Handelsfirma liefert nur, wenn es sich lohnt – seit Wochen also nichts. Daran hängen
-- Mitflug (crew_signons) und Zuzug (run_colony_immigration). Deshalb fährt der Frachtführer
-- (Epona Fracht) eine feste Linie, einmal je Woche und Richtung, auch ohne Handelsware.
--
-- Regel:
--   * liner_routes: Abfahrtsstunde in der Woche (Tick mod 168) und Fahrtdauer in Stunden.
--     Tick 2598 = Mi 28.10.2026 19:00 UTC, also Stunde 21 = Montag 10:00 UTC.
--   * run_liner_sailings(p_tick) legt zur Abfahrtsstunde eine Sendung an
--     (npc_shipments, service = 'liner', amount 0, Ladung „Linie“). Einmal je Route und Woche
--     (Eindeutigkeit Firma, Tick, Gut; Gut = 'liner:<ziel>').
--   * Die Linie ist eine echte Sendung: Wer an der Flugleitung angeheuert hat, geht an Bord,
--     und mit jeder Ankunft von der Erde kann eine Person zuziehen.
--   * Zuzug nimmt die günstigste Stelle bei einem Arbeitgeber, der zahlen kann.
--   * Zugezogene zahlen 100 Cr Ticket aus ihren Ersparnissen an den Frachtführer
--     (Transfer nach NOXIA-FIN-0001).
--   * Die Linie kostet den Frachtführer zurzeit nichts außer der Heuer seiner Crew. Energie
--     für die Fahrt ist noch nicht gebucht (offen in NOXIA-FIN-0002).

set search_path to public;

alter table public.npc_shipments add column if not exists service text not null default 'trade';
alter table public.npc_shipments drop constraint if exists npc_shipments_service_check;
alter table public.npc_shipments add constraint npc_shipments_service_check check (service in ('trade', 'liner'));
alter table public.npc_shipments drop constraint if exists npc_shipments_amount_check;
alter table public.npc_shipments add constraint npc_shipments_amount_check check (amount > 0 or (service = 'liner' and amount >= 0));

create table if not exists public.liner_routes (
  from_location_id uuid not null references public.locations(id),
  to_location_id   uuid not null references public.locations(id),
  hour_of_week     integer not null check (hour_of_week between 0 and 167),
  hours            integer not null check (hours > 0),
  active           boolean not null default true,
  primary key (from_location_id, to_location_id),
  check (from_location_id <> to_location_id)
);
alter table public.liner_routes enable row level security;
revoke all on public.liner_routes from anon, authenticated;
grant select, insert, update, delete on public.liner_routes to service_role;

-- Montag 10:00 UTC zum Mond, 12:00 zum Mars, 14:00 nach Phobos; Donnerstag zurück.
-- Dauer wie die bisherigen Frachten (Erde–Mond 2 h, Erde–Mars im Mittel 61 h).
insert into public.liner_routes (from_location_id, to_location_id, hour_of_week, hours)
select f.id, t.id, r.h, r.d
  from (values ('earth', 'moon', 21, 2), ('earth', 'mars', 23, 61), ('earth', 'phobos', 25, 62),
               ('moon', 'earth', 93, 2), ('mars', 'earth', 95, 61), ('phobos', 'earth', 97, 62)) as r(f, t, h, d)
  join public.locations f on f.slug = r.f
  join public.locations t on t.slug = r.t
on conflict (from_location_id, to_location_id) do nothing;

create or replace function public.run_liner_sailings(p_tick bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_carrier uuid := public.noxia_carrier_actor();
  v_n integer;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_LINER_TICK_INVALID'; end if;
  if v_carrier is null then return jsonb_build_object('ok', false, 'reason', 'no_carrier'); end if;
  insert into public.npc_shipments (actor_id, resource, amount, from_location_id, to_location_id, depart_tick, arrive_tick, unit_cost, freight_cost, service)
  select v_carrier, 'liner:' || lt.slug, 0, r.from_location_id, r.to_location_id, p_tick, p_tick + r.hours, 0, 0, 'liner'
    from public.liner_routes r
    join public.locations lt on lt.id = r.to_location_id
   where r.active and p_tick % 168 = r.hour_of_week
  on conflict (actor_id, depart_tick, resource) do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'tick', p_tick, 'sailings', v_n);
end;
$$;
revoke all on function public.run_liner_sailings(bigint) from public, anon, authenticated;
grant execute on function public.run_liner_sailings(bigint) to service_role;

-- Zuzug wie bisher, dazu: das Ticket an den Frachtführer, und eine Stelle bei einem
-- zahlungsfähigen Arbeitgeber geht vor (vorher versperrte die klamme öffentliche Kasse
-- auf dem Mond die vier freien Bedienstellen an Boanns Eisbohrern).
create or replace function public.run_colony_immigration(p_tick bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ship record;
  v_home record;
  v_job record;
  v_balance numeric;
  v_payroll numeric;
  v_person uuid;
  v_actor uuid;
  v_assignment uuid;
  v_key text;
  v_hash text;
  v_name text;
  v_active integer;
  v_outcome text;
  v_arrived integer := 0;
  v_carrier uuid := public.noxia_carrier_actor();
  v_ticket integer := 100;
  v_checked integer := 0;
  v_first text[] := array['Amaru','Leila','Kenji','Sofia','Tomasz','Aisha','Mateo','Ingrid','Ravi','Zanele','Lukas','Mei','Omar','Freya','Diego','Yara','Henrik','Nia','Arjun','Elena','Kwame','Saoirse','Jonas','Ayumi','Tariq','Ines'];
  v_last  text[] := array['Okafor','Lindqvist','Tanaka','Moreau','Kowalski','Haddad','Silva','Novak','Rahman','Dube','Brandt','Chen','Farouk','Nilsen','Ortega','Kaya','Berglund','Mensah','Iyer','Petrova','Asante','Byrne','Weber','Sato','Aziz','Duarte'];
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_IMMIGRATION_TICK_INVALID'; end if;

  for v_ship in
    select s.id, s.to_location_id, lt.slug
      from public.npc_shipments s
      join public.locations lf on lf.id = s.from_location_id and lf.slug = 'earth'
      join public.locations lt on lt.id = s.to_location_id and lt.slug <> 'earth'
     where s.arrive_tick between p_tick - 1 and p_tick
       and not exists (select 1 from public.colony_arrivals a where a.shipment_id = s.id)
     order by s.arrive_tick, s.id
  loop
    v_checked := v_checked + 1;
    v_outcome := null;

    -- Freie Wohnung (Staat oder Figur, kein Spielerhaus).
    select te.id, te.x_m, te.y_m, te.spatial_region_id,
           coalesce(te.actor_id, case when te.is_state_owned then lpa.actor_id end) as landlord
      into v_home
      from public.tile_entities te
      left join public.location_public_actors lpa on lpa.location_id = te.location_id
     where te.location_id = v_ship.to_location_id and te.status = 'active'
       and te.profile_id is null and coalesce(te.owner_class, '') <> 'PLAYER'
       and coalesce(te.residential_capacity, 0) > (select count(*) from public.person_assignments a
                                                    where a.tile_entity_id = te.id and a.assignment_type = 'home' and a.is_active)
     order by te.id limit 1;
    if not found then v_outcome := 'no_home'; end if;

    -- Freie, bezahlte Stelle (Staat oder Figur), deren Arbeitgeber sieben Tage Lohn für alle
    -- seine Stellen (mit der neuen) zahlen kann. Die günstigste solche Stelle zuerst; ein
    -- klammer Arbeitgeber versperrt nicht mehr die Stellen der anderen.
    if v_outcome is null then
      select te.id, te.x_m, te.y_m, te.spatial_region_id, te.display_name, te.entity_id,
             e.emp as employer, r.role_code, w.daily_credits
        into v_job
        from public.tile_entities te
        left join public.location_public_actors lpa on lpa.location_id = te.location_id
        cross join lateral (select coalesce(te.actor_id, case when te.is_state_owned then lpa.actor_id end) as emp) e
        join public.building_staff_roles r on r.entity_id = te.entity_id
             and r.slot = 1 + (select count(*) from public.person_assignments a
                                where a.tile_entity_id = te.id and a.assignment_type = 'work' and a.is_active)
        join public.role_wage_rates w on w.role_code = r.role_code
       where te.location_id = v_ship.to_location_id and te.status = 'active'
         and te.profile_id is null and coalesce(te.owner_class, '') <> 'PLAYER'
         and coalesce(te.staff_capacity, 0) > (select count(*) from public.person_assignments a
                                                where a.tile_entity_id = te.id and a.assignment_type = 'work' and a.is_active)
         and e.emp is not null
       order by (select coalesce(sum(n.credit_delta), 0) from public.npc_ledger n where n.actor_id = e.emp)
                  >= 7 * (w.daily_credits + (select coalesce(sum(w2.daily_credits), 0)
                                               from public.person_assignments a2 join public.role_wage_rates w2 on w2.role_code = a2.role_code
                                              where a2.employer_actor_id = e.emp and a2.assignment_type = 'work' and a2.is_active)) desc,
                w.daily_credits, te.id
       limit 1;
      if not found then v_outcome := 'no_job'; end if;
    end if;

    -- Kann der Arbeitgeber sieben Tage Lohn für alle seine Stellen am Ort zahlen?
    if v_outcome is null then
      select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_job.employer;
      select coalesce(sum(w.daily_credits), 0) into v_payroll
        from public.person_assignments a join public.role_wage_rates w on w.role_code = a.role_code
       where a.employer_actor_id = v_job.employer and a.assignment_type = 'work' and a.is_active;
      if v_balance < 7 * (v_payroll + v_job.daily_credits) then v_outcome := 'no_money'; end if;
    end if;

    if v_outcome is not null then
      insert into public.colony_arrivals(shipment_id, location_id, tick, outcome) values (v_ship.id, v_ship.to_location_id, p_tick, v_outcome);
      continue;
    end if;

    -- Die Person kommt.
    v_key := 'colonist:' || v_ship.slug || ':' || v_ship.id::text;
    v_hash := md5(v_key);
    v_name := v_first[1 + (('x' || substr(v_hash, 1, 6))::bit(24)::int % array_length(v_first, 1))]
           || ' ' || v_last[1 + (('x' || substr(v_hash, 7, 6))::bit(24)::int % array_length(v_last, 1))];
    select count(*) into v_active from public.people where simulation_tier = 'active';
    insert into public.people(display_name, birth_year, current_location_id, simulation_tier, activity_state, last_action,
                              last_decision_factors, last_tick, person_key, bio_short, traits, observable_description)
    values (v_name, 2040 + (('x' || substr(v_hash, 13, 4))::bit(16)::int % 26), v_ship.to_location_id,
            case when v_active < 50 then 'active' else 'background' end, 'idle', 'arrived',
            jsonb_build_object('arrived_with_shipment', v_ship.id, 'work_tile_entity_id', v_job.id, 'role', v_job.role_code),
            p_tick, v_key,
            left('Kam mit dem Schiff von der Erde und arbeitet ' || coalesce('in ' || v_job.display_name, 'in der Siedlung') || '.', 200),
            jsonb_build_object('origin', 'colonist_from_earth'),
            'Neu in der Siedlung')
    returning id into v_person;
    insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
    values ('npc_person', v_name, 'Persönlicher Wirtschaftsakteur der Living Population.', '{}'::jsonb, '{}'::jsonb)
    returning id into v_actor;
    insert into public.person_economic_actors(person_id, actor_id) values (v_person, v_actor);
    insert into public.person_life_state(person_id, life_stage, age_ticks, family_desire, last_family_event_tick)
    values (v_person, 'adult', 0, 0.5, null) on conflict (person_id) do nothing;
    insert into public.person_needs(person_id, need_code, satisfaction, updated_tick)
    values (v_person,'sustenance',0.70,p_tick),(v_person,'rest',0.60,p_tick),(v_person,'safety',0.65,p_tick),
           (v_person,'social',0.55,p_tick),(v_person,'purpose',0.75,p_tick),(v_person,'variety',0.80,p_tick)
    on conflict (person_id, need_code) do nothing;
    insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
    values (v_actor, p_tick, 'endowment', null, 0, 500, v_ship.to_location_id, 'bootstrap:person:' || v_person::text,
            'Bootstrap-Startbestand: Ersparnisse einer Person, die mit der Fracht von der Erde zugezogen ist');
    -- Ticket für die Überfahrt: Transfer an den Frachtführer (NOXIA-FIN-0001), kein neues Geld.
    if v_carrier is not null then
      insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_actor, p_tick, 'expense', null, 0, -v_ticket, v_ship.to_location_id, 'ticket:' || v_ship.id::text,
              'Ticket für die Überfahrt von der Erde'),
             (v_carrier, p_tick, 'income', null, 0, v_ticket, v_ship.to_location_id, 'ticket:' || v_person::text,
              'Ticket einer zugezogenen Person (' || v_name || ')');
    end if;
    insert into public.person_surface_presence(person_id, location_id, source_kind, source_ref, x_m, y_m, spatial_region_id, confidence, updated_tick)
    values (v_person, v_ship.to_location_id, 'building_anchor', 'tile_entity:' || v_job.id::text, v_job.x_m, v_job.y_m, v_job.spatial_region_id, 0.9, p_tick)
    on conflict (person_id) do nothing;

    insert into public.person_assignments(person_id, assignment_type, location_id, tile_entity_id, role_code, starts_tick, ends_tick, is_active)
    values (v_person, 'home', v_ship.to_location_id, v_home.id, 'resident', p_tick, null, true)
    returning id into v_assignment;
    if v_home.landlord is not null then
      insert into public.person_tenancies(assignment_id, person_id, location_id, tile_entity_id, landlord_actor_id,
                                          rent_per_billing, billing_interval_ticks, next_due_tick, status, origin, tenure)
      values (v_assignment, v_person, v_ship.to_location_id, v_home.id, v_home.landlord, 200, 720, p_tick + 720, 'active', 'market', 'rented');
    end if;
    insert into public.person_assignments(person_id, assignment_type, location_id, tile_entity_id, employer_actor_id, role_code, starts_tick, ends_tick, is_active)
    values (v_person, 'work', v_ship.to_location_id, v_job.id, v_job.employer, v_job.role_code, p_tick, null, true);

    insert into public.colony_arrivals(shipment_id, location_id, tick, person_id, work_tile_id, home_tile_id, outcome)
    values (v_ship.id, v_ship.to_location_id, p_tick, v_person, v_job.id, v_home.id, 'arrived');
    v_arrived := v_arrived + 1;
  end loop;

  return jsonb_build_object('ok', true, 'tick', p_tick, 'checked', v_checked, 'arrived', v_arrived);
end;
$$;


revoke all on function public.run_colony_immigration(bigint) from public, anon, authenticated;
grant execute on function public.run_colony_immigration(bigint) to service_role;
