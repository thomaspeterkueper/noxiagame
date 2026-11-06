-- Abends in die Bar; Personal sieht man als Personal.
-- Anlass (Thomas, 06.11.2026): „kein sinniges Gespräch in einer Bar mit Tanzfläche“ – im Metropol
-- fragte ein Spieler, ab wann etwas los ist. Befund:
--   * Bars sind bisher nur Imbiss: Gäste kamen um 0, 6, 12 und 18 Uhr zum Essen
--     (bar_snack_drink, Bedürfnis Sättigung). Ausgehen am Abend gab es nur im Nachtclub –
--     und auf der Erde gibt es keinen. Abends war in der Bar deshalb nie mehr los als mittags.
--   * Das Personal stand als „Eine Person aus dem Ort“ da.
--
-- Neu:
--   * Abend in der Bar (bar_evening, Bedürfnis Geselligkeit, 6 Cr, einmal am Tag):
--     run_npc_nightlife schickt Leute, denen Gesellschaft fehlt, ab 18 bis 2 Uhr in Bars und
--     ab 22 bis 5 Uhr in Nachtclubs. Gibt es beides, geht es nachts in den Nachtclub.
--     Bezahlt wie bisher: Gast → Lokal, Konsumsteuer an den Ort (Transfers).
--   * Wer in einem Haus arbeitet, wirkt als „<Stelle> · <Haus>“ (z. B. „Bedienung · Metropol“),
--     solange die Beschreibung noch allgemein ist; auch für künftige Einstellungen (Trigger).

set search_path to public;

insert into public.npc_service_catalog (entity_id, service_code, need_code, price_credits, satisfaction_gain, min_interval_ticks, active)
values ('bar', 'bar_evening', 'social', 6, 0.20, 24, true)
on conflict do nothing;

