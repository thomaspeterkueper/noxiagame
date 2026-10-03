-- Schritt 3/3: Reisen zwischen Standorten ohne eigenes Schiff ("Spediteur"
-- befoerdert nicht nur Ware, sondern auch den Spieler selbst -- Linienflug/
-- Mitfluggelegenheit statt eigener Frachter). Schliesst die in Schritt 1+2
-- offen gelassene Luecke: bisher konnte ein schiffloser Spieler an seinem
-- Standort handeln (Migration 20261003170000), aber nicht reisen.
--
-- Bewusst EIN einfacheres Modell als der Schiffs-Transit
-- (noxia_start_transit/noxia_complete_transit, siehe
-- 20260910093000_atomic_transit_commands.sql): kein Energie-/Frachtraum-
-- Modell, keine Landegebuehren/Docking-Kapazitaet -- man kauft ein Ticket
-- (Credits, einmalig) und wird befoerdert. Dauer kommt aus demselben
-- transferQuote()-Geometriemodell wie beim Schiff (speedMult=1, also
-- Standard-Linienflug-Tempo, kein Bonus durch ein eigenes, schnelleres
-- Schiff -- das bleibt ein Vorteil des Schiffsbesitzes).
--
-- Reise-Zustand liegt direkt auf profiles (spiegelt ships.status/
-- dest_location/arrives_at/transit_started_at, aber fuer den schifflosen
-- Pfad): transit_from, transit_destination, transit_departed_at,
-- transit_arrives_at. current_location bleibt waehrend der Reise am
-- Ausgangsort stehen (wie ships.location waehrend eines Schiffstransits)
-- und wird erst bei Ankunft aktualisiert.

set search_path to public;

alter table profiles
  add column if not exists transit_from        text,
  add column if not exists transit_destination text,
  add column if not exists transit_departed_at timestamptz,
  add column if not exists transit_arrives_at   timestamptz;

create or replace function public.noxia_start_passenger_transit(
  p_profile_id uuid,
  p_destination text,
  p_duration_seconds integer,
  p_ticket_price integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile public.profiles%rowtype;
  v_has_ship boolean;
  v_from_location public.locations%rowtype;
  v_new_credits integer;
  v_departed_at timestamptz;
  v_arrives_at timestamptz;
  v_current_tick bigint := 0;
begin
  if p_profile_id is null or p_destination is null then raise exception 'NOXIA_PASSENGER_REQUIRED_ARGUMENT_MISSING' using errcode='P0001'; end if;
  if p_duration_seconds is null or p_duration_seconds <= 0 then raise exception 'NOXIA_TRANSIT_SPEED_INVALID:%',p_duration_seconds using errcode='P0001'; end if;

  select * into v_profile from public.profiles where id=p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode='P0001'; end if;

  select exists(select 1 from public.ships where profile_id=p_profile_id) into v_has_ship;
  if v_has_ship then raise exception 'NOXIA_PASSENGER_HAS_SHIP' using errcode='P0001'; end if;

  if v_profile.current_location = p_destination then raise exception 'NOXIA_TRANSIT_SAME_LOCATION' using errcode='P0001'; end if;

  -- Bereits unterwegs, noch nicht angekommen: nur idempotent, wenn dasselbe Ziel.
  if v_profile.transit_destination is not null and v_profile.transit_arrives_at > now() then
    if v_profile.transit_destination = p_destination then
      return jsonb_build_object('ship_id',null,'is_passenger',true,'status','transit','from_location',v_profile.transit_from,'destination',v_profile.transit_destination,'departed_at',v_profile.transit_departed_at,'arrives_at',v_profile.transit_arrives_at,'duration_seconds',extract(epoch from (v_profile.transit_arrives_at-v_profile.transit_departed_at))::integer,'remaining_seconds',greatest(0,extract(epoch from (v_profile.transit_arrives_at-now()))::integer),'energy_used',0,'energy_left',0,'landing_fee',0,'ticket_price',0,'credits',v_profile.credits,'docking_managed',false,'docking_pad_entity_id',null,'idempotent',true);
    end if;
    raise exception 'NOXIA_TRANSIT_ALREADY_ACTIVE:%',v_profile.transit_destination using errcode='P0001';
  end if;

  select * into v_from_location from public.locations where slug=v_profile.current_location;
  if not found then raise exception 'NOXIA_LOCATION_NOT_FOUND:%',v_profile.current_location using errcode='P0001'; end if;
  if not exists (select 1 from public.locations where slug=p_destination) then raise exception 'NOXIA_LOCATION_NOT_FOUND:%',p_destination using errcode='P0001'; end if;

  if p_ticket_price > 0 and v_profile.credits < p_ticket_price then
    raise exception 'NOXIA_PASSENGER_TICKET_INSUFFICIENT:%:%',p_ticket_price,v_profile.credits using errcode='P0001';
  end if;

  v_new_credits := v_profile.credits - greatest(0,p_ticket_price);
  v_departed_at := now();
  v_arrives_at  := now() + (p_duration_seconds || ' seconds')::interval;

  update public.profiles set
    credits = v_new_credits,
    transit_from = v_profile.current_location,
    transit_destination = p_destination,
    transit_departed_at = v_departed_at,
    transit_arrives_at = v_arrives_at
  where id = p_profile_id;

  if p_ticket_price > 0 then
    select coalesce(max(tick_number),0)::bigint into v_current_tick from public.tick_log;
    insert into public.colony_ledger(location_id,tick,entry_type,profile_id,resource_type,amount,note)
    values (v_from_location.id, v_current_tick, 'payout', p_profile_id, null, p_ticket_price, format('Ticketerloes Linienflug nach %s (Spieler ohne eigenes Schiff)', p_destination));
  end if;

  return jsonb_build_object('ship_id',null,'is_passenger',true,'status','transit','from_location',v_profile.current_location,'destination',p_destination,'departed_at',v_departed_at,'arrives_at',v_arrives_at,'duration_seconds',p_duration_seconds,'remaining_seconds',p_duration_seconds,'energy_used',0,'energy_left',0,'landing_fee',0,'ticket_price',p_ticket_price,'credits',v_new_credits,'docking_managed',false,'docking_pad_entity_id',null,'idempotent',false);
end;
$function$;

create or replace function public.noxia_complete_passenger_transit(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile public.profiles%rowtype;
  v_new_flight_count integer;
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

  return jsonb_build_object('ship_id',null,'is_passenger',true,'completed',true,'idempotent',false,'status','docked','location',v_profile.transit_destination,'destination',v_profile.transit_destination,'remaining_seconds',0,'flight_count',v_new_flight_count,'docking_pad_entity_id',null);
end;
$function$;

revoke all on function public.noxia_start_passenger_transit(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.noxia_start_passenger_transit(uuid,text,integer,integer) to service_role;
revoke all on function public.noxia_complete_passenger_transit(uuid) from public, anon, authenticated;
grant execute on function public.noxia_complete_passenger_transit(uuid) to service_role;
