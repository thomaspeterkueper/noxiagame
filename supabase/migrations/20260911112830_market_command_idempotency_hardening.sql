-- Harden marketplace idempotency for concurrent retries.
--
-- Unique command_id constraints protect state integrity, but without a command-scoped
-- lock two concurrent requests can both pass the initial lookup and the second would
-- receive a uniqueness error instead of the canonical idempotent result.

set search_path to public;

create or replace function public.noxia_create_market_offer(
  p_command_id uuid,
  p_seller_profile_id uuid,
  p_seller_inventory_id uuid,
  p_resource public.resource_type,
  p_amount integer,
  p_unit_price integer
) returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_existing public.market_offers%rowtype;
  v_inventory public.logistics_inventories%rowtype;
  v_account public.storage_accounts%rowtype;
  v_host public.logistics_inventories%rowtype;
  v_available integer;
  v_offer_id uuid := gen_random_uuid();
  v_reservation_id uuid;
  v_offer public.market_offers%rowtype;
begin
  if p_command_id is null
     or p_seller_profile_id is null
     or p_seller_inventory_id is null
     or p_resource is null
     or p_amount is null or p_amount <= 0
     or p_unit_price is null or p_unit_price <= 0 then
    raise exception 'NOXIA_MARKET_OFFER_INVALID_ARGUMENT' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('noxia_market_offer:' || p_command_id::text, 0));

  select * into v_existing
  from public.market_offers
  where command_id = p_command_id;

  if found then
    if v_existing.seller_profile_id is distinct from p_seller_profile_id
       or v_existing.seller_inventory_id is distinct from p_seller_inventory_id
       or v_existing.resource is distinct from p_resource
       or v_existing.amount_total is distinct from p_amount
       or v_existing.unit_price is distinct from p_unit_price then
      raise exception 'NOXIA_MARKET_OFFER_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return to_jsonb(v_existing) || jsonb_build_object('idempotent', true);
  end if;

  select * into v_inventory
  from public.logistics_inventories
  where id = p_seller_inventory_id and active
  for update;

  if not found then
    raise exception 'NOXIA_INVENTORY_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_inventory.owner_profile_id is distinct from p_seller_profile_id
     or v_inventory.storage_kind <> 'native'
     or v_inventory.subject_type <> 'storage_account' then
    raise exception 'NOXIA_MARKET_SELLER_INVENTORY_FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_account
  from public.storage_accounts
  where inventory_id = p_seller_inventory_id and status = 'active'
  for update;

  if not found or v_account.owner_profile_id is distinct from p_seller_profile_id then
    raise exception 'NOXIA_STORAGE_ACCOUNT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_host
  from public.logistics_inventories
  where id = v_account.host_inventory_id and active
  for update;

  if not found then
    raise exception 'NOXIA_STORAGE_HOST_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_available := public.noxia_inventory_amount(p_seller_inventory_id, p_resource)
    - public.noxia_inventory_reserved(p_seller_inventory_id, p_resource, 'outbound');

  if v_available < p_amount then
    raise exception 'NOXIA_INVENTORY_AVAILABLE_INSUFFICIENT:%:%', p_resource, greatest(0, v_available) using errcode = 'P0001';
  end if;

  insert into public.logistics_reservations(
    inventory_id, actor_profile_id, resource, amount, direction, purpose_type, purpose_id, status
  ) values (
    p_seller_inventory_id, p_seller_profile_id, p_resource, p_amount,
    'outbound', 'market_offer', v_offer_id, 'active'
  ) returning id into v_reservation_id;

  insert into public.market_offers(
    id, command_id, seller_profile_id, host_inventory_id, seller_inventory_id,
    reservation_id, resource, amount_total, amount_remaining, unit_price, status
  ) values (
    v_offer_id, p_command_id, p_seller_profile_id, v_host.id, p_seller_inventory_id,
    v_reservation_id, p_resource, p_amount, p_amount, p_unit_price, 'open'
  ) returning * into v_offer;

  return to_jsonb(v_offer) || jsonb_build_object('idempotent', false);
end;
$function$;

create or replace function public.noxia_buy_market_offer(
  p_command_id uuid,
  p_buyer_profile_id uuid,
  p_offer_id uuid,
  p_amount integer
) returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_existing public.market_settlements%rowtype;
  v_offer public.market_offers%rowtype;
  v_reservation public.logistics_reservations%rowtype;
  v_seller_account public.storage_accounts%rowtype;
  v_buyer_account jsonb;
  v_buyer_inventory_id uuid;
  v_buyer_credits integer;
  v_seller_credits integer;
  v_total_price bigint;
  v_remaining integer;
  v_result jsonb;
