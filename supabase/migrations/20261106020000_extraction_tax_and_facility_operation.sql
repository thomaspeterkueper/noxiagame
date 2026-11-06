-- NOXIA-FIN-0002 Teil A1 und B: Förderabgabe je Ort, Bedienung von Förderanlagen.
-- Entschieden (Thomas, 06.11.2026):
--   Frage 1: „das sollte ein flexibler Wert sein, vielleicht entscheiden manche Orte später anders.“
--   Frage 3: „ja so soll es sein, wobei man statt Menschen auch Roboter kaufen kann, jeder muss
--            selbst entscheiden, was sich mehr lohnt.“
--
-- A1 Förderabgabe
--   * colony_settings.extraction_tax_rate je Ort, Start 15 %. Der Ort (Gouverneur) kann ihn ändern.
--   * Gebucht im Firmen-Tick zusammen mit dem Erlös der Anlage (lib/game/tick.ts, runNpcTick):
--     Firma 'expense' −, öffentliche Kasse des Ortes 'income' +, Beleg foerderabgabe:<ort>:<anlage>.
--     Ein Transfer nach NOXIA-FIN-0001, kein neues Geld.
--
-- B Bedienung
--   * Eisbohrer, Wasserrecycler und Gruben brauchen Bedienung: ein Mensch oder ein Roboter
--     je 4 Eisbohrer, je Recycler, je Grube. Ohne Bedienung steht die Anlage.
--     Gilt ab Tick 2968 (eine Woche Vorlauf ab 06.11.2026) für Anlagen von Firmen;
--     Anlagen von Spielern folgen, sobald sie die Wahl im Spiel treffen können.
--   * Menschen: Stellen an den Anlagen (building_staff_roles, staff_capacity). Sie werden
--     mit Leuten am Ort besetzt oder über den Zuzug mit der Fracht.
--   * Roboter: Kauf 4 000 Cr, Wartung 25 Cr je Tag, beides an die öffentliche Kasse des Ortes
--     (die Werkstatt der Siedlung baut und wartet sie). Transfers, kein neues Geld.
--   * Wer entscheidet: der Eigentümer. Firmen rechnen über 60 Tage: Mensch (Lohn) gegen
--     Roboter (Kauf + Wartung). Bei 75 Cr Lohn ist der Mensch billiger (4 500 gegen 5 500 Cr);
--     findet sich aber 7 Tage lang niemand, kauft die Firma einen Roboter, wenn ihre Kasse
--     zwei Kaufpreise und eine Woche Lohn deckt. Regeln: lib/game/economy/facilityOperation.ts.
--   * Datenkorrektur: Anlagen von Firmen waren teils als Spielereigentum geführt (owner_class).

set search_path to public;

-- A1 ─────────────────────────────────────────────────────────────────────────
alter table public.colony_settings
  add column if not exists extraction_tax_rate numeric(8,4) not null default 0.15
  check (extraction_tax_rate >= 0 and extraction_tax_rate <= 1);
comment on column public.colony_settings.extraction_tax_rate is
  'Förderabgabe: Anteil des Erlöses aus Anlagen am Ort, der an die öffentliche Kasse des Ortes geht (NOXIA-FIN-0002 A1). Je Ort änderbar.';

-- B: Datenkorrektur ──────────────────────────────────────────────────────────
update public.tile_entities te
   set owner_class = 'NPC'
  from public.actors a
 where a.id = te.actor_id and a.kind = 'npc_firm'
   and te.profile_id is null and te.owner_class = 'PLAYER';

-- B: Stellen an Anlagen ──────────────────────────────────────────────────────
insert into public.building_staff_roles (entity_id, slot, role_code, label) values
  ('ice_drill', 1, 'technician', 'Bohrbetrieb'),
  ('water_recycler', 1, 'systems_technician', 'Aufbereitung'),
  ('mine', 1, 'technician', 'Grube')
on conflict (entity_id, slot) do nothing;

-- Eine Stelle je 4 Eisbohrer (jeder vierte Bohrer eines Eigentümers am Ort trägt sie),
-- je Recycler und je Grube eine.
with ranked as (
  select te.id, te.entity_id,
         row_number() over (partition by te.actor_id, te.location_id, te.entity_id order by te.id) as rn
    from public.tile_entities te
    join public.actors a on a.id = te.actor_id and a.kind = 'npc_firm'
   where te.status = 'active' and te.entity_id in ('ice_drill', 'water_recycler', 'mine')
)
update public.tile_entities te
   set staff_capacity = 1
  from ranked r
 where r.id = te.id and coalesce(te.staff_capacity, 0) = 0
   and (r.entity_id <> 'ice_drill' or (r.rn - 1) % 4 = 0);

