-- Mitflug auf Handelsschiffen: anheuern, mitfliegen, Heuer bei Ankunft.
-- Entschieden (Thomas, 29.10.2026): Spielerwunsch „Raumhafen“ umsetzen (Prüfung in
-- player_feature_wish_reviews, docs/reviews/spielerwuensche.md); Weg aus R-21 Punkt 4 und
-- R-10: eine Stelle an Bord als Weg zum Herumkommen.
--
-- So geht es:
--   * Am Raumhafen heuert der Spieler beim Frachtführer (Epona Fracht) für ein Ziel an,
--     das dieser von hier aus bedient (bisherige Frachten in npc_shipments).
--   * Er kommt auf die Heuerliste (status 'waiting'). Läuft die nächste Fracht von hier zu
--     diesem Ziel aus (npc_shipments.depart_tick ≥ Anheuern, höchstens eine Stunde her),
--     geht er an Bord (status 'aboard'): Reise über die bestehenden profiles.transit_*,
--     Ankunft zur Ankunftsstunde der Fracht. Alle Prüfungen „schon unterwegs“ gelten weiter.
--   * Bei der Ankunft (noxia_complete_passenger_transit) zahlt der Frachtführer die Heuer
--     aus seinem Konto im npc_ledger: Transfer nach NOXIA-FIN-0001, kein neues Geld.
--     Heuer: Lohnschlüssel logistics (65 Cr/Tag) je Reisestunde, mindestens 10 Cr. Reicht
--     sein Konto nicht, gibt es, was da ist; der Rest steht als offen in der Zeile.
--   * Wer ein eigenes Schiff hat, fliegt selbst (wie beim Linienflug).
-- An Bord wird eingeteilt, wenn eine Fracht ausläuft: im Tick (lib/game/tick.ts) und beim
-- Anheuern.

set search_path to public;

create table if not exists public.crew_signons (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  operator_actor_id uuid not null references public.actors(id),
  from_location    text not null,
  destination      text not null,
  status           text not null default 'waiting' check (status in ('waiting', 'aboard', 'arrived', 'cancelled')),
  signed_tick      bigint not null,
  shipment_id      uuid references public.npc_shipments(id),
  depart_tick      bigint,
  arrive_tick      bigint,
  wage_credits     integer,
  paid_credits     integer,
  created_at       timestamptz not null default now(),
  boarded_at       timestamptz,
  arrived_at       timestamptz,
  cancelled_at     timestamptz
);
create unique index if not exists crew_signons_one_open_idx on public.crew_signons(profile_id) where status in ('waiting', 'aboard');
create index if not exists crew_signons_waiting_idx on public.crew_signons(from_location, destination) where status = 'waiting';

alter table public.crew_signons enable row level security;
revoke all on public.crew_signons from anon, authenticated;
grant select, insert, update, delete on public.crew_signons to service_role;

-- Echte Zeit zu einem Tick (wie lib/game/gameClock.ts: Tick 2598 = 28.10.2026 19:00 UTC).
create or replace function public.noxia_tick_time(p_tick bigint) returns timestamptz
language sql immutable as $$
  select timestamptz '2026-10-28 19:00:00+00' + make_interval(hours => (p_tick - 2598)::integer)
$$;

create or replace function public.noxia_carrier_actor() returns uuid
language sql stable as $$
  select id from public.actors where decision_weights->>'role' = 'carrier' order by created_at limit 1
$$;

-- Ziele, die der Frachtführer von einem Ort aus bedient, mit letzter Abfahrt und Dauer.
create or replace function public.noxia_crew_routes(p_from text)
returns table(destination text, departures integer, last_depart_tick bigint, avg_hours numeric, wage_credits integer)
language sql stable security definer set search_path = public as $$
  select lt.slug, count(*)::integer, max(s.depart_tick),
         round(avg(s.arrive_tick - s.depart_tick), 1),
         greatest(10, round(avg(s.arrive_tick - s.depart_tick) * (select daily_credits from public.role_wage_rates where role_code = 'logistics') / 24.0))::integer
    from public.npc_shipments s
    join public.locations lf on lf.id = s.from_location_id and lf.slug = p_from
    join public.locations lt on lt.id = s.to_location_id
   group by lt.slug