begin
  if p_command_id is null
     or p_buyer_profile_id is null
     or p_offer_id is null
     or p_amount is null or p_amount <= 0 then
    raise exception 'NOXIA_MARKET_BUY_INVALID_ARGUMENT' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('noxia_market_buy:' || p_command_id::text, 0));

  select * into v_existing
  from public.market_settlements
  where command_id = p_command_id;

  if found then
    if v_existing.buyer_profile_id is distinct from p_buyer_profile_id
       or v_existing.offer_id is distinct from p_offer_id
       or v_existing.amount is distinct from p_amount then
      raise exception 'NOXIA_MARKET_BUY_COMMAND_CONFLICT' using errcode = 'P0001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_offer
  from public.market_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'NOXIA_MARKET_OFFER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_offer.status <> 'open' then
    raise exception 'NOXIA_MARKET_OFFER_STATE_INVALID:%', v_offer.status using errcode = 'P0001';
  end if;
  if v_offer.seller_profile_id = p_buyer_profile_id then
    raise exception 'NOXIA_MARKET_SELF_PURCHASE_FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_amount > v_offer.amount_remaining then
    raise exception 'NOXIA_MARKET_OFFER_AMOUNT_INSUFFICIENT:%', v_offer.amount_remaining using errcode = 'P0001';
  end if;

  select * into v_reservation
  from public.logistics_reservations
  where id = v_offer.reservation_id
  for update;

  if not found
     or v_reservation.status <> 'active'
     or v_reservation.direction <> 'outbound'
     or v_reservation.purpose_type <> 'market_offer'
     or v_reservation.purpose_id is distinct from v_offer.id
     or v_reservation.inventory_id is distinct from v_offer.seller_inventory_id
     or v_reservation.resource is distinct from v_offer.resource
     or v_reservation.amount is distinct from v_offer.amount_remaining then
    raise exception 'NOXIA_MARKET_RESERVATION_INVALID' using errcode = 'P0001';
  end if;

  select * into v_seller_account
  from public.storage_accounts
  where inventory_id = v_offer.seller_inventory_id
    and host_inventory_id = v_offer.host_inventory_id
    and owner_profile_id = v_offer.seller_profile_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'NOXIA_STORAGE_ACCOUNT_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform id
  from public.profiles
  where id in (p_buyer_profile_id, v_offer.seller_profile_id)
  order by id
  for update;

  select credits into v_buyer_credits
  from public.profiles
  where id = p_buyer_profile_id;

  select credits into v_seller_credits
  from public.profiles
  where id = v_offer.seller_profile_id;

  if v_buyer_credits is null or v_seller_credits is null then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_total_price := p_amount::bigint * v_offer.unit_price::bigint;
  if v_total_price <= 0 or v_total_price > 2147483647 then
    raise exception 'NOXIA_MARKET_PRICE_OUT_OF_RANGE' using errcode = 'P0001';
  end if;
  if v_buyer_credits < v_total_price then
    raise exception 'NOXIA_MARKET_CREDITS_INSUFFICIENT:%:%', v_total_price, v_buyer_credits using errcode = 'P0001';
  end if;

  if public.noxia_inventory_amount(v_offer.seller_inventory_id, v_offer.resource) < p_amount then
    raise exception 'NOXIA_MARKET_RESERVED_STOCK_MISSING' using errcode = 'P0001';
  end if;

  v_buyer_account := public.noxia_ensure_storage_account(p_buyer_profile_id, v_offer.host_inventory_id);
  v_buyer_inventory_id := nullif(v_buyer_account #>> '{account,inventory_id}', '')::uuid;
  if v_buyer_inventory_id is null then
    raise exception 'NOXIA_STORAGE_ACCOUNT_INVENTORY_INVALID' using errcode = 'P0001';
  end if;

  update public.profiles
  set credits = credits - v_total_price::integer
  where id = p_buyer_profile_id
  returning credits into v_buyer_credits;

  update public.profiles
  set credits = credits + v_total_price::integer
  where id = v_offer.seller_profile_id
  returning credits into v_seller_credits;

  perform public.noxia_adjust_inventory_amount(v_offer.seller_inventory_id, v_offer.resource, -p_amount);
  perform public.noxia_adjust_inventory_amount(v_buyer_inventory_id, v_offer.resource, p_amount);

  v_remaining := v_offer.amount_remaining - p_amount;

  if v_remaining = 0 then
    update public.logistics_reservations
    set status = 'consumed', settled_at = now()
    where id = v_offer.reservation_id;

    update public.market_offers
    set amount_remaining = 0,
        status = 'filled',
        closed_at = now(),
        updated_at = now()
    where id = v_offer.id
    returning * into v_offer;
  else
    update public.logistics_reservations
    set amount = v_remaining
    where id = v_offer.reservation_id;

    update public.market_offers
    set amount_remaining = v_remaining,
        updated_at = now()
    where id = v_offer.id
    returning * into v_offer;
  end if;

  v_result := jsonb_build_object(
    'offerId', v_offer.id,
    'hostInventoryId', v_offer.host_inventory_id,
    'sellerInventoryId', v_offer.seller_inventory_id,
    'buyerInventoryId', v_buyer_inventory_id,
    'resource', v_offer.resource,
    'amount', p_amount,
    'unitPrice', v_offer.unit_price,
    'totalPrice', v_total_price,
    'amountRemaining', v_offer.amount_remaining,
    'offerStatus', v_offer.status,
    'buyerCredits', v_buyer_credits,
    'sellerCredits', v_seller_credits,
    'idempotent', false
  );

  insert into public.market_settlements(
    command_id, offer_id, buyer_profile_id, seller_profile_id, host_inventory_id,
    seller_inventory_id, buyer_inventory_id, resource, amount, unit_price, total_price, result
  ) values (
    p_command_id, v_offer.id, p_buyer_profile_id, v_offer.seller_profile_id, v_offer.host_inventory_id,
    v_offer.seller_inventory_id, v_buyer_inventory_id, v_offer.resource, p_amount,
    v_offer.unit_price, v_total_price, v_result
  );

  return v_result;
end;
$function$;

revoke all on function public.noxia_create_market_offer(uuid,uuid,uuid,public.resource_type,integer,integer) from public, anon, authenticated;
revoke all on function public.noxia_buy_market_offer(uuid,uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.noxia_create_market_offer(uuid,uuid,uuid,public.resource_type,integer,integer) to service_role;
grant execute on function public.noxia_buy_market_offer(uuid,uuid,uuid,integer) to service_role;
