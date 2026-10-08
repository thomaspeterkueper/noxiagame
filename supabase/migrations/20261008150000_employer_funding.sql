-- NOXIA-LIVING-0010, Stufe 3: Arbeitgeberfinanzierung
--
-- 1. Ursache beheben: lib/game/tick.ts bucht 'building_payout' und 'tax_payout'
--    ins colony_ledger. Beide Typen fehlen im Check-Constraint, die Buchung
--    schlug still fehl. Deshalb ist colony_ledger leer und die öffentlichen
--    Arbeitgeber haben nie Einnahmen erhalten.
-- 2. Öffentliche Arbeitgeber werden aus allen Steuereinnahmen ihres Ortes
--    finanziert, nachvollziehbar über ref 'colony_ledger:<id>'.
-- 3. Einmalige, gekennzeichnete Übergangsreserve von 14 Tageslöhnen für
--    bestehende Arbeitgeber ohne Mittel (öffentlich und privat).
--    Danach gilt: Reicht das Konto nicht, wird kein Lohn gezahlt.

alter table public.colony_ledger drop constraint if exists colony_ledger_entry_type_check;
alter table public.colony_ledger add constraint colony_ledger_entry_type_check
  check (entry_type in (
    'tax_property','tax_transaction','tax_landing','tariff','payout','other',
    'building_payout','tax_payout'
  ));

create or replace function public.sync_employer_economy(p_tick bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_actor_id uuid;
  v_assigned integer := 0;
  v_public_created integer := 0;
  v_player_created integer := 0;
  v_public_funding integer := 0;
  v_location_name text;
  v_username text;
  v_rows integer := 0;
begin
  update public.person_assignments pa
  set employer_actor_id=te.actor_id, updated_at=now()
  from public.tile_entities te
  where pa.tile_entity_id=te.id
    and pa.assignment_type='work'
    and pa.is_active=true
    and pa.employer_actor_id is null
    and te.actor_id is not null;
  get diagnostics v_rows = row_count;
  v_assigned := v_assigned + v_rows;

  for v_row in
    select distinct pa.location_id
    from public.person_assignments pa
    join public.tile_entities te on te.id=pa.tile_entity_id
    where pa.assignment_type='work'
      and pa.is_active=true
      and pa.employer_actor_id is null
      and te.owner_class='STATE'
  loop
    select actor_id into v_actor_id
    from public.location_public_actors
    where location_id=v_row.location_id;

    if v_actor_id is null then
      select name into v_location_name from public.locations where id=v_row.location_id;
      insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
      values (
        'institution',
        coalesce(v_location_name,'Kolonie') || ' – Öffentliche Dienste',
        'Öffentlicher Arbeitgeber und Budgetträger der lokalen Infrastruktur.',
        '{}'::jsonb,'{}'::jsonb
      ) returning id into v_actor_id;
      insert into public.location_public_actors(location_id,actor_id)
      values (v_row.location_id,v_actor_id);
      v_public_created := v_public_created + 1;
    end if;

    update public.person_assignments pa
    set employer_actor_id=v_actor_id, updated_at=now()
    from public.tile_entities te
    where pa.tile_entity_id=te.id
      and pa.assignment_type='work'
      and pa.is_active=true
      and pa.employer_actor_id is null
      and pa.location_id=v_row.location_id
      and te.owner_class='STATE';
    get diagnostics v_rows = row_count;
    v_assigned := v_assigned + v_rows;
  end loop;

  for v_row in
    select distinct te.profile_id
    from public.person_assignments pa
    join public.tile_entities te on te.id=pa.tile_entity_id
    where pa.assignment_type='work'
      and pa.is_active=true
      and pa.employer_actor_id is null
      and te.owner_class='PLAYER'
      and te.profile_id is not null
  loop
    select actor_id into v_actor_id
    from public.profile_economic_actors
    where profile_id=v_row.profile_id;

    if v_actor_id is null then
      select username into v_username from public.profiles where id=v_row.profile_id;
      insert into public.actors(kind,display_name,founded_by,bio_short,personality,decision_weights)
      values (
        'player_corp',
        coalesce(v_username,'Spieler') || ' – Unternehmen',
        v_row.profile_id,
        'Wirtschaftsakteur für spielereigene Betriebe und Beschäftigte.',
        '{}'::jsonb,'{}'::jsonb
      ) returning id into v_actor_id;
      insert into public.profile_economic_actors(profile_id,actor_id)
      values (v_row.profile_id,v_actor_id);
      v_player_created := v_player_created + 1;
    end if;

    update public.person_assignments pa
    set employer_actor_id=v_actor_id, updated_at=now()
    from public.tile_entities te
    where pa.tile_entity_id=te.id
      and pa.assignment_type='work'
      and pa.is_active=true
      and pa.employer_actor_id is null
      and te.owner_class='PLAYER'
      and te.profile_id=v_row.profile_id;
    get diagnostics v_rows = row_count;
    v_assigned := v_assigned + v_rows;
  end loop;

  insert into public.npc_ledger(
    actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note
  )
  select
    lpa.actor_id,cl.tick,'income',null,0,cl.amount,cl.location_id,
    'colony_ledger:' || cl.id::text,
    'Öffentliche Einnahme: ' || cl.entry_type
  from public.colony_ledger cl
  join public.location_public_actors lpa on lpa.location_id=cl.location_id
  where cl.amount>0
    and cl.entry_type in ('tax_payout','tax_property','tax_transaction','tax_landing','tariff')
  on conflict do nothing;
  get diagnostics v_public_funding = row_count;

  return jsonb_build_object(
    'ok',true,'tick',p_tick,'assigned',v_assigned,
    'public_created',v_public_created,'player_created',v_player_created,
    'public_funding_entries',v_public_funding
  );
end;
$$;

do $$
declare
  v_row record;
begin
  for v_row in
    select pa.employer_actor_id as actor_id,
           sum(coalesce(r.daily_credits, 60)) as daily_wages,
           min(pa.location_id::text)::uuid as location_id
    from public.person_assignments pa
    left join public.role_wage_rates r on r.role_code = pa.role_code
    where pa.is_active and pa.assignment_type = 'work' and pa.employer_actor_id is not null
    group by pa.employer_actor_id
  loop
    if (select coalesce(sum(credit_delta), 0) from public.npc_ledger where actor_id = v_row.actor_id) < v_row.daily_wages
       and not exists (
         select 1 from public.npc_ledger
         where actor_id = v_row.actor_id and ref = 'bootstrap:employer:' || v_row.actor_id::text
       )
    then
      insert into public.npc_ledger (actor_id, tick, kind, resource, goods_delta, credit_delta, location_id, ref, note)
      values (
        v_row.actor_id, 0, 'endowment', null, 0, v_row.daily_wages * 14, v_row.location_id,
        'bootstrap:employer:' || v_row.actor_id::text,
        'Einmalige Übergangsreserve: 14 Tageslöhne für bestehende Arbeitsverhältnisse'
      );
    end if;
  end loop;
end $$;
