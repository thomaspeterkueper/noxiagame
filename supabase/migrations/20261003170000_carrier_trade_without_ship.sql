-- Schritt 2/3: Handel ohne eigenes Schiff ("Spediteur"-Mechanik).
--
-- Schritt 1 (20261003160000_remove_auto_ship_on_profile_creation.sql) hat
-- Neuanmeldungen ohne automatisches Schiff vorbereitet, aber noxia_spot_trade()
-- warf bisher NOXIA_SHIP_NOT_FOUND fuer jedes Profil ohne Schiff -- Handel war
-- fuer schifflose Spieler also gar nicht moeglich. Dieser Patch macht "kein
-- eigenes Schiff" zu einem echten, dauerhaften Spielweg: man handelt ueber
-- einen Spediteur statt mit eigenem Frachter. Wie im echten Leben (Flugzeug/
-- Paketversand): man verdient etwas weniger, weil die Transportschicht auch
-- etwas abhaben will, aber man kann ohne eigenes Fahrzeug trotzdem handeln.
--
-- Warenbestand ohne Schiff liegt in der neuen Tabelle profile_cargo (statt
-- ship_cargo), Standort kommt aus profiles.current_location (statt
-- ships.location). Kapazitaet ist bewusst niedriger als ein Frachter
-- (CARRIER_CARGO_CAP) und auf Verkaeufe wird eine Spediteurs-Gebuehr
-- (CARRIER_FEE_RATE) vom Gewinn abgezogen -- beide Konstanten sind unten im
-- Funktionskoerper zentral benannt, falls sie spaeter balanciert werden
-- sollen.
--
-- Bewusst NICHT Teil dieses Patches: Reisen/Transit ohne Schiff (also das
-- eigentliche Befoerdern der Ware zwischen Standorten durch den Spediteur).
-- Das ist ein eigener, ebenso grosser Themenblock (transit.ts/
-- ascentReadiness.ts/noxia_start_transit) und folgt separat. Mit diesem
-- Patch allein kann ein schiffloser Spieler an EINEM Standort kaufen und
-- verkaufen (z.B. Erde-lokale Arbitrage durch Marktschwankungen), aber noch
-- nicht selbst zwischen Standorten reisen.

set search_path to public;

create table if not exists profile_cargo (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  resource   resource_type not null,
  amount     integer not null constraint profile_cargo_amount_positive check (amount > 0),
  unique (profile_id, resource)
);

revoke all on table profile_cargo from public, anon, authenticated;
grant select, insert, update, delete on table profile_cargo to service_role;

