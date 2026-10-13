-- NOXIA-LIVING-0013 – Grundversorgung am Hafen (Hafenkantine).
-- Entscheidung Thomas, 13.10.2026: Kantine überall, dauerhaft, Notfallplan auch
-- für arme Bewohner und Spieler. Das eigentliche Lokal bleibt Spielersache.
--
-- 1. Gebäudeart `port_canteen`: staatlich, von Spielern nicht baubar
--    (is_active = false sperrt alle Baupfade, Namen bleiben lesbar).
-- 2. Je Ort mit staatlichem Hafengebäude eine Kantine als Teil des Hafens
--    (parent_id + slot, wie das Café im Q1-Transferknoten). Belegt keine Kachel.
-- 3. Karte für Spieler (Wasser, Ration) und Dienst für Bewohner.
-- 4. run_npc_consumption:
--    a) Lokale vor der Kantine; die Kantine ist Rückfallebene.
--    b) Unter gleichwertigen Lokalen streut die Wahl je Person und Tick
--       (bisher bekam bei Gleichstand immer dasselbe Gebäude alle Käufe).
--    c) Gewählt wird das erste bezahlbare Angebot, nicht das erste überhaupt.
--    d) Notration: Wer nichts bezahlen kann, bekommt in der Kantine eine
--       kleinere Ration ohne Bezahlung. Es fließt kein Geld (keine Emission,
--       kein Transfer); Lebensmittel sind noch keine Ware mit Bestand.
--       Sobald sie es sind, trägt die Koloniekasse die Ration als Fiskaltransfer.

set search_path to public;

begin;

-- 1. Gebäudeart --------------------------------------------------------------
insert into public.building_definitions(
  key,name,description,tier,category,is_active,production,sort_order,consumption,
  cost_credits,build_time_ticks,population_bonus,allowed_locations
) values (
  'port_canteen','Hafenkantine','Grundversorgung im Hafengebäude: Wasser und Ration, rund um die Uhr. Staatlich, nicht baubar.',1,'life',false,'[]'::jsonb,72,'[]'::jsonb,
  0,1,0,null
) on conflict (key) do nothing;

-- 2. Je Ort eine Kantine im staatlichen Hafengebäude -------------------------
with ports as (
  select distinct on (te.location_id) te.id, te.location_id
  from public.tile_entities te
  where te.status='active' and te.parent_id is null
    and te.owner_class='STATE' and te.is_state_owned
    and (te.entity_id like 'landing_pad%'
         or te.entity_id in ('docking_bay','spaceport_core','q1_harbour_district'))
  order by te.location_id,
    (te.entity_id in ('spaceport_core','q1_harbour_district','docking_bay')) desc,
    te.built_at, te.id
)
insert into public.tile_entities(
  location_id,parent_id,slot,entity_type,entity_id,status,
  is_state_owned,owner_class
)
select p.location_id, p.id,
  coalesce((select max(c.slot) from public.tile_entities c where c.parent_id=p.id),0)+1,
  'building','port_canteen','active',true,'STATE'
from ports p
where not exists (
  select 1 from public.tile_entities k
  where k.location_id=p.location_id and k.entity_id='port_canteen' and k.status='active'
);

-- 3. Karte (Spieler) und Dienst (Bewohner) ----------------------------------
insert into public.hospitality_menu(entity_id,item_code,label,price_credits) values
  ('port_canteen','water','Wasser',2),
  ('port_canteen','ration','Ration',6)
on conflict (entity_id,item_code) do nothing;

insert into public.npc_service_catalog(
  entity_id,service_code,need_code,price_credits,satisfaction_gain,min_interval_ticks
) values
  ('port_canteen','canteen_ration','sustenance',6,0.20,6)
on conflict (entity_id,service_code) do nothing;

-- Notration: Preis 0 muss in den Kaufereignissen möglich sein.
alter table public.person_consumption_events
  drop constraint if exists person_consumption_events_price_credits_check;
alter table public.person_consumption_events
  add constraint person_consumption_events_price_credits_check check (price_credits >= 0);

