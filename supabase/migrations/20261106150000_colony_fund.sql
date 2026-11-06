-- 20261106150000_colony_fund.sql
-- Erstellt:     06.11.2026
-- Aktualisiert: 06.11.2026 — Anlaufhilfe für Mond, Mars und Phobos (NOXIA-FIN-0002 Teil C)
-- Version:      1.0.0
--
-- Entschieden (Thomas, 06.11.2026, „Ja mach das“): Anlaufhilfe, damit die Kolonien ihren
-- öffentlichen Dienst bezahlen können, bis die eigenen Einnahmen tragen.
--
-- Regel (run_colony_fund, einmal am Tag aufgerufen, zahlt höchstens einmal je Woche):
--   * Emittent: Koloniegründungsfonds der Solar Central Bank. Ausgewiesene Emission nach
--     NOXIA-FIN-0001, Beleg bootstrap:colony-fund:<ort>:<woche>.
--   * Bedarf der Woche: Tageslöhne aller aktiven Stellen der öffentlichen Kasse × 7.
--   * Eigene Einnahmen: alle Zugänge der öffentlichen Kasse in den letzten 168 Ticks,
--     ohne frühere Anlaufhilfe.
--   * Gezahlt wird die Lücke (Bedarf − Einnahmen), abnehmend: Woche 1–2 100 %, 3–4 75 %,
--     5–6 50 %, 7–8 25 %. Danach nichts mehr.
--   * Obergrenze je Ort (etwa das Fünffache der Wochenlücke): Mars 25 500, Mond 9 200,
--     Phobos 3 300 Cr. Die Erde ist nicht dabei (offen in NOXIA-FIN-0002 Frage 4).
--   * Jede Woche steht als Zeile in colony_fund_payments, auch wenn 0 gezahlt wird.

set search_path to public;

create table if not exists public.colony_fund (
  location_id  uuid primary key references public.locations(id),
  start_tick   bigint not null,
  weeks        integer not null default 8 check (weeks > 0),
  cap_credits  numeric not null check (cap_credits >= 0),
  active       boolean not null default true
);
alter table public.colony_fund enable row level security;
revoke all on public.colony_fund from anon, authenticated;
grant select, insert, update, delete on public.colony_fund to service_role;

create table if not exists public.colony_fund_payments (
  location_id  uuid not null references public.locations(id),
  week         integer not null,
  tick         bigint not null,
  need         numeric not null,
  revenue      numeric not null,
  rate         numeric not null,
  paid         numeric not null,
  created_at   timestamptz not null default now(),
  primary key (location_id, week)
);
alter table public.colony_fund_payments enable row level security;
revoke all on public.colony_fund_payments from anon, authenticated;
grant select, insert, update, delete on public.colony_fund_payments to service_role;

insert into public.colony_fund (location_id, start_tick, cap_credits)
select l.id, (select coalesce(max(tick_number), 0) from public.tick_log), c.cap
  from (values ('mars', 25500), ('moon', 9200), ('phobos', 3300)) as c(slug, cap)
  join public.locations l on l.slug = c.slug
on conflict (location_id) do nothing;

create or replace function public.colony_fund_rate(p_week integer) returns numeric
language sql immutable as $$
  select case when p_week between 1 and 2 then 1.0
              when p_week between 3 and 4 then 0.75
              when p_week between 5 and 6 then 0.5
              when p_week between 7 and 8 then 0.25
              else 0 end
$$;

create or replace function public.run_colony_fund(p_tick bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_f record;
  v_week integer;
  v_need numeric;
  v_revenue numeric;
  v_rate numeric;
  v_paid_before numeric;
  v_pay numeric;
  v_total numeric := 0;
  v_rows integer := 0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_FUND_TICK_INVALID'; end if;
  for v_f in
    select f.*, l.slug, lpa.actor_id
      from public.colony_fund f
      join public.locations l on l.id = f.location_id
      join public.location_public_actors lpa on lpa.location_id = f.location_id
     where f.active and p_tick >= f.start_tick
  loop
    v_week := ((p_tick - v_f.start_tick) / 168)::integer + 1;
    if v_week > v_f.weeks then continue; end if;
    if exists (select 1 from public.colony_fund_payments p where p.location_id = v_f.location_id and p.week = v_week) then continue; end if;

    select coalesce(sum(w.daily_credits), 0) * 7 into v_need
      from public.person_assignments a join public.role_wage_rates w on w.role_code = a.role_code
     where a.employer_actor_id = v_f.actor_id and a.assignment_type = 'work' and a.is_active;
    select coalesce(sum(n.credit_delta), 0) into v_revenue
      from public.npc_ledger n
     where n.actor_id = v_f.actor_id and n.credit_delta > 0 and n.tick > p_tick - 168 and n.tick <= p_tick
       and coalesce(n.ref, '') not like 'bootstrap:colony-fund:%';
    select coalesce(sum(paid), 0) into v_paid_before from public.colony_fund_payments where location_id = v_f.location_id;

    v_rate := public.colony_fund_rate(v_week);
    v_pay := least(greatest(0, round((v_need - v_revenue) * v_rate)), greatest(0, v_f.cap_credits - v_paid_before));

    insert into public.colony_fund_payments (location_id, week, tick, need, revenue, rate, paid)
    values (v_f.location_id, v_week, p_tick, v_need, v_revenue, v_rate, v_pay);
    if v_pay > 0 then
      insert into public.npc_ledger (actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_f.actor_id, p_tick, 'endowment', null, 0, v_pay, v_f.location_id,
              'bootstrap:colony-fund:' || v_f.slug || ':' || v_week,
              'Anlaufhilfe des Koloniegründungsfonds (Solar Central Bank), Woche ' || v_week || ' von ' || v_f.weeks
              || ': Lücke ' || greatest(0, v_need - v_revenue) || ' Cr × ' || (v_rate * 100)::integer || ' %');
      v_total := v_total + v_pay;
    end if;
    v_rows := v_rows + 1;
  end loop;
  return jsonb_build_object('ok', true, 'tick', p_tick, 'weeks_booked', v_rows, 'paid', v_total);
end;
$$;
revoke all on function public.run_colony_fund(bigint) from public, anon, authenticated;
grant execute on function public.run_colony_fund(bigint) to service_role;
