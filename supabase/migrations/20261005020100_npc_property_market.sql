create table if not exists public.npc_property_transactions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  buyer_actor_id uuid not null references public.actors(id) on delete cascade,
  seller_actor_id uuid not null references public.actors(id) on delete cascade,
  tile_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  price_credits integer not null check (price_credits > 0),
  tick bigint not null,
  created_at timestamptz not null default now(),
  unique (tile_entity_id, tick)
);

create index if not exists npc_property_transactions_person_idx
  on public.npc_property_transactions(person_id, tick desc);
create index if not exists npc_property_transactions_buyer_idx
  on public.npc_property_transactions(buyer_actor_id);
create index if not exists npc_property_transactions_seller_idx
  on public.npc_property_transactions(seller_actor_id);

alter table public.npc_property_transactions enable row level security;
revoke all on public.npc_property_transactions from anon, authenticated;
grant select, insert, update, delete on public.npc_property_transactions to service_role;
drop policy if exists npc_property_transactions_service on public.npc_property_transactions;
create policy npc_property_transactions_service on public.npc_property_transactions
for all to service_role using (true) with check (true);

create or replace function public.run_npc_property_market(p_tick bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person record;
  v_offer record;
  v_balance numeric;
  v_daily_wage integer;
  v_reserve integer;
  v_event_id uuid;
  v_ref text;
  v_bought integer := 0;
  v_total integer := 0;
  v_no_offer integer := 0;
  v_no_money integer := 0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_PROPERTY_TICK_INVALID'; end if;
  if mod(p_tick,24) <> 0 then
    return jsonb_build_object('ok',true,'due',false,'bought',0,'no_offer',0,'no_money',0,'total_credits',0);
  end if;

  for v_person in
    select p.id person_id,p.current_location_id,pea.actor_id buyer_actor_id,pa.role_code
    from public.people p
    join public.person_economic_actors pea on pea.person_id=p.id
    join public.person_assignments pa
      on pa.person_id=p.id and pa.assignment_type='work' and pa.is_active=true
    left join public.person_life_state pls on pls.person_id=p.id
    where coalesce(pls.life_stage,'adult')='adult'
      and p.current_location_id is not null
      and not exists (
        select 1 from public.tile_entities owned
        where owned.actor_id=pea.actor_id
          and owned.owner_class='NPC'
          and owned.entity_type='building'
          and owned.entity_id in ('habitat','residential_block','habitat_cluster')
      )
    order by p.id
  loop
    select daily_credits into v_daily_wage
    from public.role_wage_rates
    where role_code=v_person.role_code;
    if v_daily_wage is null then continue; end if;

    v_reserve := v_daily_wage*7;

    select coalesce(sum(credit_delta),0) into v_balance
    from public.npc_ledger
    where actor_id=v_person.buyer_actor_id;

    select te.id tile_entity_id,te.asking_price,
           coalesce(te.actor_id,pea.actor_id,lpa.actor_id) seller_actor_id
    into v_offer
    from public.tile_entities te
    left join public.profile_economic_actors pea on pea.profile_id=te.profile_id
    left join public.location_public_actors lpa on lpa.location_id=te.location_id
    where te.location_id=v_person.current_location_id
      and te.entity_type='building'
      and te.entity_id in ('habitat','residential_block','habitat_cluster')
      and te.status='active'
      and te.asking_price is not null
      and te.asking_price>0
      and te.actor_id is distinct from v_person.buyer_actor_id
      and (
        te.actor_id is not null
        or (te.owner_class='PLAYER' and pea.actor_id is not null)
        or (te.owner_class='STATE' and lpa.actor_id is not null)
      )
    order by te.asking_price asc,te.id
    limit 1
    for update of te;

    if not found then v_no_offer:=v_no_offer+1; continue; end if;
    if v_balance < v_offer.asking_price + v_reserve then v_no_money:=v_no_money+1; continue; end if;

    insert into public.npc_property_transactions(
      person_id,buyer_actor_id,seller_actor_id,tile_entity_id,price_credits,tick
    ) values (
      v_person.person_id,v_person.buyer_actor_id,v_offer.seller_actor_id,
      v_offer.tile_entity_id,v_offer.asking_price,p_tick
    )
    on conflict (tile_entity_id,tick) do nothing
    returning id into v_event_id;
    if v_event_id is null then continue; end if;

    v_ref := 'property:' || v_event_id::text;

    insert into public.npc_ledger(actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note)
    values (
      v_person.buyer_actor_id,p_tick,'property_purchase',0,-v_offer.asking_price,
      v_person.current_location_id,v_ref,'Immobilienkauf'
    );

    insert into public.npc_ledger(actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note)
    values (
      v_offer.seller_actor_id,p_tick,'income',0,v_offer.asking_price,
      v_person.current_location_id,v_ref,'Immobilienverkauf'
    );

    update public.tile_entities
    set profile_id=null,actor_id=v_person.buyer_actor_id,is_state_owned=false,
        owner_class='NPC',owner_id=v_person.buyer_actor_id,asking_price=null
    where id=v_offer.tile_entity_id;

    v_bought:=v_bought+1;
    v_total:=v_total+v_offer.asking_price;
  end loop;

  return jsonb_build_object('ok',true,'due',true,'bought',v_bought,'no_offer',v_no_offer,'no_money',v_no_money,'total_credits',v_total);
end;
$$;

revoke all on function public.run_npc_property_market(bigint) from public;
revoke all on function public.run_npc_property_market(bigint) from anon;
revoke all on function public.run_npc_property_market(bigint) from authenticated;
grant execute on function public.run_npc_property_market(bigint) to service_role;