-- B: Roboter ─────────────────────────────────────────────────────────────────
create table if not exists public.facility_robots (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid not null references public.actors(id),
  location_id     uuid not null references public.locations(id),
  facility_kind   text not null check (facility_kind in ('ice_drill', 'water_recycler', 'mine')),
  price           integer not null,
  upkeep_per_day  integer not null,
  bought_tick     bigint not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists facility_robots_owner_idx on public.facility_robots(actor_id, location_id, facility_kind) where active;

create table if not exists public.facility_operation_gaps (
  actor_id       uuid not null references public.actors(id),
  location_id    uuid not null references public.locations(id),
  facility_kind  text not null,
  missing_since  bigint not null,
  primary key (actor_id, location_id, facility_kind)
);

alter table public.facility_robots enable row level security;
alter table public.facility_operation_gaps enable row level security;
revoke all on public.facility_robots, public.facility_operation_gaps from anon, authenticated;
grant select, insert, update, delete on public.facility_robots, public.facility_operation_gaps to service_role;

-- Täglich: Wartung zahlen, fehlende Bedienung suchen (Menschen am Ort, sonst nach 7 Tagen Roboter).
create or replace function public.run_facility_operation(p_tick bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_price constant integer := 4000;
  c_upkeep constant integer := 25;
  c_wait constant integer := 168;
  v_group record;
  v_robot record;
  v_pub uuid;
  v_need integer;
  v_have integer;
  v_balance numeric;
  v_payroll numeric;
  v_person uuid;
  v_tile uuid;
  v_role text;
  v_since bigint;
  v_upkeep_paid integer := 0;
  v_hired integer := 0;
  v_bought integer := 0;
  v_waiting integer := 0;
begin
  if p_tick is null or p_tick % 24 <> 0 then return jsonb_build_object('ok', true, 'skipped', true); end if;

  -- Wartung
  for v_robot in select * from public.facility_robots where active loop
    select actor_id into v_pub from public.location_public_actors where location_id = v_robot.location_id;
    if v_pub is null then continue; end if;
    select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_robot.actor_id;
    if v_balance < v_robot.upkeep_per_day then continue; end if;
    insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
    values (v_robot.actor_id, p_tick, 'expense', null, 0, -v_robot.upkeep_per_day, v_robot.location_id,
            'robot_upkeep:' || v_robot.id::text || ':' || p_tick::text, 'Wartung Bedienroboter')
    on conflict do nothing;
    if found then
      insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_pub, p_tick, 'income', null, 0, v_robot.upkeep_per_day, v_robot.location_id,
              'robot_upkeep:' || v_robot.id::text || ':' || p_tick::text, 'Wartung Bedienroboter (Werkstatt)')
      on conflict do nothing;
      v_upkeep_paid := v_upkeep_paid + 1;
    end if;
  end loop;

  -- Bedienung je Eigentümer, Ort und Anlagenart
  for v_group in
    select te.actor_id, te.location_id, te.entity_id as kind, count(*) as n
      from public.tile_entities te
      join public.actors a on a.id = te.actor_id and a.kind = 'npc_firm'
     where te.status = 'active' and te.entity_id in ('ice_drill', 'water_recycler', 'mine')
     group by 1, 2, 3
  loop
    v_need := case when v_group.kind = 'ice_drill' then ceil(v_group.n / 4.0)::integer else v_group.n::integer end;
    select count(*) into v_have
      from public.person_assignments pa
      join public.tile_entities te on te.id = pa.tile_entity_id
     where pa.assignment_type = 'work' and pa.is_active
       and te.actor_id = v_group.actor_id and te.location_id = v_group.location_id and te.entity_id = v_group.kind;
    v_have := v_have + (select count(*) from public.facility_robots r
                         where r.active and r.actor_id = v_group.actor_id and r.location_id = v_group.location_id and r.facility_kind = v_group.kind);
    if v_have >= v_need then
      delete from public.facility_operation_gaps where actor_id = v_group.actor_id and location_id = v_group.location_id and facility_kind = v_group.kind;
      continue;
    end if;

    -- 1) Menschen am Ort ohne Arbeit
    select p.id into v_person
      from public.people p
     where p.current_location_id = v_group.location_id
       and coalesce(p.activity_state, '') not in ('deceased', 'away')
       and not exists (select 1 from public.person_assignments a where a.person_id = p.id and a.is_active and a.assignment_type = 'work')
       and exists (select 1 from public.person_life_state ls where ls.person_id = p.id and ls.life_stage = 'adult')
     order by p.id limit 1;
    if v_person is not null then
      select te.id, r.role_code into v_tile, v_role
        from public.tile_entities te
        join public.building_staff_roles r on r.entity_id = te.entity_id and r.slot = 1
       where te.actor_id = v_group.actor_id and te.location_id = v_group.location_id and te.entity_id = v_group.kind
         and coalesce(te.staff_capacity, 0) > (select count(*) from public.person_assignments a where a.tile_entity_id = te.id and a.is_active and a.assignment_type = 'work')
       order by te.id limit 1;
      if v_tile is not null then
        insert into public.person_assignments(person_id, assignment_type, location_id, tile_entity_id, employer_actor_id, role_code, starts_tick, ends_tick, is_active)
        values (v_person, 'work', v_group.location_id, v_tile, v_group.actor_id, v_role, p_tick, null, true);
        v_hired := v_hired + 1;
        continue;
      end if;
    end if;

    -- 2) Warten, dann Roboter
    insert into public.facility_operation_gaps(actor_id, location_id, facility_kind, missing_since)
    values (v_group.actor_id, v_group.location_id, v_group.kind, p_tick)
    on conflict (actor_id, location_id, facility_kind) do nothing;
    select missing_since into v_since from public.facility_operation_gaps
     where actor_id = v_group.actor_id and location_id = v_group.location_id and facility_kind = v_group.kind;
    if p_tick - v_since < c_wait then v_waiting := v_waiting + 1; continue; end if;

    select actor_id into v_pub from public.location_public_actors where location_id = v_group.location_id;
    if v_pub is null then continue; end if;
    select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_group.actor_id;
    select coalesce(sum(w.daily_credits), 0) into v_payroll
      from public.person_assignments a join public.role_wage_rates w on w.role_code = a.role_code
     where a.employer_actor_id = v_group.actor_id and a.is_active and a.assignment_type = 'work';
    if v_balance < 2 * c_price + 7 * v_payroll then v_waiting := v_waiting + 1; continue; end if;

    -- Ein Roboter je Tag und Gruppe
    insert into public.facility_robots(actor_id, location_id, facility_kind, price, upkeep_per_day, bought_tick)
    values (v_group.actor_id, v_group.location_id, v_group.kind, c_price, c_upkeep, p_tick)
    returning id, actor_id, location_id into v_robot;
    insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
    values (v_group.actor_id, p_tick, 'expense', null, 0, -c_price, v_group.location_id, 'robot_purchase:' || v_robot.id::text, 'Kauf Bedienroboter'),
           (v_pub, p_tick, 'income', null, 0, c_price, v_group.location_id, 'robot_purchase:' || v_robot.id::text, 'Verkauf Bedienroboter (Werkstatt)');
    v_bought := v_bought + 1;
  end loop;

  return jsonb_build_object('ok', true, 'tick', p_tick, 'upkeep', v_upkeep_paid, 'hired', v_hired, 'robots_bought', v_bought, 'waiting', v_waiting);
