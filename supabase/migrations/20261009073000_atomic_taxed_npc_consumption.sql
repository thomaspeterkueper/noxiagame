-- NOXIA-FIN-0001 / G1
-- Make NPC consumption an atomic taxed transfer.
-- With tax_transaction = 0 this is behaviorally identical to the existing
-- buyer -> seller transfer. A non-zero rate carves tax out of the gross price;
-- it never adds tax on top and never creates credits.

set search_path to public;

alter table public.person_consumption_events
  add column if not exists transaction_tax_rate numeric not null default 0
    check (transaction_tax_rate >= 0 and transaction_tax_rate <= 1),
  add column if not exists transaction_tax_credits integer not null default 0
    check (transaction_tax_credits >= 0),
  add column if not exists seller_net_credits integer;

update public.person_consumption_events
set seller_net_credits = price_credits - transaction_tax_credits
where seller_net_credits is null;

alter table public.person_consumption_events
  alter column seller_net_credits set not null;

create unique index if not exists colony_ledger_tax_transaction_once
  on public.colony_ledger(note)
  where entry_type='tax_transaction';

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
  v_tax_rate numeric;
  v_tax integer;
  v_net integer;
  v_bought integer := 0;
  v_no_money integer := 0;
  v_no_seller integer := 0;
  v_total integer := 0;
  v_tax_total integer := 0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_CONSUMPTION_TICK_INVALID'; end if;
  if mod(p_tick,6) <> 0 then
    return jsonb_build_object(
      'ok',true,'due',false,'bought',0,'no_money',0,'no_seller',0,
      'total_credits',0,'tax_credits',0
    );
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

    if v_buyer_balance < v_offer.price_credits then
      v_no_money:=v_no_money+1;
      continue;
    end if;

    select least(1,greatest(0,coalesce(cs.tax_transaction,0)))
      into v_tax_rate
    from public.colony_settings cs
    where cs.location_id=v_person.current_location_id;

    v_tax_rate := coalesce(v_tax_rate,0);
    v_tax := least(
      v_offer.price_credits,
      greatest(0,round(v_offer.price_credits*v_tax_rate)::integer)
    );
    v_net := v_offer.price_credits-v_tax;

    insert into public.person_consumption_events(
      person_id,buyer_actor_id,seller_actor_id,tile_entity_id,
      service_code,need_code,price_credits,satisfaction_gain,tick,
      transaction_tax_rate,transaction_tax_credits,seller_net_credits
    ) values (
      v_person.person_id,v_person.buyer_actor_id,v_offer.seller_actor_id,v_offer.tile_entity_id,
      v_offer.service_code,v_offer.need_code,v_offer.price_credits,v_offer.satisfaction_gain,p_tick,
      v_tax_rate,v_tax,v_net
    )
    on conflict (person_id,service_code,tick) do nothing
    returning id into v_event_id;

    if v_event_id is null then continue; end if;

    v_ref := 'consumption:' || v_event_id::text;

    -- One statement: either all monetary postings happen, or none do.
    with debit as (
      insert into public.npc_ledger(
        actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note
      ) values (
        v_person.buyer_actor_id,p_tick,'expense',0,-v_offer.price_credits,
        v_person.current_location_id,v_ref,'Alltagskonsum: ' || v_offer.service_code
      )
      on conflict do nothing
      returning 1
    ),
    seller as (
      insert into public.npc_ledger(
        actor_id,tick,kind,goods_delta,credit_delta,location_id,ref,note
      )
      select
        v_offer.seller_actor_id,p_tick,'income',0,v_net,
        v_person.current_location_id,v_ref,'Verkauf netto: ' || v_offer.service_code
      from debit
      returning 1
    )
    insert into public.colony_ledger(
      location_id,tick,entry_type,profile_id,resource_type,amount,note
    )
    select
      v_person.current_location_id,p_tick,'tax_transaction',null,null,v_tax,
      'Konsumsteuer (' || v_ref || ')'
    from seller
    where v_tax>0
    on conflict do nothing;

    update public.person_needs
    set satisfaction=least(1,satisfaction+v_offer.satisfaction_gain),updated_tick=p_tick
    where person_id=v_person.person_id and need_code=v_offer.need_code;

    v_bought:=v_bought+1;
    v_total:=v_total+v_offer.price_credits;
    v_tax_total:=v_tax_total+v_tax;
  end loop;

  return jsonb_build_object(
    'ok',true,'due',true,'bought',v_bought,'no_money',v_no_money,
    'no_seller',v_no_seller,'total_credits',v_total,'tax_credits',v_tax_total
  );
end;
$$;

revoke all on function public.run_npc_consumption(bigint) from public,anon,authenticated;
grant execute on function public.run_npc_consumption(bigint) to service_role;

comment on function public.run_npc_consumption(bigint) is
  'Atomic NPC service purchase. Gross buyer debit = seller net + transaction tax. Tax rate comes from colony_settings.tax_transaction.';
