-- NOXIA-LIVING-0010 / NOXIA-FIN-0001
-- Markt-Miete als echter Nullsummen-Transfer; standardmäßig ohne Live-Steuer.
--
-- WICHTIG:
-- * Bestehende backfill/provided-Mietverhältnisse bleiben unverändert und kostenfrei.
-- * tile_entities.lease_price ist die Angebotsmiete privater Wohngebäude.
-- * Nur origin='market', tenure='rented', status='active' wird abgerechnet.
-- * rent_tax_rate startet überall bei 0; keine Steuer wird implizit aktiviert.

begin;

alter table public.colony_settings
  add column if not exists rent_tax_rate numeric(8,4) not null default 0
  check (rent_tax_rate >= 0 and rent_tax_rate <= 1);

comment on column public.colony_settings.rent_tax_rate is
  'Anteil der Bruttomiete, der als Mietsteuer an die lokale Koloniekasse geht. Default 0; explizit zu aktivieren.';

comment on column public.tile_entities.lease_price is
  'Angebotsmiete je person_tenancies.billing_interval_ticks für neue Markt-Mietverhältnisse. NULL = nicht zur Miete angeboten.';

alter table public.colony_ledger drop constraint if exists colony_ledger_entry_type_check;
alter table public.colony_ledger add constraint colony_ledger_entry_type_check
  check (entry_type in (
    'tax_property','tax_transaction','tax_landing','tax_rent','tariff','payout','other',
    'building_payout','tax_payout','public_service_transfer'
  ));

create unique index if not exists colony_ledger_tax_rent_once
  on public.colony_ledger (note) where entry_type = 'tax_rent';

create or replace function public.run_npc_rent_settlement(p_tick bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_tenant_actor uuid;
  v_balance numeric;
  v_paid integer := 0;
  v_insufficient integer := 0;
  v_total integer := 0;
  v_tax_total integer := 0;
  v_ref text;
  v_tax integer;
  v_net integer;
  v_debited boolean;
begin
  for v_row in
    select t.*, coalesce(cs.rent_tax_rate,0) as rent_tax_rate
    from public.person_tenancies t
    left join public.colony_settings cs on cs.location_id=t.location_id
    where t.status='active'
      and t.origin='market'
      and t.tenure='rented'
      and t.landlord_actor_id is not null
      and t.rent_per_billing is not null
      and t.rent_per_billing>0
      and t.next_due_tick is not null
      and t.next_due_tick<=p_tick
    order by t.next_due_tick,t.id
    for update of t
  loop
    select actor_id into v_tenant_actor
    from public.person_economic_actors
    where person_id=v_row.person_id;

    if v_tenant_actor is null then
      v_insufficient:=v_insufficient+1;
      continue;
    end if;

    select coalesce(sum(credit_delta),0) into v_balance
    from public.npc_ledger
    where actor_id=v_tenant_actor;

    if v_balance < v_row.rent_per_billing then
      v_insufficient:=v_insufficient+1;
      continue;
    end if;

    v_ref := 'tenancy:' || v_row.id::text || ':due:' || v_row.next_due_tick::text;
    v_tax := least(
      v_row.rent_per_billing,
      greatest(0, round(v_row.rent_per_billing * v_row.rent_tax_rate)::integer)
    );
    v_net := v_row.rent_per_billing - v_tax;
    v_debited := false;

    -- One SQL statement makes debit, landlord net and tax indivisible. If the
    -- tenant debit already exists, this is a retry and neither other side is
    -- created again.
    with debit as (
      insert into public.npc_ledger(
        actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note
      ) values (
        v_tenant_actor,p_tick,'rent',null,0,-v_row.rent_per_billing,
        v_row.location_id,v_ref,'Mietzahlung brutto'
      )
      on conflict do nothing
      returning 1
    ),
    landlord as (
      insert into public.npc_ledger(
        actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note
      )
      select
        v_row.landlord_actor_id,p_tick,'rent',null,0,v_net,
        v_row.location_id,v_ref,'Mieteinnahme netto'
      from debit
      returning 1
    ),
    tax as (
      insert into public.colony_ledger(
        location_id,tick,entry_type,profile_id,resource_type,amount,note
      )
      select
        v_row.location_id,p_tick,'tax_rent',null,null,v_tax,
        'Mietsteuer (' || v_ref || ')'
      from landlord
      where v_tax>0
      on conflict do nothing
      returning 1
    )
    select exists(select 1 from debit)
      into v_debited;

    -- Conflict on the debit means this due item was already booked atomically.
    -- In both cases advance exactly once from this due slot.
    update public.person_tenancies
    set next_due_tick=next_due_tick+billing_interval_ticks,updated_at=now()
    where id=v_row.id;

    if v_debited then
      v_paid:=v_paid+1;
      v_total:=v_total+v_row.rent_per_billing;
      v_tax_total:=v_tax_total+v_tax;
    end if;
  end loop;

  return jsonb_build_object(
    'ok',true,'tick',p_tick,'paid',v_paid,'insufficient',v_insufficient,
    'total_credits',v_total,'tax_credits',v_tax_total
  );
end;
$$;

revoke all on function public.run_npc_rent_settlement(bigint) from public, anon, authenticated;
grant execute on function public.run_npc_rent_settlement(bigint) to service_role;

-- Public funding may consume real rent tax exactly like the other fiscal inflows.
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
      and cl.entry_type in (
        'tax_payout','tax_property','tax_transaction','tax_landing','tax_rent','tariff'
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

commit;
