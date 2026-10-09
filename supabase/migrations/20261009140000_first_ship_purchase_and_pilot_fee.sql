-- 20261009140000_first_ship_purchase_and_pilot_fee.sql
--
-- 1) Erstkauf eines Schiffs ohne vorhandenes Schiff.
--    noxia_buy_ship_type() konnte bisher nur den Typ eines vorhandenen Schiffs
--    tauschen und warf fuer schifflose Profile NOXIA_SHIP_NOT_FOUND. Seit
--    20261003160000 starten neue Profile ohne Schiff; der Kauf war fuer sie
--    damit unmoeglich. Jetzt legt die Funktion in diesem Fall ein Schiff am
--    Standort des Spielers an und uebernimmt die Spediteur-Ladung
--    (profile_cargo) in den Laderaum. Der Pfad mit vorhandenem Schiff bleibt
--    unveraendert.
--    Die kaufmaennische Qualifikation prueft die Route (app/api/game/ships),
--    weil sie eine Ableitung aus Handels- und Lernjournal ist.
--
-- 2) Pilotenhonorar.
--    Wer ein eigenes Schiff fliegt, ohne die Flugausbildung abgeschlossen zu
--    haben, braucht einen angeheuerten Piloten. Das Honorar wird beim Start
--    atomar zusammen mit dem Transit gebucht: noxia_start_transit_with_pilot()
--    ruft den unveraenderten Kern noxia_start_transit() auf und bucht danach
--    das Honorar in derselben Transaktion. Scheitert eines von beiden, findet
--    nichts statt. Ob ein Pilot noetig ist, entscheidet der Server
--    (lib/game/core/transit.ts) aus player_learning_progress; es wird kein
--    eigener Zustand gespeichert.

set search_path to public;

