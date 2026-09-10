-- NOXIA atomic trade commands v1
-- 2026-09-10
--
-- Fulfilling a trade order changes five pieces of authoritative state. Keep
-- them under one PostgreSQL transaction and row-lock the contested records.

set search_path to public;

create or replace function public.noxia_fulfill_trade_order(
  p_profile_id uuid,
  p_order_id uuid,
  p_agreed_reward integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.trade_orders%rowtype;
  v_location public.locations%rowtype;
  v_ship public.ships%rowtype;
  v_cargo public.ship_cargo%rowtype;
  v_stock integer;
  v_credits integer;
  v_urgency numeric := 0.25;
  v_server_max integer;
  v_final_reward integer;
  v_new_cargo integer;
begin
  if p_profile_id is null or p_order_id is null then
    raise exception 'NOXIA_ORDER_REQUIRED_ARGUMENT_MISSING' using errcode = 'P0001';
  end if;

  select * into v_order
  from public.trade_orders
  where id = p_order_id
  for update;

  if not found or v_order.status is distinct from 'open' then
    raise exception 'NOXIA_ORDER_NOT_OPEN' using errcode = 'P0001';
  end if;

  select * into v_location
  from public.locations
  where id = v_order.location_id;

  if not found then
    raise exception 'NOXIA_ORDER_LOCATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Newer saves can own several ships. Trading is performed by the active one.
  -- Fall back to the oldest legacy ship only for pre-multi-ship saves.
  select * into v_ship
  from public.ships
  where profile_id = p_profile_id and coalesce(is_active, false) = true
  order by created_at, id
  limit 1
  for update;

  if not found then
    select * into v_ship
    from public.ships
    where profile_id = p_profile_id
    order by created_at, id
    limit 1
    for update;
  end if;

  if not found then
    raise exception 'NOXIA_SHIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_ship.location is distinct from v_location.slug then
    raise exception 'NOXIA_ORDER_WRONG_LOCATION:%', v_location.slug using errcode = 'P0001';
  end if;

  select * into v_cargo
  from public.ship_cargo
  where ship_id = v_ship.id and resource = v_order.resource
  for update;

  if not found or v_cargo.amount < v_order.amount then
    raise exception 'NOXIA_ORDER_CARGO_INSUFFICIENT:%', v_order.resource using errcode = 'P0001';
  end if;

  select stock into v_stock
  from public.location_resources
  where location_id = v_order.location_id and resource = v_order.resource
  for update;

  if not found then
    raise exception 'NOXIA_ORDER_RESOURCE_STOCK_MISSING:%', v_order.resource using errcode = 'P0001';
  end if;

  select credits into v_credits
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Must stay equivalent to lib/game/config.ts orderMaxReward().
  if v_order.expires_at is not null then
    if v_order.expires_at - now() < interval '6 hours' then v_urgency := v_urgency + 0.15; end if;
    if v_order.expires_at - now() < interval '2 hours' then v_urgency := v_urgency + 0.10; end if;
  end if;
  if v_stock < 30 then v_urgency := v_urgency + 0.15; end if;

  v_server_max := round(v_order.reward * (1 + least(0.50, v_urgency)))::integer;
  v_final_reward := case
    when p_agreed_reward is null then v_order.reward
    else least(greatest(p_agreed_reward, v_order.reward), v_server_max)
  end;
  v_new_cargo := v_cargo.amount - v_order.amount;

  update public.profiles
  set credits = credits + v_final_reward
  where id = p_profile_id
  returning credits into v_credits;

  if v_new_cargo > 0 then
    update public.ship_cargo
    set amount = v_new_cargo
    where id = v_cargo.id;
  else
    delete from public.ship_cargo where id = v_cargo.id;
  end if;

  update public.trade_orders
  set status = 'fulfilled', fulfilled_by = p_profile_id
  where id = v_order.id;

  update public.location_resources
  set stock = stock + v_order.amount,
      updated_at = now()
  where location_id = v_order.location_id and resource = v_order.resource;

  insert into public.trade_transactions (
    profile_id, from_location, to_location, resource, amount, profit, order_id
  ) values (
    p_profile_id, v_ship.location, v_location.slug, v_order.resource,
    v_order.amount, v_final_reward, v_order.id
  );

  return jsonb_build_object(
    'order_id', v_order.id,
    'ship_id', v_ship.id,
    'reward', v_final_reward,
    'base_reward', v_order.reward,
    'server_max_reward', v_server_max,
    'credits', v_credits,
    'resource', v_order.resource,
    'cargo_amount', v_new_cargo,
    'location_stock', v_stock + v_order.amount
  );
end;
$$;

revoke all on function public.noxia_fulfill_trade_order(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.noxia_fulfill_trade_order(uuid,uuid,integer) to service_role;

comment on function public.noxia_fulfill_trade_order(uuid,uuid,integer) is
  'Atomically fulfills a NOXIA trade order with row locks across order, active ship cargo, player credits and colony stock.';
