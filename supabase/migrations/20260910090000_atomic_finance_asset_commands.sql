-- NOXIA atomic finance + asset commands v1
-- 2026-09-10
--
-- Phase B of the shared Game Core transaction boundary.
-- Keeps bank mutations, spot trades and ship type purchases atomic and
-- service-role-only. Read models remain in the existing API routes.

set search_path to public;

-- Production already carries this compatibility pointer; a fresh repository
-- rebuild did not. Reconcile additively so ship activation is reproducible.
alter table public.profiles
  add column if not exists active_ship_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_active_ship_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_active_ship_id_fkey
      foreign key (active_ship_id) references public.ships(id) on delete set null;
  end if;
end
$$;

create index if not exists idx_bank_accounts_location_id
  on public.bank_accounts(location_id);
create index if not exists idx_bank_ledger_profile_id
  on public.bank_ledger(profile_id);
create index if not exists idx_bank_ledger_location_id
  on public.bank_ledger(location_id);

-- ---------------------------------------------------------------------------
-- Bank
-- ---------------------------------------------------------------------------
create or replace function public.noxia_bank_mutation(
  p_profile_id uuid,
  p_location_id uuid,
  p_action text,
  p_amount integer,
  p_credit_limit integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_account public.bank_accounts%rowtype;
  v_amount integer := p_amount;
  v_repay integer;
  v_new_deposit numeric;
  v_new_loan numeric;
  v_entry_type text;
  v_note text;
begin
  if p_profile_id is null or p_location_id is null then
    raise exception 'NOXIA_BANK_REQUIRED_ARGUMENT_MISSING' using errcode = 'P0001';
  end if;

  if p_action not in ('deposit', 'withdraw', 'loan', 'repay') then
    raise exception 'NOXIA_BANK_ACTION_INVALID:%', coalesce(p_action, '<null>') using errcode = 'P0001';
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'NOXIA_BANK_AMOUNT_INVALID' using errcode = 'P0001';
  end if;

  -- Mutations are only valid at an actual bank. The API already checks this;
  -- enforcing it again here keeps the database command authoritative.
  if not exists (
    select 1
    from public.tile_entities
    where location_id = p_location_id
      and entity_type = 'building'
      and entity_id = 'bank'
  ) then
    raise exception 'NOXIA_BANK_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  -- Lock the player wallet first. Bank operations never acquire ship locks,
  -- so this does not create a cycle with trade/ship commands.
  select credits into v_credits
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.bank_accounts(profile_id, location_id, deposit, loan)
  values (p_profile_id, p_location_id, 0, 0)
  on conflict (profile_id, location_id) do nothing;

  select * into v_account
  from public.bank_accounts
  where profile_id = p_profile_id and location_id = p_location_id
  for update;

  if not found then
    raise exception 'NOXIA_BANK_ACCOUNT_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_new_deposit := v_account.deposit;
  v_new_loan := v_account.loan;

  if p_action = 'deposit' then
    if v_amount < 10 then
      raise exception 'NOXIA_BANK_MIN_DEPOSIT:10' using errcode = 'P0001';
    end if;
    if v_credits < v_amount then
      raise exception 'NOXIA_BANK_CREDITS_INSUFFICIENT' using errcode = 'P0001';
    end if;

    v_credits := v_credits - v_amount;
    v_new_deposit := v_account.deposit + v_amount;
    v_entry_type := 'deposit';
    v_note := format('Einzahlung %s Cr', v_amount);

    update public.profiles set credits = v_credits where id = p_profile_id;
    update public.bank_accounts
      set deposit = v_new_deposit, updated_at = now()
      where id = v_account.id;

  elsif p_action = 'withdraw' then
    if v_account.deposit < v_amount then
      raise exception 'NOXIA_BANK_DEPOSIT_INSUFFICIENT:%', v_account.deposit using errcode = 'P0001';
    end if;

    v_credits := v_credits + v_amount;
    v_new_deposit := v_account.deposit - v_amount;
    v_entry_type := 'withdrawal';
    v_note := format('Auszahlung %s Cr', v_amount);

    update public.profiles set credits = v_credits where id = p_profile_id;
    update public.bank_accounts
      set deposit = v_new_deposit, updated_at = now()
      where id = v_account.id;

  elsif p_action = 'loan' then
    if v_amount < 100 then
      raise exception 'NOXIA_BANK_MIN_LOAN:100' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.academy_completions
      where profile_id = p_profile_id
        and module_id = 'ECO-L0-000001'
    ) then
      raise exception 'NOXIA_BANK_CREDIT_CLEARANCE_REQUIRED:ECO-L0-000001' using errcode = 'P0001';
    end if;

    if p_credit_limit is null or p_credit_limit < 0 then
      raise exception 'NOXIA_BANK_CREDIT_LIMIT_REQUIRED' using errcode = 'P0001';
    end if;

    if v_account.loan + v_amount > p_credit_limit then
      raise exception 'NOXIA_BANK_CREDIT_LIMIT_EXCEEDED:%', greatest(0, p_credit_limit - v_account.loan)::integer using errcode = 'P0001';
    end if;

    v_credits := v_credits + v_amount;
    v_new_loan := v_account.loan + v_amount;
    v_entry_type := 'loan_taken';
    v_note := format('Kredit aufgenommen: %s Cr (Schulden gesamt: %s Cr)', v_amount, v_new_loan);

    update public.profiles set credits = v_credits where id = p_profile_id;
    update public.bank_accounts
      set loan = v_new_loan, updated_at = now()
      where id = v_account.id;

  else -- repay
    if v_account.loan <= 0 then
      raise exception 'NOXIA_BANK_NO_OUTSTANDING_LOAN' using errcode = 'P0001';
    end if;

    v_repay := least(v_amount, v_account.loan::integer);
    if v_credits < v_repay then
      raise exception 'NOXIA_BANK_CREDITS_INSUFFICIENT:%', v_repay using errcode = 'P0001';
    end if;

    v_credits := v_credits - v_repay;
    v_new_loan := v_account.loan - v_repay;
    v_amount := v_repay;
    v_entry_type := 'loan_repaid';
    v_note := format('Kredit getilgt: %s Cr (Restschuld: %s Cr)', v_repay, v_new_loan);

    update public.profiles set credits = v_credits where id = p_profile_id;
    update public.bank_accounts
      set loan = v_new_loan, updated_at = now()
      where id = v_account.id;
  end if;

  insert into public.bank_ledger(
    profile_id, location_id, entry_type, amount, balance_after, note
  ) values (
    p_profile_id,
    p_location_id,
    v_entry_type,
    v_amount,
    case when p_action in ('deposit', 'withdraw') then v_new_deposit else v_new_loan end,
    v_note
  );

  return jsonb_build_object(
    'action', p_action,
    'amount', v_amount,
    'credits', v_credits,
    'deposit', v_new_deposit,
    'loan', v_new_loan
  );
