-- supabase/migrations/20261025210000_venue_staffing.sql
-- Aufgabe 2 (Bevölkerung und Ökonomie, Thomas 25.10.2026: „weiter mit 1“):
-- Lokale stellen Personal ein, bis ihre Personalplätze (tile_entities.staff_capacity,
-- R-13) besetzt sind – erst dann sind Bar und Restaurant geöffnet.
--
--   * run_venue_staffing (jeden Tick, vor der Lohnrunde):
--       0. Der Arbeitgeber folgt dem Eigentümer: Wer ein reales Lokal kauft, zahlt
--          künftig den Lohn seines Personals (Konto des Betreibers, sonst des Spielers,
--          sonst des Ortes).
--       1. Je Lokal mit freiem Platz höchstens eine Einstellung pro Tick, Rolle `service`
--          (Lohn aus role_wage_rates). Ein Arbeitgeber stellt nur ein, wenn sein Konto
--          sieben Tageslöhne seiner ganzen Belegschaft samt der neuen Stelle deckt
--          (LIVING-0010: ein zahlungsunfähiger Arbeitgeber bietet keine Stelle an).
--          Gezählt wird die Lohnsumme seiner Lokale.
--       2. Bewerber: Menschen des Ortes ohne Arbeit, die das Spiel aus dem realen Ort
--          übernommen hat (Bewohner gekaufter Häuser `earth-house:*`, Zugezogene
--          `earth-local:*`), höchstens 5 km entfernt, die nächste zuerst.
--       3. Gibt es auf der Erde niemanden, kommt jemand aus dem realen Ort dazu – wie
--          bei den Bewohnern gekaufter Häuser (Thomas, 25.10.2026: „echte Personen, neu
--          angelegt“): eigenes Konto mit ausgewiesenem Startbestand (Emission nach
--          NOXIA-FIN-0001, Referenz bootstrap:person:<id>), wohnt über dem Lokal, wenn dort
--          eine Wohnung frei ist (Miete an den Eigentümer, R-6), sonst irgendwo im Ort.
--   * Übergangsreserve für die Lokale des Ortes Sundern (Metropol, Balkan Grill):
--     14 Tageslöhne für ihre fünf Stellen an den öffentlichen Akteur der Erde, einmalig
--     und ausgewiesen (Referenz bootstrap:employer:<actor>:venues), wie in
--     20261008150000_employer_funding.sql. Danach tragen Verkäufe die Löhne.
--   * Bewohner kaufen auch in Bar und Restaurant (npc_service_catalog), aber nur, wenn
--     dort jemand arbeitet; ein Café ohne Personal bleibt Automatencafé (Thomas,
--     10.10.2026). Unter mehreren bezahlbaren Lokalen wählt jede Person gestreut, die
--     billigeren häufiger (Wahrscheinlichkeit ∝ 1 / Preis, deterministisch je Person
--     und Tick) – statt immer das billigste (erster Schritt zu Aufgabe 11).

set search_path to public;

-- ── Bar und Restaurant im Alltag der Bewohner ────────────────────────────────
insert into public.npc_service_catalog(entity_id, service_code, need_code, price_credits, satisfaction_gain, min_interval_ticks)
values
  ('bar', 'bar_snack_drink', 'sustenance', 8, 0.18, 6),
  ('restaurant', 'restaurant_main', 'sustenance', 12, 0.32, 6)
on conflict do nothing;

-- ── Übergangsreserve für die Lokale des Ortes ────────────────────────────────
do $$
declare
  v_earth uuid;
  v_actor uuid;
  v_wage integer;
  v_places integer;
  v_tick bigint;
