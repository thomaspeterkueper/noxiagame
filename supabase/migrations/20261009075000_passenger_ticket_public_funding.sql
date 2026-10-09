-- NOXIA-FIN-0001 / G1
-- Passenger transit tickets are real public-service revenue: the player is
-- debited by noxia_start_passenger_transit and the same amount is credited to
-- colony_ledger as entry_type='payout'. Current live function audit confirms
-- that passenger transit is the only producer of this payout type.
--
-- Do not treat arbitrary future payout rows as public funding. Only the
-- existing, explicitly identified ticket note is eligible.

set search_path to public;

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

  with credited as (
    insert into public.npc_ledger(
      actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note
    )
    select
      lpa.actor_id,cl.tick,'income',null,0,cl.amount,cl.location_id,
      'colony_ledger:' || cl.id::text,
      'Fiskaltransfer aus Koloniekasse: ' || cl.entry_type
    from public.colony_ledger cl
    join public.location_public_actors lpa on lpa.location_id=cl.location_id
    where cl.amount>0
      and (
        cl.entry_type in (
          'tax_payout','tax_property','tax_transaction','tax_landing','tax_rent','tariff'
        )
        or (
          cl.entry_type='payout'
          and cl.note like 'Ticketerloes Linienflug%'
        )
      )
    on conflict do nothing
    returning tick, credit_delta, location_id, ref
  )
  insert into public.colony_ledger(location_id,tick,entry_type,profile_id,resource_type,amount,note)
  select location_id,tick,'public_service_transfer',null,null,-credit_delta,
         'Fiskaltransfer an öffentliche Dienste (' || ref || ')'
  from credited;
  get diagnostics v_public_funding = row_count;

  return jsonb_build_object(
    'ok',true,'tick',p_tick,'assigned',v_assigned,
    'public_created',v_public_created,'player_created',v_player_created,
    'public_funding_entries',v_public_funding
  );
end;
$$;


revoke all on function public.sync_employer_economy(bigint) from public, anon, authenticated;
grant execute on function public.sync_employer_economy(bigint) to service_role;

comment on function public.sync_employer_economy(bigint) is
  'Assigns employer actors and transfers real local fiscal/public-service revenue to public employers. Ticket payout eligibility is restricted to Linienflug ticket rows.';
