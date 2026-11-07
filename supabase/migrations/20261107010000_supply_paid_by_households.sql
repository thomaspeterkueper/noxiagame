-- 20261107010000_supply_paid_by_households.sql
-- Erstellt:     07.11.2026
-- Aktualisiert: 07.11.2026 — Versorgung bezahlen: wer ein Konto hat, zahlt seinen Anteil; der Rest ist ausgewiesene Emission
-- Version:      1.0.0
--
-- Entschieden (Thomas, 06.11.2026, NOXIA-FIN-0002 Teil D: „Teilen nach Konto“):
-- Bisher bekamen Firmen Geld für Ware, die ins Lager eines Ortes ging (Boann: Wasser am Mars,
-- HeliosCorp: Verkäufe an den Ort), ohne dass jemand zahlte. Das war Geld ohne Beleg
-- (gegen NOXIA-FIN-0001). Thomas: „Wenn kein Käufer für Wasser da ist, kauft niemand und es
-- gibt kein Geld.“
--
-- Regel (run_supply_settlement, einmal am Tag):
--   * Offen ist, was Firmen (actors.kind = 'npc_firm') seit der letzten Abrechnung am Ort mit
--     'produce' oder 'sell' gutgeschrieben bekamen.
--   * Die Einwohner zahlen das nach Köpfen. Anteil je Kopf = offen / Einwohnerzahl.
--   * Wer ein Konto hat (Figur mit person_economic_actors am Ort), zahlt seinen Anteil selbst,
--     höchstens sein Guthaben. Das ist ein Transfer.
--   * Den Anteil der Einwohner ohne Konto zahlt die Versorgungskasse des Ortes aus
--     ausgewiesener Emission, Beleg bootstrap:supply-households:<ort>:<tick>.
--   * Obergrenze der Emission: was die Einwohner ohne Konto in dieser Zeit wirklich verbrauchen
--     (Verbrauch je Stunde × Stunden × Verkaufspreis × Anteil ohne Konto). Was darüber liegt,
--     bezahlt niemand: Die Firmen geben es zurück (Beleg supply-unpaid:<ort>:<tick>).
--   * Die Versorgungskasse ist eine Verrechnungsstelle; ihr Saldo bleibt 0.
--   * Spieler zahlen noch nicht mit (ihr Geld liegt in profiles.credits, offen).
--   * Gutschriften vor dieser Migration bleiben, wie sie sind.

set search_path to public;

create table if not exists public.supply_household_actors (
  location_id uuid primary key references public.locations(id),
  actor_id    uuid not null unique references public.actors(id)
);
alter table public.supply_household_actors enable row level security;
revoke all on public.supply_household_actors from anon, authenticated;
grant select, insert, update, delete on public.supply_household_actors to service_role;

create table if not exists public.supply_settlements (
  location_id      uuid not null references public.locations(id),
  tick             bigint not null,
  from_tick        bigint not null,
  unpaid           numeric not null,
  population       integer not null,
  accounts         integer not null,
  share_per_head   numeric not null,
  paid_by_accounts numeric not null,
  emission_cap     numeric not null,
  emitted          numeric not null,
  returned         numeric not null,
  created_at       timestamptz not null default now(),
  primary key (location_id, tick)
);
alter table public.supply_settlements enable row level security;
revoke all on public.supply_settlements from anon, authenticated;
grant select, insert, update, delete on public.supply_settlements to service_role;