$$;

-- Wartende an Bord bringen, deren Fracht gerade ausläuft. Gibt die Zahl der Eingeschifften zurück.
create or replace function public.noxia_crew_board_due(p_tick bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_row record;
  v_ship record;
  v_profile public.profiles%rowtype;
  v_hours integer;
  v_wage integer;
  v_arrives timestamptz;
  v_n integer := 0;
begin
  for v_row in select * from public.crew_signons where status = 'waiting' order by created_at loop
    select s.* into v_ship
      from public.npc_shipments s
      join public.locations lf on lf.id = s.from_location_id and lf.slug = v_row.from_location
      join public.locations lt on lt.id = s.to_location_id and lt.slug = v_row.destination
     where s.depart_tick >= v_row.signed_tick and s.depart_tick >= p_tick - 1 and s.arrive_tick > p_tick - 1
       and not exists (select 1 from public.crew_signons c where c.shipment_id = s.id and c.profile_id = v_row.profile_id)
     order by s.depart_tick limit 1;
    if not found then continue; end if;

    select * into v_profile from public.profiles where id = v_row.profile_id for update;
    -- Nicht mehr am Hafen oder schon anders unterwegs: Heuer verfällt.
    if v_profile.current_location is distinct from v_row.from_location or v_profile.transit_destination is not null then
      update public.crew_signons set status = 'cancelled', cancelled_at = now() where id = v_row.id;
      continue;
    end if;

    v_hours := greatest(1, (v_ship.arrive_tick - v_ship.depart_tick)::integer);
    v_wage := greatest(10, round(v_hours * (select daily_credits from public.role_wage_rates where role_code = 'logistics') / 24.0))::integer;
    v_arrives := greatest(public.noxia_tick_time(v_ship.arrive_tick), now() + interval '5 minutes');

    update public.profiles set
      transit_from = current_location,
      transit_destination = v_row.destination,
      transit_departed_at = now(),
      transit_arrives_at = v_arrives
     where id = v_row.profile_id;

    update public.crew_signons set status = 'aboard', shipment_id = v_ship.id, depart_tick = v_ship.depart_tick,
           arrive_tick = v_ship.arrive_tick, wage_credits = v_wage, boarded_at = now()
     where id = v_row.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Anheuern: auf die Heuerliste, und an Bord, wenn gerade eine Fracht ausläuft.
create or replace function public.noxia_crew_sign_on(p_profile_id uuid, p_destination text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
  v_tick bigint;
  v_carrier uuid := public.noxia_carrier_actor();
  v_id uuid;
  v_row public.crew_signons%rowtype;
begin
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001'; end if;
  if exists (select 1 from public.ships where profile_id = p_profile_id) then raise exception 'NOXIA_CREW_HAS_SHIP' using errcode = 'P0001'; end if;
  if v_profile.transit_destination is not null then raise exception 'NOXIA_TRANSIT_ALREADY_ACTIVE:%', v_profile.transit_destination using errcode = 'P0001'; end if;
  if v_carrier is null then raise exception 'NOXIA_CREW_NO_CARRIER' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.noxia_crew_routes(v_profile.current_location) r where r.destination = p_destination) then
    raise exception 'NOXIA_CREW_ROUTE_UNKNOWN:%', p_destination using errcode = 'P0001';
  end if;
  select * into v_row from public.crew_signons where profile_id = p_profile_id and status in ('waiting', 'aboard');
  if found then
    if v_row.status = 'waiting' and v_row.destination = p_destination then return jsonb_build_object('ok', true, 'id', v_row.id, 'status', 'waiting', 'idempotent', true); end if;
    raise exception 'NOXIA_CREW_ALREADY_SIGNED:%', v_row.destination using errcode = 'P0001';
  end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  insert into public.crew_signons(profile_id, operator_actor_id, from_location, destination, signed_tick)
  values (p_profile_id, v_carrier, v_profile.current_location, p_destination, v_tick - 1)
  returning id into v_id;
  perform public.noxia_crew_board_due(v_tick);
  select * into v_row from public.crew_signons where id = v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_row.status, 'arrive_tick', v_row.arrive_tick, 'wage_credits', v_row.wage_credits);
