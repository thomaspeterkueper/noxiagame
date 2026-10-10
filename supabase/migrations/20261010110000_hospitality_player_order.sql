-- NOXIA-FIN-0001 / G1 — Bestellung eines Spielers in einem Lokal.
-- Ein besteuerter Transfer: Gast -> Betreiber (netto) + Koloniekasse (Steuer).
-- Die Steuer wird aus dem Preis herausgerechnet, es entstehen keine Credits.
-- Wer den Preis nicht hat, kann nicht bestellen (wie beim Kauf von Waren).

begin;

create table if not exists public.hospitality_menu (
  entity_id text not null,
  item_code text not null,
  label text not null,
  price_credits integer not null check (price_credits > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (entity_id, item_code)
);

alter table public.hospitality_menu enable row level security;
revoke all on public.hospitality_menu from anon, authenticated;
grant select, insert, update, delete on public.hospitality_menu to service_role;
drop policy if exists hospitality_menu_service on public.hospitality_menu;
create policy hospitality_menu_service on public.hospitality_menu
  for all to service_role using (true) with check (true);

insert into public.hospitality_menu(entity_id,item_code,label,price_credits) values
  ('cafe','drink','Getränk',3),
  ('cafe','cake','Kuchen',5),
  ('cafe','meal','Mahlzeit',8)
on conflict (entity_id,item_code) do nothing;

create table if not exists public.player_hospitality_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tile_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  seller_actor_id uuid not null references public.actors(id),
  item_code text not null,
  price_credits integer not null check (price_credits > 0),
  transaction_tax_rate numeric not null default 0 check (transaction_tax_rate >= 0 and transaction_tax_rate <= 1),
  transaction_tax_credits integer not null default 0 check (transaction_tax_credits >= 0),
  seller_net_credits integer not null check (seller_net_credits >= 0),
  tick bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists player_hospitality_orders_profile on public.player_hospitality_orders(profile_id, created_at desc);

alter table public.player_hospitality_orders enable row level security;
revoke all on public.player_hospitality_orders from anon, authenticated;
grant select, insert on public.player_hospitality_orders to service_role;
drop policy if exists player_hospitality_orders_service on public.player_hospitality_orders;
create policy player_hospitality_orders_service on public.player_hospitality_orders
  for all to service_role using (true) with check (true);

create or replace function public.order_hospitality_item(
  p_profile_id uuid,
  p_tile_entity_id uuid,
  p_item_code text,
  p_request_id uuid,
  p_tick bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_tile public.tile_entities%rowtype;
  v_item public.hospitality_menu%rowtype;
  v_seller uuid;
  v_tax_rate numeric;
  v_tax integer;
  v_net integer;
  v_order public.player_hospitality_orders%rowtype;
  v_ref text;
begin
  if p_profile_id is null or p_tile_entity_id is null or p_item_code is null or p_request_id is null or p_tick is null then
    raise exception 'NOXIA_ORDER_REQUIRED_ARGUMENT_MISSING';
  end if;

  -- Sperrt das Spielerkonto: Prüfung und Abbuchung sind eine Transaktion.
  select credits into v_credits from public.profiles where id=p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;

  -- Dieselbe Anfrage noch einmal: nichts erneut buchen, das alte Ergebnis zurückgeben.
  select * into v_order from public.player_hospitality_orders where request_id=p_request_id;
  if found then
    if v_order.profile_id <> p_profile_id then raise exception 'NOXIA_ORDER_REQUEST_CONFLICT'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'order_id',v_order.id,
      'price_credits',v_order.price_credits,'tax_credits',v_order.transaction_tax_credits,'credits',v_credits);
  end if;

  select * into v_tile from public.tile_entities
  where id=p_tile_entity_id and entity_type='building' and status='active';
  if not found then raise exception 'NOXIA_ORDER_VENUE_NOT_FOUND'; end if;

  select * into v_item from public.hospitality_menu
  where entity_id=v_tile.entity_id and item_code=p_item_code and active=true;
  if not found then raise exception 'NOXIA_ORDER_ITEM_NOT_OFFERED'; end if;

  select coalesce(
    v_tile.actor_id,
    (select actor_id from public.profile_economic_actors where profile_id=v_tile.profile_id),
    (select actor_id from public.location_public_actors where location_id=v_tile.location_id)
  ) into v_seller;
  if v_seller is null then raise exception 'NOXIA_ORDER_SELLER_ACCOUNT_MISSING'; end if;

  if v_credits < v_item.price_credits then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  select least(1,greatest(0,coalesce(cs.tax_transaction,0))) into v_tax_rate
  from public.colony_settings cs where cs.location_id=v_tile.location_id;
  v_tax_rate := coalesce(v_tax_rate,0);
  v_tax := least(v_item.price_credits, greatest(0, round(v_item.price_credits*v_tax_rate)::integer));
  v_net := v_item.price_credits - v_tax;

  insert into public.player_hospitality_orders(
    request_id,profile_id,tile_entity_id,seller_actor_id,item_code,price_credits,
    transaction_tax_rate,transaction_tax_credits,seller_net_credits,tick
  ) values (
    p_request_id,p_profile_id,p_tile_entity_id,v_seller,p_item_code,v_item.price_credits,
    v_tax_rate,v_tax,v_net,p_tick
  ) returning * into v_order;

  v_ref := 'hospitality_order:' || v_order.id::text;

  update public.profiles set credits = credits - v_item.price_credits where id=p_profile_id;

  if v_net > 0 then
    insert into public.npc_ledger(actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note)
    values (v_seller,p_tick,'income',0,v_net,v_tile.location_id,v_ref,'Verkauf netto: ' || v_item.label);
  end if;

  if v_tax > 0 then
    insert into public.colony_ledger(location_id,tick,entry_type,profile_id,resource_type,amount,note)
    values (v_tile.location_id,p_tick,'tax_transaction',p_profile_id,null,v_tax,'Konsumsteuer (' || v_ref || ')');
  end if;

  return jsonb_build_object(
    'ok',true,'duplicate',false,'order_id',v_order.id,'item_code',p_item_code,'label',v_item.label,
    'price_credits',v_item.price_credits,'tax_credits',v_tax,'seller_net_credits',v_net,
    'credits',v_credits - v_item.price_credits
  );
end;
$$;

revoke all on function public.order_hospitality_item(uuid,uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.order_hospitality_item(uuid,uuid,text,uuid,bigint) to service_role;

comment on function public.order_hospitality_item(uuid,uuid,text,uuid,bigint) is
  'Player orders one menu item: atomic taxed transfer guest -> operator (+ colony tax). Refuses when credits are insufficient. Idempotent per request_id.';

commit;
