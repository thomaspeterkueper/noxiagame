create unique index if not exists npc_ledger_idempotency_idx
  on public.npc_ledger(actor_id, tick, kind, ref)
  where ref is not null;

create table if not exists public.npc_service_catalog (
  entity_id text not null,
  service_code text not null,
  need_code text not null,
  price_credits integer not null check (price_credits > 0),
  satisfaction_gain numeric not null check (satisfaction_gain > 0 and satisfaction_gain <= 1),
  min_interval_ticks integer not null default 6 check (min_interval_ticks > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_id, service_code)
);

alter table public.npc_service_catalog enable row level security;
revoke all on public.npc_service_catalog from anon, authenticated;
grant select, insert, update, delete on public.npc_service_catalog to service_role;
drop policy if exists npc_service_catalog_service on public.npc_service_catalog;
create policy npc_service_catalog_service on public.npc_service_catalog
for all to service_role using (true) with check (true);

insert into public.npc_service_catalog(
  entity_id,service_code,need_code,price_credits,satisfaction_gain,min_interval_ticks
) values
  ('cafe','cafe_meal','sustenance',8,0.22,6),
  ('community_food_hall','food_hall_meal','sustenance',6,0.28,6)
on conflict (entity_id,service_code) do update set
  need_code=excluded.need_code,
  price_credits=excluded.price_credits,
  satisfaction_gain=excluded.satisfaction_gain,
  min_interval_ticks=excluded.min_interval_ticks,
  active=true,
  updated_at=now();

create table if not exists public.person_consumption_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  buyer_actor_id uuid not null references public.actors(id) on delete cascade,
  seller_actor_id uuid not null references public.actors(id) on delete cascade,
  tile_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  service_code text not null,
  need_code text not null,
  price_credits integer not null check (price_credits > 0),
  satisfaction_gain numeric not null,
  tick bigint not null,
  created_at timestamptz not null default now(),
  unique (person_id, service_code, tick)
);

create index if not exists person_consumption_events_person_tick_idx
  on public.person_consumption_events(person_id, tick desc);
create index if not exists person_consumption_events_buyer_idx
  on public.person_consumption_events(buyer_actor_id);
create index if not exists person_consumption_events_seller_idx
  on public.person_consumption_events(seller_actor_id);
create index if not exists person_consumption_events_tile_idx
  on public.person_consumption_events(tile_entity_id);

alter table public.person_consumption_events enable row level security;
revoke all on public.person_consumption_events from anon, authenticated;
grant select, insert, update, delete on public.person_consumption_events to service_role;
drop policy if exists person_consumption_events_service on public.person_consumption_events;
create policy person_consumption_events_service on public.person_consumption_events
for all to service_role using (true) with check (true);

create or replace function public.run_npc_consumption(p_tick bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person record;
  v_offer record;
  v_buyer_balance numeric;
  v_event_id uuid;
  v_ref text;
  v_bought integer := 0;
  v_no_money integer := 0;
  v_no_seller integer := 0;
  v_total integer := 0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_CONSUMPTION_TICK_INVALID'; end if;
  if mod(p_tick,6) <> 0 then
    return jsonb_build_object('ok',true,'due',false,'bought',0,'no_money',0,'no_seller',0,'total_credits',0);
  end if;

  for v_person in
    select p.id person_id,p.current_location_id,pn.satisfaction,pea.actor_id buyer_actor_id
    from public.people p
    join public.person_needs pn on pn.person_id=p.id and pn.need_code='sustenance'
    join public.person_economic_actors pea on pea.person_id=p.id
    left join public.person_life_state pls on pls.person_id=p.id
    where pn.satisfaction < 0.65
      and coalesce(pls.life_stage,'adult')='adult'
      and p.current_location_id is not null
    order by pn.satisfaction asc,p.id
  loop
    select te.id tile_entity_id,c.service_code,c.need_code,c.price_credits,
           c.satisfaction_gain,c.min_interval_ticks,
           coalesce(te.actor_id,pea.actor_id,lpa.actor_id) seller_actor_id
    into v_offer
    from public.tile_entities te
    join public.npc_service_catalog c on c.entity_id=te.entity_id and c.active=true
    left join public.profile_economic_actors pea on pea.profile_id=te.profile_id
    left join public.location_public_actors lpa on lpa.location_id=te.location_id
    where te.location_id=v_person.current_location_id
      and c.need_code='sustenance'
      and (
        te.actor_id is not null
        or (te.owner_class='PLAYER' and pea.actor_id is not null)
        or (te.owner_class='STATE' and lpa.actor_id is not null)
      )
      and not exists (
        select 1 from public.person_consumption_events e
        where e.person_id=v_person.person_id
          and e.service_code=c.service_code
          and e.tick > p_tick-c.min_interval_ticks
      )
    order by c.price_credits asc,te.id
    limit 1;

    if not found then v_no_seller:=v_no_seller+1; continue; end if;

    select coalesce(sum(credit_delta),0) into v_buyer_balance
    from public.npc_ledger where actor_id=v_person.buyer_actor_id;

    if v_buyer_balance < v_offer.price_credits then v_no_money:=v_no_money+1; continue; end if;

    insert into public.person_consumption_events(
      person_id,buyer_actor_id,seller_actor_id,tile_entity_id,
      service_code,need_code,price_credits,satisfaction_gain,tick
    ) values (
      v_person.person_id,v_person.buyer_actor_id,v_offer.seller_actor_id,v_offer.tile_entity_id,
      v_offer.service_code,v_offer.need_code,v_offer.price_credits,v_offer.satisfaction_gain,p_tick
    )
    on conflict (person_id,service_code,tick) do nothing
    returning id into v_event_id;

    if v_event_id is null then continue; end if;

    v_ref := 'consumption:' || v_event_id::text;

    insert into public.npc_ledger(actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note)
    values (
      v_person.buyer_actor_id,p_tick,'expense',0,-v_offer.price_credits,
      v_person.current_location_id,v_ref,'Alltagskonsum: ' || v_offer.service_code
    );

    insert into public.npc_ledger(actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note)
    values (
      v_offer.seller_actor_id,p_tick,'income',0,v_offer.price_credits,
      v_person.current_location_id,v_ref,'Verkauf: ' || v_offer.service_code
    );

    update public.person_needs
    set satisfaction=least(1,satisfaction+v_offer.satisfaction_gain),updated_tick=p_tick
    where person_id=v_person.person_id and need_code=v_offer.need_code;

    v_bought:=v_bought+1;
    v_total:=v_total+v_offer.price_credits;
  end loop;

  return jsonb_build_object('ok',true,'due',true,'bought',v_bought,'no_money',v_no_money,'no_seller',v_no_seller,'total_credits',v_total);
end;
$$;

revoke all on function public.run_npc_consumption(bigint) from public;
revoke all on function public.run_npc_consumption(bigint) from anon;
revoke all on function public.run_npc_consumption(bigint) from authenticated;
grant execute on function public.run_npc_consumption(bigint) to service_role;