end;
$$;

create or replace function public.noxia_crew_cancel(p_profile_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update public.crew_signons set status = 'cancelled', cancelled_at = now()
   where profile_id = p_profile_id and status = 'waiting';
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'cancelled', v_n);
end;
$$;

-- Ankunft: wie bisher, dazu Heuer vom Frachtführer (Transfer).
create or replace function public.noxia_complete_passenger_transit(p_profile_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_profile public.profiles%rowtype;
  v_new_flight_count integer;
  v_crew public.crew_signons%rowtype;
  v_balance numeric;
  v_paid integer := 0;
  v_tick bigint;
begin
  if p_profile_id is null then raise exception 'NOXIA_PASSENGER_REQUIRED_ARGUMENT_MISSING' using errcode='P0001'; end if;

  select * into v_profile from public.profiles where id=p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode='P0001'; end if;

  if v_profile.transit_destination is null then
    return jsonb_build_object('ship_id',null,'is_passenger',true,'completed',false,'idempotent',true,'status','docked','location',v_profile.current_location,'destination',null,'remaining_seconds',0);
  end if;

  if v_profile.transit_arrives_at > now() then
    return jsonb_build_object('ship_id',null,'is_passenger',true,'completed',false,'idempotent',false,'status','transit','location',v_profile.current_location,'destination',v_profile.transit_destination,'remaining_seconds',greatest(0,extract(epoch from (v_profile.transit_arrives_at-now()))::integer));
  end if;

  update public.profiles set
    current_location = transit_destination,
    flight_count = coalesce(flight_count,0) + 1,
    transit_from = null,
    transit_destination = null,
    transit_departed_at = null,
    transit_arrives_at = null
  where id = p_profile_id
  returning flight_count into v_new_flight_count;

  -- Mitflug: Heuer bei Ankunft.
  select * into v_crew from public.crew_signons where profile_id = p_profile_id and status = 'aboard' for update;
  if found then
    select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_crew.operator_actor_id;
    v_paid := greatest(0, least(coalesce(v_crew.wage_credits, 0), floor(v_balance)::integer));
    select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
    if v_paid > 0 then
      insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_crew.operator_actor_id, v_tick, 'wage', null, 0, -v_paid,
              (select id from public.locations where slug = v_crew.destination),
              'crew:' || v_crew.id::text, 'Heuer für Mitflug ' || v_crew.from_location || ' → ' || v_crew.destination);
      update public.profiles set credits = coalesce(credits, 0) + v_paid where id = p_profile_id;
    end if;
    update public.crew_signons set status = 'arrived', arrived_at = now(), paid_credits = v_paid where id = v_crew.id;
  end if;

  return jsonb_build_object('ship_id',null,'is_passenger',true,'completed',true,'idempotent',false,'status','docked','location',v_profile.transit_destination,'destination',v_profile.transit_destination,'remaining_seconds',0,'flight_count',v_new_flight_count,'docking_pad_entity_id',null,
    'crew_wage', case when v_crew.id is null then null else v_paid end);
end;
$function$;

revoke all on function public.noxia_crew_sign_on(uuid, text), public.noxia_crew_cancel(uuid), public.noxia_crew_board_due(bigint), public.noxia_crew_routes(text) from public, anon, authenticated;
grant execute on function public.noxia_crew_sign_on(uuid, text), public.noxia_crew_cancel(uuid), public.noxia_crew_board_due(bigint), public.noxia_crew_routes(text) to service_role;
revoke all on function public.noxia_complete_passenger_transit(uuid) from public, anon, authenticated;
grant execute on function public.noxia_complete_passenger_transit(uuid) to service_role;