-- 4. Kaufentscheidung der Bewohner -----------------------------------------
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
  v_emergency boolean;
  v_bought integer := 0;
  v_emergency_count integer := 0;
  v_no_money integer := 0;
  v_waiting integer := 0;
  v_no_seller integer := 0;
  v_total integer := 0;
  v_tax_total integer := 0;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_CONSUMPTION_TICK_INVALID'; end if;
  if mod(p_tick,6) <> 0 then
    return jsonb_build_object(
      'ok',true,'due',false,'bought',0,'emergency',0,'waiting',0,'no_money',0,'no_seller',0,
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
    select coalesce(sum(credit_delta),0) into v_buyer_balance
    from public.npc_ledger where actor_id=v_person.buyer_actor_id;

    v_emergency := false;

    -- Erstes bezahlbares Angebot: Lokale vor der Kantine, dann Preis,
    -- dann deterministisch gestreut je Person und Tick.
    select te.id tile_entity_id,te.entity_id,c.service_code,c.need_code,c.price_credits,
           c.satisfaction_gain,c.min_interval_ticks,
           coalesce(te.actor_id,pea.actor_id,lpa.actor_id) seller_actor_id
    into v_offer
    from public.tile_entities te
    join public.npc_service_catalog c on c.entity_id=te.entity_id and c.active=true
    left join public.profile_economic_actors pea on pea.profile_id=te.profile_id
    left join public.location_public_actors lpa on lpa.location_id=te.location_id
    where te.location_id=v_person.current_location_id
      and te.status='active'
      and c.need_code='sustenance'
      and c.price_credits <= v_buyer_balance
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
    order by (te.entity_id='port_canteen') asc, c.price_credits asc,
             md5(v_person.person_id::text || ':' || p_tick::text || ':' || te.id::text)
    limit 1;

    if not found then
      -- Kein bezahlbares Angebot. Notration nur, wenn die Person wirklich nicht
      -- zahlen kann – nicht, wenn sie nur gerade erst gegessen hat.
      if not exists (
        select 1 from public.tile_entities te
        join public.npc_service_catalog c on c.entity_id=te.entity_id and c.active=true
        where te.location_id=v_person.current_location_id and te.status='active'
          and c.need_code='sustenance'
      ) then
        v_no_seller:=v_no_seller+1;
        continue;
      end if;
      if v_buyer_balance >= (
        select min(c.price_credits) from public.tile_entities te
        join public.npc_service_catalog c on c.entity_id=te.entity_id and c.active=true
        where te.location_id=v_person.current_location_id and te.status='active'
          and c.need_code='sustenance'
      ) then
        v_waiting:=v_waiting+1;
        continue;
      end if;

      -- Notration in der Kantine: ohne Bezahlung, kleiner, höchstens alle 6 Ticks.
      select te.id tile_entity_id,te.entity_id,'canteen_emergency_ration'::text service_code,
             'sustenance'::text need_code,0 price_credits,0.12::numeric satisfaction_gain,
             6 min_interval_ticks,lpa.actor_id seller_actor_id
      into v_offer
      from public.tile_entities te
      join public.location_public_actors lpa on lpa.location_id=te.location_id
      where te.location_id=v_person.current_location_id
        and te.status='active' and te.entity_id='port_canteen'
        and not exists (
          select 1 from public.person_consumption_events e
          where e.person_id=v_person.person_id
            and e.service_code='canteen_emergency_ration'
            and e.tick > p_tick-6
        )
      order by te.id
      limit 1;

      if not found then
        -- Kein Geld und keine Kantine am Ort (oder Notration noch in der Wartezeit).
        v_no_money:=v_no_money+1;
        continue;
      end if;
      v_emergency := true;
    end if;

    if v_emergency then
      v_tax_rate := 0; v_tax := 0; v_net := 0;
    else
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
    end if;

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

    if not v_emergency then
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

      v_total:=v_total+v_offer.price_credits;
      v_tax_total:=v_tax_total+v_tax;
      v_bought:=v_bought+1;
    else
      v_emergency_count:=v_emergency_count+1;
    end if;

    update public.person_needs
    set satisfaction=least(1,satisfaction+v_offer.satisfaction_gain),updated_tick=p_tick
    where person_id=v_person.person_id and need_code=v_offer.need_code;
  end loop;

  return jsonb_build_object(
    'ok',true,'due',true,'bought',v_bought,'emergency',v_emergency_count,
    'waiting',v_waiting,'no_money',v_no_money,'no_seller',v_no_seller,
    'total_credits',v_total,'tax_credits',v_tax_total
  );
end;
$$;

revoke all on function public.run_npc_consumption(bigint) from public,anon,authenticated;
grant execute on function public.run_npc_consumption(bigint) to service_role;

comment on function public.run_npc_consumption(bigint) is
  'NPC food purchase (NOXIA-LIVING-0013). Venues before the port canteen, first affordable offer, ties spread per person and tick. Taxed transfer buyer -> seller (+ colony tax). Without money: free smaller emergency ration at the canteen, no money moves.';

commit;
