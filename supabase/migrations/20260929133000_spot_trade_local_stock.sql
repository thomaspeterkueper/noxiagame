-- Spot trades must move physical local inventory atomically.
-- Buys are capped by local stock; sells replenish local stock.
-- The function remains service-role only.

create or replace function public.noxia_spot_trade(p_profile_id uuid, p_action text, p_resource text, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ship public.ships%rowtype;
  v_profile public.profiles%rowtype;
  v_location public.locations%rowtype;
  v_market public.market_prices%rowtype;
  v_local public.location_resources%rowtype;
  v_resource public.resource_type;
  v_tax_rate numeric := 0;
  v_current_tick bigint := 0;
  v_cargo_used integer := 0;
  v_cargo_amount integer := 0;
  v_new_cargo integer := 0;
  v_new_stock integer := 0;
  v_max_by_cargo integer;
  v_max_by_credits integer;
  v_booked integer;
  v_unit_price integer;
  v_goods integer;
  v_tax integer;
  v_profit integer;
  v_new_credits integer;
  v_new_buy integer;
  v_new_sell integer;
  v_price_changed boolean := false;
begin
  if p_profile_id is null or p_resource is null then raise exception 'NOXIA_SPOT_REQUIRED_ARGUMENT_MISSING' using errcode='P0001'; end if;
  if p_action not in ('buy','sell') then raise exception 'NOXIA_SPOT_ACTION_INVALID:%',coalesce(p_action,'<null>') using errcode='P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'NOXIA_SPOT_AMOUNT_INVALID' using errcode='P0001'; end if;
  begin v_resource:=p_resource::public.resource_type; exception when invalid_text_representation then raise exception 'NOXIA_SPOT_RESOURCE_INVALID:%',p_resource using errcode='P0001'; end;

  select * into v_ship from public.ships where profile_id=p_profile_id and coalesce(is_active,false)=true order by created_at,id limit 1 for update;
  if not found then select * into v_ship from public.ships where profile_id=p_profile_id order by created_at,id limit 1 for update; end if;
  if not found then raise exception 'NOXIA_SHIP_NOT_FOUND' using errcode='P0001'; end if;
  perform 1 from public.ship_cargo where ship_id=v_ship.id order by id for update;
  select coalesce(sum(amount),0)::integer into v_cargo_used from public.ship_cargo where ship_id=v_ship.id;
  select amount into v_cargo_amount from public.ship_cargo where ship_id=v_ship.id and resource=v_resource; if not found then v_cargo_amount:=0; end if;
  select * into v_profile from public.profiles where id=p_profile_id for update; if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode='P0001'; end if;
  select * into v_location from public.locations where slug=v_ship.location; if not found then raise exception 'NOXIA_LOCATION_NOT_FOUND:%',v_ship.location using errcode='P0001'; end if;
  select * into v_market from public.market_prices where location_id=v_location.id and resource=v_resource for update; if not found then raise exception 'NOXIA_MARKET_PRICE_NOT_FOUND:%',p_resource using errcode='P0001'; end if;
  select * into v_local from public.location_resources where location_id=v_location.id and resource=v_resource for update; if not found then raise exception 'NOXIA_SPOT_LOCAL_RESOURCE_NOT_FOUND:%',p_resource using errcode='P0001'; end if;
  select coalesce(tax_transaction,0) into v_tax_rate from public.colony_settings where location_id=v_location.id; if not found then v_tax_rate:=0; end if;
  select coalesce(max(tick_number),0)::bigint into v_current_tick from public.tick_log;

  if p_action='buy' then
    v_unit_price:=v_market.buy_price;
    v_max_by_cargo:=greatest(0,v_ship.cargo_max-v_cargo_used);
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
    v_goods:=v_unit_price*v_booked; v_tax:=round(v_tax_rate*v_goods)::integer; v_new_credits:=v_profile.credits+v_goods-v_tax; v_new_cargo:=v_cargo_amount-v_booked; v_new_stock:=v_local.stock+v_booked; v_profit:=v_goods-v_tax;
  end if;

  update public.profiles set credits=v_new_credits where id=p_profile_id;
  if v_new_cargo>0 then insert into public.ship_cargo(ship_id,resource,amount) values(v_ship.id,v_resource,v_new_cargo) on conflict(ship_id,resource) do update set amount=excluded.amount; else delete from public.ship_cargo where ship_id=v_ship.id and resource=v_resource; end if;
  update public.location_resources set stock=v_new_stock,updated_at=now() where id=v_local.id;
  insert into public.trade_transactions(profile_id,from_location,to_location,resource,amount,profit) values(p_profile_id,v_ship.location,v_ship.location,v_resource,v_booked,v_profit);
  if v_tax>0 then insert into public.colony_ledger(location_id,tick,entry_type,profile_id,resource_type,amount,note) values(v_location.id,v_current_tick,'tax_transaction',p_profile_id,v_resource::text,v_tax,format('Transaktionssteuer %s %st %s',p_action,v_booked,v_resource::text)); end if;

  v_new_buy:=v_market.buy_price; v_new_sell:=v_market.sell_price;
  if p_action='buy' then v_new_buy:=least(200,round(v_market.buy_price*(1+0.003*v_booked))::integer); else v_new_sell:=greatest(10,round(v_market.sell_price*(1-0.003*v_booked))::integer); end if;
  if v_new_sell>=v_new_buy then v_new_sell:=v_new_buy-1; end if;
  if v_new_buy<>v_market.buy_price or v_new_sell<>v_market.sell_price then update public.market_prices set buy_price=v_new_buy,sell_price=v_new_sell,updated_at=now() where id=v_market.id; v_price_changed:=true; end if;

  return jsonb_build_object('action',p_action,'ship_id',v_ship.id,'ship_type_id',coalesce(v_ship.ship_type_id,'freighter_mk1'),'location',v_ship.location,'resource',v_resource::text,'booked_amount',v_booked,'requested_amount',p_amount,'unit_price',v_unit_price,'tax_charged',v_tax,'tax_rate',v_tax_rate,'profit',v_profit,'credits',v_new_credits,'cargo_amount',v_new_cargo,'cargo_max',v_ship.cargo_max,'location_stock',v_new_stock,'market_buy_price',v_new_buy,'market_sell_price',v_new_sell,'price_changed',v_price_changed,'username',v_profile.username);
end;
$function$;

revoke all on function public.noxia_spot_trade(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.noxia_spot_trade(uuid,text,text,integer) to service_role;