create or replace function public.noxia_spot_trade(p_profile_id uuid, p_action text, p_resource text, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- Spediteur-Konstanten fuer den schifflosen Pfad -- hier zentral benannt,
  -- damit sie an einer Stelle balanciert werden koennen.
  c_carrier_cargo_cap constant integer := 40;   -- kleiner als ein Frachter (i.d.R. 100t)
  c_carrier_fee_rate  constant numeric := 0.12; -- 12% vom Verkaufserloes an den Spediteur

  v_ship public.ships%rowtype;
  v_has_ship boolean := false;
  v_profile public.profiles%rowtype;
  v_location public.locations%rowtype;
  v_market public.market_prices%rowtype;
  v_local public.location_resources%rowtype;
  v_resource public.resource_type;
  v_tax_rate numeric := 0;
  v_current_tick bigint := 0;
  v_cargo_used integer := 0;
  v_cargo_amount integer := 0;
  v_cargo_max integer := 0;
  v_new_cargo integer := 0;
  v_new_stock integer := 0;
  v_max_by_cargo integer;
  v_max_by_credits integer;
  v_booked integer;
  v_unit_price integer;
  v_goods integer;
  v_tax integer;
  v_carrier_fee integer := 0;
  v_profit integer;
  v_new_credits integer;
  v_new_buy integer;
  v_new_sell integer;
  v_price_changed boolean := false;
  v_location_slug text;
begin
  if p_profile_id is null or p_resource is null then raise exception 'NOXIA_SPOT_REQUIRED_ARGUMENT_MISSING' using errcode='P0001'; end if;
  if p_action not in ('buy','sell') then raise exception 'NOXIA_SPOT_ACTION_INVALID:%',coalesce(p_action,'<null>') using errcode='P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'NOXIA_SPOT_AMOUNT_INVALID' using errcode='P0001'; end if;
  begin v_resource:=p_resource::public.resource_type; exception when invalid_text_representation then raise exception 'NOXIA_SPOT_RESOURCE_INVALID:%',p_resource using errcode='P0001'; end;

  select * into v_ship from public.ships where profile_id=p_profile_id and coalesce(is_active,false)=true order by created_at,id limit 1 for update;
  if not found then select * into v_ship from public.ships where profile_id=p_profile_id order by created_at,id limit 1 for update; end if;
  v_has_ship := found;

  select * into v_profile from public.profiles where id=p_profile_id for update; if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode='P0001'; end if;

  if v_has_ship then
    perform 1 from public.ship_cargo where ship_id=v_ship.id order by id for update;
    select coalesce(sum(amount),0)::integer into v_cargo_used from public.ship_cargo where ship_id=v_ship.id;
    select amount into v_cargo_amount from public.ship_cargo where ship_id=v_ship.id and resource=v_resource; if not found then v_cargo_amount:=0; end if;
    v_cargo_max := v_ship.cargo_max;
    v_location_slug := v_ship.location;
  else
    -- Spediteur-Pfad: kein eigenes Schiff, Ware liegt in profile_cargo,
    -- Standort kommt vom Profil statt vom Schiff.
    perform 1 from public.profile_cargo where profile_id=p_profile_id order by id for update;
    select coalesce(sum(amount),0)::integer into v_cargo_used from public.profile_cargo where profile_id=p_profile_id;
    select amount into v_cargo_amount from public.profile_cargo where profile_id=p_profile_id and resource=v_resource; if not found then v_cargo_amount:=0; end if;
    v_cargo_max := c_carrier_cargo_cap;
    v_location_slug := coalesce(v_profile.current_location,'earth');
  end if;

  select * into v_location from public.locations where slug=v_location_slug; if not found then raise exception 'NOXIA_LOCATION_NOT_FOUND:%',v_location_slug using errcode='P0001'; end if;
  select * into v_market from public.market_prices where location_id=v_location.id and resource=v_resource for update; if not found then raise exception 'NOXIA_MARKET_PRICE_NOT_FOUND:%',p_resource using errcode='P0001'; end if;
  select * into v_local from public.location_resources where location_id=v_location.id and resource=v_resource for update; if not found then raise exception 'NOXIA_SPOT_LOCAL_RESOURCE_NOT_FOUND:%',p_resource using errcode='P0001'; end if;
  select coalesce(tax_transaction,0) into v_tax_rate from public.colony_settings where location_id=v_location.id; if not found then v_tax_rate:=0; end if;
  select coalesce(max(tick_number),0)::bigint into v_current_tick from public.tick_log;

  if p_action='buy' then
    v_unit_price:=v_market.buy_price;
    v_max_by_cargo:=greatest(0,v_cargo_max-v_cargo_used);
    if v_unit_price <= 0 then v_max_by_credits:=p_amount; else v_max_by_credits:=floor(v_profile.credits/(v_unit_price*(1+v_tax_rate)))::integer; end if;
    v_booked:=least(p_amount,v_max_by_cargo,greatest(0,v_max_by_credits),v_local.stock);
    if v_booked <= 0 then
      if v_local.stock <= 0 then raise exception 'NOXIA_SPOT_STOCK_INSUFFICIENT' using errcode='P0001';
      elsif v_max_by_cargo <= 0 then raise exception 'NOXIA_SPOT_CARGO_FULL' using errcode='P0001';
      else raise exception 'NOXIA_SPOT_CREDITS_INSUFFICIENT' using errcode='P0001'; end if;
    end if;
    v_goods:=v_unit_price*v_booked; v_tax:=round(v_tax_rate*v_goods)::integer;
    while v_booked>0 and v_goods+v_tax>v_profile.credits loop v_booked:=v_booked-1; v_goods:=v_unit_price*v_booked; v_tax:=round(v_tax_rate*v_goods)::integer; end loop;
    if v_booked <= 0 then raise exception 'NOXIA_SPOT_CREDITS_INSUFFICIENT' using errcode='P0001'; end if;
    v_new_credits:=v_profile.credits-v_goods-v_tax; v_new_cargo:=v_cargo_amount+v_booked; v_new_stock:=v_local.stock-v_booked; v_profit:=-(v_goods+v_tax);
  else
    v_unit_price:=v_market.sell_price; v_booked:=least(p_amount,v_cargo_amount);
    if v_booked <= 0 then raise exception 'NOXIA_SPOT_CARGO_INSUFFICIENT' using errcode='P0001'; end if;
    v_goods:=v_unit_price*v_booked; v_tax:=round(v_tax_rate*v_goods)::integer;
    if not v_has_ship then v_carrier_fee := round(c_carrier_fee_rate*(v_goods-v_tax))::integer; end if;
    v_new_credits:=v_profile.credits+v_goods-v_tax-v_carrier_fee; v_new_cargo:=v_cargo_amount-v_booked; v_new_stock:=v_local.stock+v_booked; v_profit:=v_goods-v_tax-v_carrier_fee;
  end if;

  update public.profiles set credits=v_new_credits where id=p_profile_id;

  if v_has_ship then
    if v_new_cargo>0 then insert into public.ship_cargo(ship_id,resource,amount) values(v_ship.id,v_resource,v_new_cargo) on conflict(ship_id,resource) do update set amount=excluded.amount; else delete from public.ship_cargo where ship_id=v_ship.id and resource=v_resource; end if;
  else
    if v_new_cargo>0 then insert into public.profile_cargo(profile_id,resource,amount) values(p_profile_id,v_resource,v_new_cargo) on conflict(profile_id,resource) do update set amount=excluded.amount; else delete from public.profile_cargo where profile_id=p_profile_id and resource=v_resource; end if;
  end if;

  update public.location_resources set stock=v_new_stock,updated_at=now() where id=v_local.id;
  insert into public.trade_transactions(profile_id,from_location,to_location,resource,amount,profit) values(p_profile_id,v_location_slug,v_location_slug,v_resource,v_booked,v_profit);
  if v_tax>0 then insert into public.colony_ledger(location_id,tick,entry_type,profile_id,resource_type,amount,note) values(v_location.id,v_current_tick,'tax_transaction',p_profile_id,v_resource::text,v_tax,format('Transaktionssteuer %s %st %s',p_action,v_booked,v_resource::text)); end if;
  -- colony_ledger.entry_type hat einen CHECK-Constraint auf einen festen Satz
  -- Werte (tax_property/tax_transaction/tax_landing/tariff/payout/other);
  -- 'carrier_fee' ist bewusst NICHT dort ergaenzt (keine zusaetzliche
  -- Schema-Aenderung fuer diesen Patch) -- die Gebuehr wird stattdessen unter
  -- 'other' mit einer eindeutigen Notiz gebucht.
  if v_carrier_fee>0 then insert into public.colony_ledger(location_id,tick,entry_type,profile_id,resource_type,amount,note) values(v_location.id,v_current_tick,'other',p_profile_id,v_resource::text,v_carrier_fee,format('Spediteursgebuehr %st %s (ohne eigenes Schiff)',v_booked,v_resource::text)); end if;

  v_new_buy:=v_market.buy_price; v_new_sell:=v_market.sell_price;
  if p_action='buy' then v_new_buy:=least(200,round(v_market.buy_price*(1+0.003*v_booked))::integer); else v_new_sell:=greatest(10,round(v_market.sell_price*(1-0.003*v_booked))::integer); end if;
  if v_new_sell>=v_new_buy then v_new_sell:=v_new_buy-1; end if;
  if v_new_buy<>v_market.buy_price or v_new_sell<>v_market.sell_price then update public.market_prices set buy_price=v_new_buy,sell_price=v_new_sell,updated_at=now() where id=v_market.id; v_price_changed:=true; end if;

  return jsonb_build_object('action',p_action,'ship_id',case when v_has_ship then v_ship.id else null end,'ship_type_id',case when v_has_ship then coalesce(v_ship.ship_type_id,'freighter_mk1') else null end,'has_ship',v_has_ship,'location',v_location_slug,'resource',v_resource::text,'booked_amount',v_booked,'requested_amount',p_amount,'unit_price',v_unit_price,'tax_charged',v_tax,'tax_rate',v_tax_rate,'carrier_fee',v_carrier_fee,'profit',v_profit,'credits',v_new_credits,'cargo_amount',v_new_cargo,'cargo_max',v_cargo_max,'location_stock',v_new_stock,'market_buy_price',v_new_buy,'market_sell_price',v_new_sell,'price_changed',v_price_changed,'username',v_profile.username);
end;
$function$;

revoke all on function public.noxia_spot_trade(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.noxia_spot_trade(uuid,text,text,integer) to service_role;
