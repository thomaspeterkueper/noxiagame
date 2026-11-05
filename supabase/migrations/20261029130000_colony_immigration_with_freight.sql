-- Zuzug in die Kolonien: Wer Arbeit und eine Wohnung findet, kommt mit der Fracht.
-- Entschieden (Thomas, 29.10.2026): Spielerwunsch „mehr Menschen“ umsetzen
-- (player_feature_wish_reviews 'mehr-leute'): Zuzug aus der Simulation, nicht auf Zuruf.
-- Ein Spieler auf dem Mond: „Hier ist zu wenig Leute. Wir müssen mehr machen.“
--
-- Regel (run_colony_immigration, jeden Tick):
--   * Kommt eine Fracht von der Erde an einem anderen Ort an (npc_shipments.arrive_tick),
--     kann eine Person mitkommen – höchstens eine je Fracht.
--   * Sie kommt nur, wenn es am Ort beides gibt:
--       - eine freie Wohnung in einem Haus des Staates oder einer Figur;
--       - eine freie, bezahlte Stelle in einem Haus des Staates oder einer Figur, dessen
--         Arbeitgeber sieben Tage Lohn für alle seine Stellen dort decken kann.
--   * Häuser von Spielern stellen nicht von selbst ein – das entscheidet der Spieler.
--   * Jede Fracht wird einmal geprüft (colony_arrivals), auch wenn niemand kommt; der Grund
--     steht dabei (no_home, no_job, no_money), damit man sieht, was fehlt.
--   * Startbestand der Person: 500 Cr Ersparnisse, ausgewiesen als
--     bootstrap:person:<id> (Emission nach NOXIA-FIN-0001, wie beim Personal der Erde).
--     Miete 200 Cr je 30 Tage an den Hausbesitzer.
-- Stellen in den Kolonien: Kantine, Werkstatt, Lebenserhaltung, Roverhof, Funk, Lager, Verwaltung
-- je eine (building_staff_roles), nur in staatlichen Häusern außerhalb der Erde.

set search_path to public;

insert into public.building_staff_roles (entity_id, slot, role_code, label) values
  ('port_canteen', 1, 'service', 'Kantine'),
  ('surface_workshop', 1, 'technician', 'Werkstatt'),
  ('life_support_hub', 1, 'systems_technician', 'Lebenserhaltung'),
  ('rover_yard', 1, 'operator', 'Roverhof'),
  ('surface_comms', 1, 'sensor_operator', 'Funk'),
  ('warehouse', 1, 'logistics', 'Lager'),
  ('admin', 1, 'administrator', 'Verwaltung')
on conflict (entity_id, slot) do nothing;

update public.tile_entities te
   set staff_capacity = 1
  from public.locations l
 where l.id = te.location_id and l.slug <> 'earth'
   and te.status = 'active' and te.is_state_owned
   and te.entity_id in ('port_canteen', 'surface_workshop', 'life_support_hub', 'rover_yard', 'surface_comms', 'warehouse', 'admin')
   and coalesce(te.staff_capacity, 0) = 0;

create table if not exists public.colony_arrivals (
  shipment_id    uuid primary key references public.npc_shipments(id),
  location_id    uuid not null references public.locations(id),
  tick           bigint not null,
  person_id      uuid references public.people(id) on delete set null,
  work_tile_id   uuid references public.tile_entities(id) on delete set null,
  home_tile_id   uuid references public.tile_entities(id) on delete set null,
  outcome        text not null check (outcome in ('arrived', 'no_home', 'no_job', 'no_money')),
  created_at     timestamptz not null default now()
);
alter table public.colony_arrivals enable row level security;
revoke all on public.colony_arrivals from anon, authenticated;
grant select, insert, update, delete on public.colony_arrivals to service_role;

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

    -- Freie, bezahlte Stelle (Staat oder Figur).
    if v_outcome is null then
      select te.id, te.x_m, te.y_m, te.spatial_region_id, te.display_name, te.entity_id,
             coalesce(te.actor_id, case when te.is_state_owned then lpa.actor_id end) as employer,
             r.role_code, w.daily_credits
        into v_job
        from public.tile_entities te
        left join public.location_public_actors lpa on lpa.location_id = te.location_id
        join public.building_staff_roles r on r.entity_id = te.entity_id
             and r.slot = 1 + (select count(*) from public.person_assignments a
                                where a.tile_entity_id = te.id and a.assignment_type = 'work' and a.is_active)
        join public.role_wage_rates w on w.role_code = r.role_code
       where te.location_id = v_ship.to_location_id and te.status = 'active'
         and te.profile_id is null and coalesce(te.owner_class, '') <> 'PLAYER'
         and coalesce(te.staff_capacity, 0) > (select count(*) from public.person_assignments a
                                                where a.tile_entity_id = te.id and a.assignment_type = 'work' and a.is_active)
         and coalesce(te.actor_id, case when te.is_state_owned then lpa.actor_id end) is not null
       order by w.daily_credits, te.id limit 1;
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
            left('Kam mit der Fracht von der Erde und arbeitet ' || coalesce('in ' || v_job.display_name, 'in der Siedlung') || '.', 200),
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

-- Auswertung: Wer kam, und woran es lag, wenn niemand kam.
create or replace view public.colony_arrivals_summary as
select l.slug, a.outcome, count(*) as shipments, max(a.tick) as last_tick,
       array_agg(p.display_name) filter (where p.id is not null) as people
  from public.colony_arrivals a
  join public.locations l on l.id = a.location_id
  left join public.people p on p.id = a.person_id
 group by l.slug, a.outcome;
revoke all on public.colony_arrivals_summary from anon, authenticated;
grant select on public.colony_arrivals_summary to service_role;