end;
$$;

revoke all on function public.run_facility_operation(bigint) from public, anon, authenticated;
grant execute on function public.run_facility_operation(bigint) to service_role;

-- Auswertung: Bedienung je Eigentümer, Ort und Anlage.
create or replace view public.facility_operation_status as
select a.display_name as owner, l.slug, te.entity_id as kind, count(*) as facilities,
       case when te.entity_id = 'ice_drill' then ceil(count(*) / 4.0)::integer else count(*)::integer end as needed,
       (select count(*) from public.person_assignments pa join public.tile_entities t2 on t2.id = pa.tile_entity_id
         where pa.is_active and pa.assignment_type = 'work' and t2.actor_id = te.actor_id and t2.location_id = te.location_id and t2.entity_id = te.entity_id) as staff,
       (select count(*) from public.facility_robots r where r.active and r.actor_id = te.actor_id and r.location_id = te.location_id and r.facility_kind = te.entity_id) as robots
  from public.tile_entities te
  join public.actors a on a.id = te.actor_id and a.kind = 'npc_firm'
  join public.locations l on l.id = te.location_id
 where te.status = 'active' and te.entity_id in ('ice_drill', 'water_recycler', 'mine')
 group by a.display_name, l.slug, te.entity_id, te.actor_id, te.location_id;
revoke all on public.facility_operation_status from anon, authenticated;
grant select on public.facility_operation_status to service_role;