create or replace function public.noxia_buy_ship_type(p_profile_id uuid, p_ship_type_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ship public.ships%rowtype;
  v_ship_type public.ship_types%rowtype;
  v_profile public.profiles%rowtype;
  v_credits integer;
begin
  if p_profile_id is null or p_ship_type_id is null or btrim(p_ship_type_id)='' then raise exception 'NOXIA_SHIP_PURCHASE_REQUIRED_ARGUMENT_MISSING' using errcode='P0001'; end if;
  select * into v_ship_type from public.ship_types where id=p_ship_type_id; if not found then raise exception 'NOXIA_SHIP_TYPE_NOT_FOUND:%',p_ship_type_id using errcode='P0001'; end if;
  perform 1 from public.ships where profile_id=p_profile_id order by id for update;
  select * into v_ship from public.ships where profile_id=p_profile_id and coalesce(is_active,false)=true order by created_at,id limit 1;
  if not found then select * into v_ship from public.ships where profile_id=p_profile_id order by created_at,id limit 1; end if;

  if not found then
    -- Erstkauf: kein Schiff vorhanden. Die Profilzeile ist die Sperre gegen
    -- gleichzeitige Kaeufe.
    select * into v_profile from public.profiles where id=p_profile_id for update;
    if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode='P0001'; end if;
    if v_profile.transit_destination is not null then raise exception 'NOXIA_TRANSIT_SHIP_MUTATION_FORBIDDEN' using errcode='P0001'; end if;
    if coalesce(v_ship_type.cost_credits,0) <= 0 then raise exception 'NOXIA_SHIP_TYPE_NOT_FOR_SALE:%',p_ship_type_id using errcode='P0001'; end if;
    if v_profile.current_location is distinct from v_ship_type.available_at then raise exception 'NOXIA_SHIP_TYPE_WRONG_LOCATION:%',v_ship_type.available_at using errcode='P0001'; end if;
    if v_profile.credits < v_ship_type.cost_credits then raise exception 'NOXIA_SHIP_PURCHASE_CREDITS_INSUFFICIENT' using errcode='P0001'; end if;
    v_credits:=v_profile.credits-v_ship_type.cost_credits;

    insert into public.ships(profile_id,name,cargo_max,location,ship_type_id,is_active)
    values(p_profile_id,v_ship_type.name,v_ship_type.cargo_max,v_profile.current_location,p_ship_type_id,true)
    returning * into v_ship;

    -- Die Ware, die bisher mit dem Spediteur reiste, liegt ab jetzt im eigenen Laderaum.
    insert into public.ship_cargo(ship_id,resource,amount)
    select v_ship.id,pc.resource,pc.amount from public.profile_cargo pc where pc.profile_id=p_profile_id and pc.amount>0;
    delete from public.profile_cargo where profile_id=p_profile_id;

    update public.profiles set credits=v_credits,active_ship_id=v_ship.id where id=p_profile_id;
    return jsonb_build_object('ship_id',v_ship.id,'ship_type_id',p_ship_type_id,'new_credits',v_credits,'cargo_max',v_ship_type.cargo_max,'speed_mult',v_ship_type.speed_mult,'location',v_ship.location,'first_ship',true);
  end if;

  select credits into v_credits from public.profiles where id=p_profile_id for update; if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode='P0001'; end if;
  if v_ship.ship_type_id is not distinct from p_ship_type_id then raise exception 'NOXIA_SHIP_TYPE_ALREADY_OWNED' using errcode='P0001'; end if;
  if v_ship.location is distinct from v_ship_type.available_at then raise exception 'NOXIA_SHIP_TYPE_WRONG_LOCATION:%',v_ship_type.available_at using errcode='P0001'; end if;
  if v_credits < v_ship_type.cost_credits then raise exception 'NOXIA_SHIP_PURCHASE_CREDITS_INSUFFICIENT' using errcode='P0001'; end if;
  v_credits:=v_credits-v_ship_type.cost_credits;
  update public.profiles set credits=v_credits,active_ship_id=v_ship.id where id=p_profile_id;
  update public.ships set is_active=false where profile_id=p_profile_id and id<>v_ship.id and coalesce(is_active,false)=true;
  update public.ships set ship_type_id=p_ship_type_id,cargo_max=v_ship_type.cargo_max,is_active=true where id=v_ship.id;
  delete from public.ship_cargo where ship_id=v_ship.id;
  return jsonb_build_object('ship_id',v_ship.id,'ship_type_id',p_ship_type_id,'new_credits',v_credits,'cargo_max',v_ship_type.cargo_max,'speed_mult',v_ship_type.speed_mult,'location',v_ship.location,'first_ship',false);
end;
$function$;

revoke all on function public.noxia_buy_ship_type(uuid, text) from public, anon, authenticated;
grant execute on function public.noxia_buy_ship_type(uuid, text) to service_role;

create or replace function public.noxia_start_transit_with_pilot(
  p_profile_id uuid,
  p_destination_slug text,
  p_duration_seconds integer,
  p_energy_needed integer,
  p_docking_idle_hours integer default 24,
  p_pilot_fee integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
  v_fee integer := greatest(0, coalesce(p_pilot_fee, 0));
  v_credits integer;
  v_location_id uuid;
  v_tick bigint := 0;
begin
  v_result := public.noxia_start_transit(p_profile_id, p_destination_slug, p_duration_seconds, p_energy_needed, p_docking_idle_hours);

  -- Wiederholter Aufruf fuer einen bereits laufenden Flug: nichts erneut buchen.
  if v_fee = 0 or coalesce((v_result->>'idempotent')::boolean, false) then
    return v_result || jsonb_build_object('pilot_fee', 0);
  end if;

  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if v_credits < v_fee then
    -- Die Ausnahme rollt auch den eben gestarteten Transit zurueck.
    raise exception 'NOXIA_TRANSIT_PILOT_FEE_INSUFFICIENT:%:%', v_fee, v_credits using errcode = 'P0001';
  end if;

  select id into v_location_id from public.locations where slug = v_result->>'from_location';
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;

  update public.profiles set credits = credits - v_fee where id = p_profile_id;
  if v_location_id is not null then
    insert into public.colony_ledger(location_id, tick, entry_type, profile_id, resource_type, amount, note)
    values (v_location_id, v_tick, 'other', p_profile_id, null, v_fee,
      format('Pilotenhonorar %s -> %s (keine eigene Flugausbildung)', v_result->>'from_location', p_destination_slug));
  end if;

  return v_result || jsonb_build_object('pilot_fee', v_fee, 'credits', v_credits - v_fee);
end;
$function$;

revoke all on function public.noxia_start_transit_with_pilot(uuid, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.noxia_start_transit_with_pilot(uuid, text, integer, integer, integer, integer) to service_role;

comment on function public.noxia_start_transit_with_pilot(uuid, text, integer, integer, integer, integer) is
  'Startet einen Schiffstransit ueber noxia_start_transit() und bucht in derselben Transaktion ein Pilotenhonorar (colony_ledger, Abflugort). p_pilot_fee = 0: verhaelt sich wie noxia_start_transit().';