end;
$$;

revoke all on function public.noxia_bank_mutation(uuid,uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.noxia_bank_mutation(uuid,uuid,text,integer,integer) to service_role;

comment on function public.noxia_bank_mutation(uuid,uuid,text,integer,integer) is
  'Atomically mutates the player wallet, bank account and bank ledger for deposit/withdraw/loan/repay.';

-- ---------------------------------------------------------------------------
-- Spot trade
-- ---------------------------------------------------------------------------
create or replace function public.noxia_spot_trade(
  p_profile_id uuid,
  p_action text,
  p_resource text,
  p_amount integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ship public.ships%rowtype;
  v_profile public.profiles%rowtype;
  v_location public.locations%rowtype;
  v_market public.market_prices%rowtype;
  v_resource public.resource_type;
  v_tax_rate numeric := 0;
  v_current_tick bigint := 0;
  v_cargo_used integer := 0;
  v_cargo_amount integer := 0;
  v_new_cargo integer := 0;
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
  if p_profile_id is null or p_resource is null then
    raise exception 'NOXIA_SPOT_REQUIRED_ARGUMENT_MISSING' using errcode = 'P0001';
  end if;
  if p_action not in ('buy', 'sell') then
    raise exception 'NOXIA_SPOT_ACTION_INVALID:%', coalesce(p_action, '<null>') using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'NOXIA_SPOT_AMOUNT_INVALID' using errcode = 'P0001';
  end if;

  begin
    v_resource := p_resource::public.resource_type;
  exception when invalid_text_representation then
    raise exception 'NOXIA_SPOT_RESOURCE_INVALID:%', p_resource using errcode = 'P0001';
  end;

  -- Active ship is authoritative. Legacy saves without an active flag fall
  -- back to their oldest ship, matching the read path.
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

  -- Lock all cargo rows for the ship before capacity is calculated so two
  -- concurrent buys cannot overfill the hold.
  perform 1
  from public.ship_cargo
  where ship_id = v_ship.id
  order by id
  for update;

  select coalesce(sum(amount), 0)::integer
  into v_cargo_used
  from public.ship_cargo
  where ship_id = v_ship.id;

  select amount into v_cargo_amount
  from public.ship_cargo
  where ship_id = v_ship.id and resource = v_resource;
  if not found then v_cargo_amount := 0; end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_location
  from public.locations
  where slug = v_ship.location;

  if not found then
    raise exception 'NOXIA_LOCATION_NOT_FOUND:%', v_ship.location using errcode = 'P0001';
  end if;

  select * into v_market
  from public.market_prices
  where location_id = v_location.id and resource = v_resource
  for update;

  if not found then
    raise exception 'NOXIA_MARKET_PRICE_NOT_FOUND:%', p_resource using errcode = 'P0001';
  end if;

  select coalesce(tax_transaction, 0)
  into v_tax_rate
  from public.colony_settings
  where location_id = v_location.id;
  if not found then v_tax_rate := 0; end if;

  select coalesce(max(tick_number), 0)::bigint into v_current_tick
  from public.tick_log;

  -- Client-provided prices are intentionally absent from this command.
  -- Spot execution always uses the authoritative server market price.
  if p_action = 'buy' then
    v_unit_price := v_market.buy_price;
    v_max_by_cargo := greatest(0, v_ship.cargo_max - v_cargo_used);

    if v_unit_price <= 0 then
      v_max_by_credits := p_amount;
    else
      v_max_by_credits := floor(v_profile.credits / (v_unit_price * (1 + v_tax_rate)))::integer;
    end if;

    v_booked := least(p_amount, v_max_by_cargo, greatest(0, v_max_by_credits));
    if v_booked <= 0 then
      if v_max_by_cargo <= 0 then
        raise exception 'NOXIA_SPOT_CARGO_FULL' using errcode = 'P0001';
      else
        raise exception 'NOXIA_SPOT_CREDITS_INSUFFICIENT' using errcode = 'P0001';
      end if;
    end if;

    v_goods := v_unit_price * v_booked;
    v_tax := round(v_tax_rate * v_goods)::integer;
    while v_booked > 0 and v_goods + v_tax > v_profile.credits loop
      v_booked := v_booked - 1;
      v_goods := v_unit_price * v_booked;
      v_tax := round(v_tax_rate * v_goods)::integer;
    end loop;
    if v_booked <= 0 then
      raise exception 'NOXIA_SPOT_CREDITS_INSUFFICIENT' using errcode = 'P0001';
    end if;

    v_new_credits := v_profile.credits - v_goods - v_tax;
    v_new_cargo := v_cargo_amount + v_booked;
    v_profit := -(v_goods + v_tax);
  else
    v_unit_price := v_market.sell_price;
    v_booked := least(p_amount, v_cargo_amount);
    if v_booked <= 0 then
      raise exception 'NOXIA_SPOT_CARGO_INSUFFICIENT' using errcode = 'P0001';
    end if;

    v_goods := v_unit_price * v_booked;
    v_tax := round(v_tax_rate * v_goods)::integer;
    v_new_credits := v_profile.credits + v_goods - v_tax;
    v_new_cargo := v_cargo_amount - v_booked;
    v_profit := v_goods - v_tax;
  end if;

  update public.profiles
  set credits = v_new_credits
  where id = p_profile_id;

  if v_new_cargo > 0 then
    insert into public.ship_cargo(ship_id, resource, amount)
    values (v_ship.id, v_resource, v_new_cargo)
    on conflict (ship_id, resource) do update set amount = excluded.amount;
  else
    delete from public.ship_cargo
    where ship_id = v_ship.id and resource = v_resource;
  end if;

  insert into public.trade_transactions(
    profile_id, from_location, to_location, resource, amount, profit
  ) values (
    p_profile_id, v_ship.location, v_ship.location, v_resource, v_booked, v_profit
  );

  if v_tax > 0 then
    insert into public.colony_ledger(
      location_id, tick, entry_type, profile_id, resource_type, amount, note
    ) values (
      v_location.id,
      v_current_tick,
      'tax_transaction',
      p_profile_id,
      v_resource::text,
      v_tax,
      format('Transaktionssteuer %s %st %s', p_action, v_booked, v_resource::text)
    );
  end if;

  v_new_buy := v_market.buy_price;
  v_new_sell := v_market.sell_price;

  if p_action = 'buy' then
    v_new_buy := least(200, round(v_market.buy_price * (1 + 0.003 * v_booked))::integer);
  else
    v_new_sell := greatest(10, round(v_market.sell_price * (1 - 0.003 * v_booked))::integer);
  end if;
  if v_new_sell >= v_new_buy then v_new_sell := v_new_buy - 1; end if;

  if v_new_buy <> v_market.buy_price or v_new_sell <> v_market.sell_price then
    update public.market_prices
    set buy_price = v_new_buy,
        sell_price = v_new_sell,
        updated_at = now()
    where id = v_market.id;
    v_price_changed := true;
  end if;

  return jsonb_build_object(
    'action', p_action,
    'ship_id', v_ship.id,
    'ship_type_id', coalesce(v_ship.ship_type_id, 'freighter_mk1'),
    'location', v_ship.location,
    'resource', v_resource::text,
    'booked_amount', v_booked,
    'requested_amount', p_amount,
    'unit_price', v_unit_price,
    'tax_charged', v_tax,
    'tax_rate', v_tax_rate,
    'profit', v_profit,
    'credits', v_new_credits,
    'cargo_amount', v_new_cargo,
    'cargo_max', v_ship.cargo_max,
    'market_buy_price', v_new_buy,
    'market_sell_price', v_new_sell,
    'price_changed', v_price_changed,
    'username', v_profile.username
  );
end;
$$;

revoke all on function public.noxia_spot_trade(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.noxia_spot_trade(uuid,text,text,integer) to service_role;

comment on function public.noxia_spot_trade(uuid,text,text,integer) is
  'Atomically executes a server-priced spot buy/sell across wallet, active-ship cargo, trade history, colony tax ledger and market-price impulse.';

-- ---------------------------------------------------------------------------
-- Ship type purchase / upgrade
-- ---------------------------------------------------------------------------
create or replace function public.noxia_buy_ship_type(
  p_profile_id uuid,
  p_ship_type_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ship public.ships%rowtype;
  v_ship_type public.ship_types%rowtype;
  v_credits integer;
begin
  if p_profile_id is null or p_ship_type_id is null or btrim(p_ship_type_id) = '' then
    raise exception 'NOXIA_SHIP_PURCHASE_REQUIRED_ARGUMENT_MISSING' using errcode = 'P0001';
  end if;

  select * into v_ship_type
  from public.ship_types
  where id = p_ship_type_id;

  if not found then
    raise exception 'NOXIA_SHIP_TYPE_NOT_FOUND:%', p_ship_type_id using errcode = 'P0001';
  end if;

  -- Lock all owned ships in a deterministic order. This serializes concurrent
  -- activation/type-change requests and preserves the single-active invariant.
  perform 1
  from public.ships
  where profile_id = p_profile_id
  order by id
  for update;

  select * into v_ship
  from public.ships
  where profile_id = p_profile_id and coalesce(is_active, false) = true
  order by created_at, id
  limit 1;

  if not found then
    select * into v_ship
    from public.ships
    where profile_id = p_profile_id
    order by created_at, id
    limit 1;
  end if;

  if not found then
    raise exception 'NOXIA_SHIP_NOT_FOUND' using errcode = 'P0001';
  end if;

  select credits into v_credits
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'NOXIA_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_ship.ship_type_id is not distinct from p_ship_type_id then
    raise exception 'NOXIA_SHIP_TYPE_ALREADY_OWNED' using errcode = 'P0001';
  end if;

  if v_ship.location is distinct from v_ship_type.available_at then
    raise exception 'NOXIA_SHIP_TYPE_WRONG_LOCATION:%', v_ship_type.available_at using errcode = 'P0001';
  end if;

  if v_credits < v_ship_type.cost_credits then
    raise exception 'NOXIA_SHIP_PURCHASE_CREDITS_INSUFFICIENT' using errcode = 'P0001';
  end if;

  v_credits := v_credits - v_ship_type.cost_credits;

  update public.profiles
  set credits = v_credits,
      active_ship_id = v_ship.id
  where id = p_profile_id;

  update public.ships
  set is_active = false
  where profile_id = p_profile_id and id <> v_ship.id and coalesce(is_active, false) = true;

  update public.ships
  set ship_type_id = p_ship_type_id,
      cargo_max = v_ship_type.cargo_max,
      is_active = true
  where id = v_ship.id;

  -- Preserve existing game semantics: changing ship type clears the selected
  -- ship's hold. The operation is now atomic, so credits can never be charged
  -- while the type/cargo transition only partially succeeds.
  delete from public.ship_cargo where ship_id = v_ship.id;

  return jsonb_build_object(
    'ship_id', v_ship.id,
    'ship_type_id', p_ship_type_id,
    'new_credits', v_credits,
    'cargo_max', v_ship_type.cargo_max,
    'speed_mult', v_ship_type.speed_mult,
    'location', v_ship.location
  );
end;
$$;

revoke all on function public.noxia_buy_ship_type(uuid,text) from public, anon, authenticated;
grant execute on function public.noxia_buy_ship_type(uuid,text) to service_role;

comment on function public.noxia_buy_ship_type(uuid,text) is
  'Atomically charges credits, updates/activates the selected legacy ship row and clears its cargo for a ship-type purchase.';