create or replace function public.run_npc_nightlife(p_tick bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_hour integer := mod(p_tick, 24)::integer;
  v_kinds text[];
  v_person record;
  v_offer record;
  v_balance numeric;
  v_event_id uuid;
  v_ref text;
  v_tax_rate numeric;
  v_tax integer;
  v_net integer;
  v_went integer := 0;
  v_label text;
begin
  if p_tick is null or p_tick < 0 then raise exception 'NOXIA_NIGHTLIFE_TICK_INVALID'; end if;
  v_kinds := array[]::text[];
  if v_hour >= 18 or v_hour < 2 then v_kinds := array_append(v_kinds, 'bar'); end if;
  if v_hour >= 22 or v_hour < 5 then v_kinds := array_append(v_kinds, 'nightclub'); end if;
  if cardinality(v_kinds) = 0 then
    return jsonb_build_object('ok', true, 'open', false, 'went', 0);
  end if;
  for v_person in
    select p.id person_id, p.current_location_id, pea.actor_id buyer_actor_id
      from public.people p
      join public.person_needs pn on pn.person_id = p.id and pn.need_code = 'social'
      join public.person_economic_actors pea on pea.person_id = p.id
      left join public.person_life_state pls on pls.person_id = p.id
     where pn.satisfaction < 0.55
       and coalesce(pls.life_stage, 'adult') = 'adult'
       and p.current_location_id is not null
       and ('x' || substr(md5(p.id::text || ':night:' || (p_tick / 24)::text), 1, 2))::bit(8)::int < 85
     order by pn.satisfaction asc, p.id
  loop
    select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_person.buyer_actor_id;
    select te.id tile_entity_id, te.entity_id, c.service_code, c.need_code,
           greatest(1, round(c.price_credits * public.venue_price_factor(te.id)))::integer price_credits,
           c.satisfaction_gain, coalesce(te.actor_id, pea.actor_id, lpa.actor_id) seller_actor_id
      into v_offer
      from public.tile_entities te
      join public.npc_service_catalog c on c.entity_id = te.entity_id and c.active and c.need_code = 'social'
      left join public.profile_economic_actors pea on pea.profile_id = te.profile_id
      left join public.location_public_actors lpa on lpa.location_id = te.location_id
     where te.location_id = v_person.current_location_id
       and te.status = 'active' and te.entity_id = any(v_kinds) and te.conversion_plan is null
       and exists (select 1 from public.person_assignments w where w.tile_entity_id = te.id and w.assignment_type = 'work' and w.is_active)
       and coalesce(te.actor_id, pea.actor_id, lpa.actor_id) is not null
       and greatest(1, round(c.price_credits * public.venue_price_factor(te.id))) <= v_balance
       and not exists (select 1 from public.person_consumption_events e
                        where e.person_id = v_person.person_id and e.need_code = 'social'
                          and e.tick > p_tick - c.min_interval_ticks)
     order by (te.entity_id = 'nightclub') desc, md5(v_person.person_id::text || te.id::text), te.id
     limit 1;
    if not found then continue; end if;
    v_label := case when v_offer.entity_id = 'nightclub' then 'Nachtclub' else 'Bar' end;
    select least(1, greatest(0, coalesce(cs.tax_transaction, 0))) into v_tax_rate
      from public.colony_settings cs where cs.location_id = v_person.current_location_id;
    v_tax_rate := coalesce(v_tax_rate, 0);
    v_tax := least(v_offer.price_credits, greatest(0, round(v_offer.price_credits * v_tax_rate)::integer));
    v_net := v_offer.price_credits - v_tax;
    v_event_id := null;
    insert into public.person_consumption_events(
      person_id, buyer_actor_id, seller_actor_id, tile_entity_id, service_code, need_code, price_credits,
      satisfaction_gain, tick, transaction_tax_rate, transaction_tax_credits, seller_net_credits)
    values (v_person.person_id, v_person.buyer_actor_id, v_offer.seller_actor_id, v_offer.tile_entity_id,
            v_offer.service_code, v_offer.need_code, v_offer.price_credits, v_offer.satisfaction_gain, p_tick,
            v_tax_rate, v_tax, v_net)
    on conflict (person_id, service_code, tick) do nothing
    returning id into v_event_id;
    if v_event_id is null then continue; end if;
    v_ref := 'consumption:' || v_event_id::text;
    insert into public.npc_ledger(actor_id, tick, kind, goods_delta, credit_delta, location_id, ref, note)
    values (v_person.buyer_actor_id, p_tick, 'expense', 0, -v_offer.price_credits, v_person.current_location_id, v_ref, 'Ausgehen: ' || v_label);
    if v_net > 0 then
      insert into public.npc_ledger(actor_id, tick, kind, goods_delta, credit_delta, location_id, ref, note)
      values (v_offer.seller_actor_id, p_tick, 'income', 0, v_net, v_person.current_location_id, v_ref, 'Verkauf netto: ' || v_label);
    end if;
    if v_tax > 0 then
      insert into public.colony_ledger(location_id, tick, entry_type, profile_id, resource_type, amount, note)
      values (v_person.current_location_id, p_tick, 'tax_transaction', null, null, v_tax, 'Konsumsteuer (' || v_ref || ')');
    end if;
    update public.person_needs set satisfaction = least(1, satisfaction + v_offer.satisfaction_gain), updated_tick = p_tick
     where person_id = v_person.person_id and need_code = 'social';
    v_went := v_went + 1;
  end loop;
  return jsonb_build_object('ok', true, 'open', true, 'kinds', v_kinds, 'went', v_went);
end;
$function$;

-- Personal erkennbar machen.
create or replace function public.noxia_staff_description(p_assignment_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select left(coalesce(r.label, case a.role_code
                when 'service' then 'Bedienung' when 'educator' then 'Lehrkraft' when 'administrator' then 'Verwaltung'
                when 'bank_clerk' then 'Bankschalter' when 'bank_advisor' then 'Bankberatung' when 'travel_agent' then 'Reisebüro'
                when 'job_advisor' then 'Vermittlung' when 'technician' then 'Technik' else 'Personal' end)
              || coalesce(' · ' || nullif(te.display_name, ''), ''), 120)
    from public.person_assignments a
    join public.tile_entities te on te.id = a.tile_entity_id
    left join public.building_staff_roles r on r.entity_id = te.entity_id and r.role_code = a.role_code
   where a.id = p_assignment_id
   order by r.slot nulls last
   limit 1
$$;

create or replace function public.noxia_staff_description_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignment_type = 'work' and new.is_active and new.tile_entity_id is not null then
    update public.people set observable_description = public.noxia_staff_description(new.id)
     where id = new.person_id and coalesce(observable_description, '') in ('', 'Eine Person aus dem Ort');
  end if;
  return new;
end;
$$;

drop trigger if exists noxia_staff_description on public.person_assignments;
create trigger noxia_staff_description after insert on public.person_assignments
  for each row execute function public.noxia_staff_description_trigger();

update public.people p
   set observable_description = public.noxia_staff_description(a.id)
  from public.person_assignments a
 where a.person_id = p.id and a.assignment_type = 'work' and a.is_active and a.tile_entity_id is not null
   and coalesce(p.observable_description, '') in ('', 'Eine Person aus dem Ort');