begin
  select id into v_earth from public.locations where slug = 'earth';
  select actor_id into v_actor from public.location_public_actors where location_id = v_earth;
  if v_actor is null then return; end if;
  select daily_credits into v_wage from public.role_wage_rates where role_code = 'service';
  select coalesce(sum(staff_capacity), 0) into v_places from public.tile_entities
   where location_id = v_earth and is_state_owned and entity_id in ('cafe', 'bar', 'restaurant', 'hotel') and source_ref is not null;
  if v_places = 0 or v_wage is null then return; end if;
  if exists (select 1 from public.npc_ledger where actor_id = v_actor and ref = 'bootstrap:employer:' || v_actor::text || ':venues') then return; end if;
  select coalesce(max(tick_number), 0)::bigint into v_tick from public.tick_log;
  insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
  values (v_actor, v_tick, 'endowment', null, 0, 14 * v_wage * v_places, v_earth, 'bootstrap:employer:' || v_actor::text || ':venues',
          'Bootstrap-Übergangsreserve: 14 Tageslöhne für das Personal der Lokale des Ortes (Metropol, Balkan Grill)');
end $$;

-- ── Personal einstellen ──────────────────────────────────────────────────────
create or replace function public.run_venue_staffing(p_tick bigint) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue record;
  v_wage integer;
  v_payroll integer;
  v_balance numeric;
  v_person uuid;
  v_actor uuid;
  v_assignment uuid;
  v_name text;
  v_hash text;
  v_key text;
  v_n integer;
  v_home_free boolean;
  v_rehomed integer := 0;
  v_hired integer := 0;
  v_created integer := 0;
  v_no_money integer := 0;
  v_no_employer integer := 0;
  v_no_candidate integer := 0;
  v_first text[] := array['Anna','Lukas','Marie','Jonas','Sophie','Felix','Lea','Paul','Hannah','Ben','Clara','Elias','Greta','Moritz','Ida','Jakob','Emilia','Noah','Lina','Theo','Mila','Karl','Frieda','Anton','Ella','Oskar','Luise','Henri','Rosa','Mats','Yusuf','Elif','Milan','Ana','Nikola','Sara'];
  v_last text[] := array['Schulte','Becker','Hoffmann','Wiese','Kemper','Rinsche','Vogt','Lange','Hennecke','Brüggemann','Schmidt','Klein','Wolf','Kaiser','Schröder','Bremer','Lohmann','Hesse','Busch','Peters','Yilmaz','Kaya','Petrović','Nowak','Ferreira','Rossi'];
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_STAFFING_TICK_INVALID'; end if;
  select daily_credits into v_wage from public.role_wage_rates where role_code = 'service';
  if v_wage is null then return jsonb_build_object('ok', false, 'reason', 'no_service_wage'); end if;

  -- 0. Der Arbeitgeber folgt dem Eigentümer eines realen Lokals.
  update public.person_assignments pa
     set employer_actor_id = own.actor_id, updated_at = now()
    from (
      select te.id, coalesce(te.actor_id, pea.actor_id, case when te.is_state_owned then lpa.actor_id end) as actor_id
        from public.tile_entities te
        left join public.profile_economic_actors pea on pea.profile_id = te.profile_id
        left join public.location_public_actors lpa on lpa.location_id = te.location_id
       where te.entity_id in ('cafe', 'bar', 'restaurant', 'hotel') and te.source_ref is not null
    ) own
   where pa.tile_entity_id = own.id and pa.assignment_type = 'work' and pa.is_active
     and own.actor_id is not null and pa.employer_actor_id is distinct from own.actor_id;
  get diagnostics v_rehomed = row_count;

  for v_venue in
    select te.id, te.location_id, te.latitude_deg, te.longitude_deg, te.x_m, te.y_m, te.spatial_region_id,
           te.display_name, te.entity_id, coalesce(te.residential_capacity, 0) as residential_capacity, l.slug,
           coalesce(te.actor_id, pea.actor_id, case when te.is_state_owned then lpa.actor_id end) as employer
      from public.tile_entities te
      join public.locations l on l.id = te.location_id
      left join public.profile_economic_actors pea on pea.profile_id = te.profile_id
      left join public.location_public_actors lpa on lpa.location_id = te.location_id
     where te.entity_type = 'building' and te.status = 'active' and te.conversion_plan is null
       and te.entity_id in ('cafe', 'bar', 'restaurant', 'hotel')
       and coalesce(te.staff_capacity, 0) > (
         select count(*) from public.person_assignments a where a.tile_entity_id = te.id and a.assignment_type = 'work' and a.is_active)
     order by te.id
  loop
    if v_venue.employer is null then v_no_employer := v_no_employer + 1; continue; end if;

    select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_venue.employer;
    -- Lohnsumme seiner Lokale (andere Stellen desselben Arbeitgebers zählen hier nicht;
    -- die Lohnrunde zahlt sie trotzdem aus demselben Konto).
    select coalesce(sum(w.daily_credits), 0) into v_payroll
      from public.person_assignments a
      join public.role_wage_rates w on w.role_code = a.role_code
      join public.tile_entities t on t.id = a.tile_entity_id and t.entity_id in ('cafe', 'bar', 'restaurant', 'hotel')
     where a.employer_actor_id = v_venue.employer and a.assignment_type = 'work' and a.is_active;
    if v_balance < 7 * (v_payroll + v_wage) then v_no_money := v_no_money + 1; continue; end if;

    -- Bewerber: übernommene Menschen des realen Ortes ohne Arbeit, die nächste zuerst.
    v_person := null;
    select p.id into v_person
      from public.people p
      join public.person_economic_actors pea on pea.person_id = p.id
      left join public.person_life_state pls on pls.person_id = p.id
      left join public.person_surface_presence sp on sp.person_id = p.id
     where p.current_location_id = v_venue.location_id
       and coalesce(pls.life_stage, 'adult') = 'adult'
       and (p.person_key like 'earth-house:%' or p.person_key like 'earth-local:%')
       and not exists (select 1 from public.person_assignments a where a.person_id = p.id and a.assignment_type = 'work' and a.is_active)
       and sp.latitude_deg is not null and v_venue.latitude_deg is not null
       and abs(sp.latitude_deg - v_venue.latitude_deg) < 0.045 and abs(sp.longitude_deg - v_venue.longitude_deg) < 0.07
     order by (sp.latitude_deg - v_venue.latitude_deg)^2 + ((sp.longitude_deg - v_venue.longitude_deg) * 0.62)^2, p.id
     limit 1;

    if v_person is null then
      -- Nur auf der Erde: jemand aus dem realen Ort kommt dazu.
      if v_venue.slug <> 'earth' or v_venue.latitude_deg is null then v_no_candidate := v_no_candidate + 1; continue; end if;
      select count(*) + 1 into v_n from public.people where person_key like 'earth-local:' || v_venue.id::text || ':%';
      v_key := 'earth-local:' || v_venue.id::text || ':' || v_n::text;
      v_hash := md5(v_key);
      v_name := v_first[1 + (('x' || substr(v_hash, 1, 6))::bit(24)::int % array_length(v_first, 1))]
             || ' ' || v_last[1 + (('x' || substr(v_hash, 7, 6))::bit(24)::int % array_length(v_last, 1))];
      insert into public.people(display_name, birth_year, current_location_id, simulation_tier, activity_state, last_action,
                                last_decision_factors, last_tick, person_key, bio_short, traits, observable_description)
      values (v_name, 2030 + (('x' || substr(v_hash, 13, 4))::bit(16)::int % 40), v_venue.location_id, 'background', 'idle', 'hired',
              jsonb_build_object('materialized_for', 'venue_staff', 'tile_entity_id', v_venue.id), p_tick, v_key,
              left('Arbeitet in ' || coalesce(v_venue.display_name, 'einem Lokal') || '.', 200),
              jsonb_build_object('origin', 'real_town_local'),
              'Eine Person aus dem Ort')
      returning id into v_person;
      insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
      values ('npc_person', v_name, 'Persönlicher Wirtschaftsakteur der Living Population.', '{}'::jsonb, '{}'::jsonb)
      returning id into v_actor;
      insert into public.person_economic_actors(person_id, actor_id) values (v_person, v_actor);
      insert into public.person_life_state(person_id, life_stage, age_ticks, family_desire, last_family_event_tick)
      values (v_person, 'adult', 0, 0.5, null) on conflict (person_id) do nothing;
      insert into public.person_needs(person_id, need_code, satisfaction, updated_tick)
      values (v_person,'sustenance',0.70,p_tick),(v_person,'rest',0.70,p_tick),(v_person,'safety',0.70,p_tick),
             (v_person,'social',0.70,p_tick),(v_person,'purpose',0.70,p_tick),(v_person,'variety',0.70,p_tick)
      on conflict (person_id, need_code) do nothing;
      insert into public.npc_ledger(actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (v_actor, p_tick, 'endowment', null, 0, 980, v_venue.location_id, 'bootstrap:person:' || v_person::text,
              'Bootstrap-Startbestand: Person aus dem realen Ort, als Personal eines Lokals ins Spiel übernommen');
      insert into public.person_surface_presence(person_id, location_id, source_kind, source_ref, x_m, y_m, latitude_deg, longitude_deg, spatial_region_id, confidence, updated_tick)
      values (v_person, v_venue.location_id, 'building_anchor', 'tile_entity:' || v_venue.id::text, v_venue.x_m, v_venue.y_m,
              v_venue.latitude_deg, v_venue.longitude_deg, v_venue.spatial_region_id, 0.9, p_tick)
      on conflict (person_id) do nothing;

      -- Wohnt über dem Lokal, wenn dort eine Wohnung frei ist (R-6), Miete an den Eigentümer.
      v_home_free := v_venue.residential_capacity > (
        select count(*) from public.person_assignments a where a.tile_entity_id = v_venue.id and a.assignment_type = 'home' and a.is_active);
      if v_home_free then
        insert into public.person_assignments(person_id, assignment_type, location_id, tile_entity_id, role_code, starts_tick, ends_tick, is_active)
        values (v_person, 'home', v_venue.location_id, v_venue.id, 'resident', p_tick, null, true)
        returning id into v_assignment;
        insert into public.person_tenancies(assignment_id, person_id, location_id, tile_entity_id, landlord_actor_id,
                                            rent_per_billing, billing_interval_ticks, next_due_tick, status, origin, tenure)
        values (v_assignment, v_person, v_venue.location_id, v_venue.id, v_venue.employer, 200, 720, p_tick + 720, 'active', 'market', 'rented');
      end if;
      v_created := v_created + 1;
    end if;

    insert into public.person_assignments(person_id, assignment_type, location_id, tile_entity_id, employer_actor_id, role_code, starts_tick, ends_tick, is_active)
    values (v_person, 'work', v_venue.location_id, v_venue.id, v_venue.employer, 'service', p_tick, null, true);
    v_hired := v_hired + 1;
  end loop;

  return jsonb_build_object('ok', true, 'tick', p_tick, 'hired', v_hired, 'created', v_created, 'employer_updated', v_rehomed,
    'no_money', v_no_money, 'no_employer', v_no_employer, 'no_candidate', v_no_candidate);
end;
$$;
revoke all on function public.run_venue_staffing(bigint) from public, anon, authenticated;
grant execute on function public.run_venue_staffing(bigint) to service_role;

-- ── Konsum: Bar und Restaurant nur mit Personal, Wahl gestreut nach Preis ────
create or replace function public.run_npc_consumption(p_tick bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

    -- Bezahlbare Angebote: Lokale vor der Kantine. Bar und Restaurant nur mit Personal.
    -- Unter den Lokalen gestreut je Person und Tick, billigere häufiger (∝ 1 / Preis).
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
      and (
        te.entity_id not in ('bar','restaurant','hotel')
        or exists (select 1 from public.person_assignments w
                   where w.tile_entity_id=te.id and w.assignment_type='work' and w.is_active)
      )
      and not exists (
        select 1 from public.person_consumption_events e
        where e.person_id=v_person.person_id
          and e.service_code=c.service_code
          and e.tick > p_tick-c.min_interval_ticks
      )
    order by (te.entity_id='port_canteen') asc,
             -ln((('x00000000' || substr(md5(v_person.person_id::text || ':' || p_tick::text || ':' || te.id::text),1,8))::bit(64)::bigint + 1)::numeric / 4294967297)
               * greatest(c.price_credits,1) asc,
             te.id
    limit 1;

    if not found then
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
$function$;