create or replace function public.noxia_supply_household_actor(p_location uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  select actor_id into v_id from public.supply_household_actors where location_id = p_location;
  if v_id is not null then return v_id; end if;
  select coalesce(name, slug) into v_name from public.locations where id = p_location;
  insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
  values ('institution', 'Versorgungskasse ' || v_name,
          'Verrechnet die Versorgung der Einwohner ohne eigenes Konto (NOXIA-FIN-0002 Teil D).',
          '{}'::jsonb, jsonb_build_object('role', 'supply_households'))
  returning id into v_id;
  insert into public.supply_household_actors(location_id, actor_id) values (p_location, v_id);
  return v_id;
end;
$$;
revoke all on function public.noxia_supply_household_actor(uuid) from public, anon, authenticated;
grant execute on function public.noxia_supply_household_actor(uuid) to service_role;

create or replace function public.run_supply_settlement(p_tick bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_loc record;
  v_from bigint;
  v_unpaid numeric;
  v_pop integer;
  v_accounts integer;
  v_share numeric;
  v_paid numeric;
  v_cap numeric;
  v_emit numeric;
  v_return numeric;
  v_kasse uuid;
  v_ref text;
  v_p record;
  v_f record;
  v_left numeric;
  v_amount numeric;
  v_n integer := 0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_SUPPLY_TICK_INVALID'; end if;

  for v_loc in select id, slug, coalesce(population, 0) as population from public.locations loop
    if exists (select 1 from public.supply_settlements s where s.location_id = v_loc.id and s.tick = p_tick) then continue; end if;
    select coalesce(max(tick), p_tick - 24) into v_from from public.supply_settlements where location_id = v_loc.id;

    select coalesce(sum(n.credit_delta), 0) into v_unpaid
      from public.npc_ledger n join public.actors a on a.id = n.actor_id and a.kind = 'npc_firm'
     where n.location_id = v_loc.id and n.kind in ('produce', 'sell') and n.credit_delta > 0
       and n.tick > v_from and n.tick <= p_tick;
    if v_unpaid <= 0 then continue; end if;

    select count(*) into v_accounts
      from public.people p join public.person_economic_actors pea on pea.person_id = p.id
     where p.current_location_id = v_loc.id;
    v_pop := greatest(v_loc.population, v_accounts, 1);
    v_share := round(v_unpaid / v_pop);
    v_ref := v_loc.slug || ':' || p_tick;
    v_kasse := public.noxia_supply_household_actor(v_loc.id);

    -- Wer ein Konto hat, zahlt seinen Anteil (höchstens sein Guthaben).
    v_paid := 0;
    if v_share > 0 then
      for v_p in
        select pea.actor_id, greatest(0, coalesce((select sum(credit_delta) from public.npc_ledger l where l.actor_id = pea.actor_id), 0)) as bal
          from public.people p join public.person_economic_actors pea on pea.person_id = p.id
         where p.current_location_id = v_loc.id
      loop
        v_amount := least(v_share, floor(v_p.bal));
        if v_amount <= 0 then continue; end if;
        insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
        values (v_p.actor_id, p_tick, 'expense', null, 0, -v_amount, v_loc.id, 'supply:' || v_ref, 'Anteil an der Versorgung des Ortes (Wasser und andere Grundversorgung)')
        on conflict do nothing;
        v_paid := v_paid + v_amount;
      end loop;
    end if;

    -- Obergrenze: Verbrauch der Einwohner ohne Konto in diesem Zeitraum, zum Verkaufspreis.
    select coalesce(sum(lr.consumption * (p_tick - v_from) * coalesce(mp.sell_price, 0)), 0) * greatest(0, v_pop - v_accounts) / v_pop
      into v_cap
      from public.location_resources lr
      left join public.market_prices mp on mp.location_id = lr.location_id and mp.resource = lr.resource
     where lr.location_id = v_loc.id
       and lr.resource::text in (select distinct n.resource from public.npc_ledger n join public.actors a on a.id = n.actor_id and a.kind = 'npc_firm'
                                  where n.location_id = v_loc.id and n.kind in ('produce', 'sell') and n.credit_delta > 0
                                    and n.tick > v_from and n.tick <= p_tick);
    v_cap := floor(v_cap);
    v_emit := least(greatest(0, v_unpaid - v_paid), v_cap);
    v_return := greatest(0, v_unpaid - v_paid - v_emit);

    if v_paid > 0 then
      insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_kasse, p_tick, 'income', null, 0, v_paid, v_loc.id, 'supply:' || v_ref, 'Anteile der Einwohner mit Konto');
    end if;
    if v_emit > 0 then
      insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_kasse, p_tick, 'endowment', null, 0, v_emit, v_loc.id, 'bootstrap:supply-households:' || v_ref,
              'Ausgewiesene Emission: Versorgung der Einwohner ohne eigenes Konto (' || (v_pop - v_accounts) || ' von ' || v_pop || ')');
    end if;
    if v_paid + v_emit > 0 then
      insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_kasse, p_tick, 'expense', null, 0, -(v_paid + v_emit), v_loc.id, 'supply-paid:' || v_ref,
              'Bezahlt an die Erzeuger und Händler, die ins Lager geliefert haben');
    end if;

    -- Was niemand bezahlt, geben die Firmen anteilig zurück.
    if v_return > 0 then
      v_left := v_return;
      for v_f in
        select n.actor_id, sum(n.credit_delta) as got
          from public.npc_ledger n join public.actors a on a.id = n.actor_id and a.kind = 'npc_firm'
         where n.location_id = v_loc.id and n.kind in ('produce', 'sell') and n.credit_delta > 0
           and n.tick > v_from and n.tick <= p_tick
         group by n.actor_id order by sum(n.credit_delta) desc
      loop
        v_amount := least(v_left, ceil(v_return * v_f.got / v_unpaid));
        if v_amount <= 0 then continue; end if;
        insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
        values (v_f.actor_id, p_tick, 'expense', null, 0, -v_amount, v_loc.id, 'supply-unpaid:' || v_ref,
                'Lieferung ins Lager, für die es keinen Käufer gab – kein Erlös');
        v_left := v_left - v_amount;
      end loop;
    end if;

    insert into public.supply_settlements(location_id, tick, from_tick, unpaid, population, accounts, share_per_head,
                                          paid_by_accounts, emission_cap, emitted, returned)
    values (v_loc.id, p_tick, v_from, v_unpaid, v_pop, v_accounts, v_share, v_paid, v_cap, v_emit, v_return);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'tick', p_tick, 'locations', v_n);
end;
$$;
revoke all on function public.run_supply_settlement(bigint) from public, anon, authenticated;
grant execute on function public.run_supply_settlement(bigint) to service_role;
