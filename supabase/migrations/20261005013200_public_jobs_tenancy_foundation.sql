create table if not exists public.person_tenancies (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.person_assignments(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  tile_entity_id uuid references public.tile_entities(id) on delete set null,
  landlord_actor_id uuid references public.actors(id) on delete set null,
  rent_per_billing integer check (rent_per_billing is null or rent_per_billing >= 0),
  billing_interval_ticks integer not null default 720 check (billing_interval_ticks > 0),
  next_due_tick bigint,
  status text not null default 'provided' check (status in ('provided','pending_terms','active','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists person_tenancies_person_idx on public.person_tenancies(person_id);
create index if not exists person_tenancies_landlord_idx on public.person_tenancies(landlord_actor_id) where landlord_actor_id is not null;
create index if not exists person_tenancies_due_idx on public.person_tenancies(next_due_tick) where status='active';

alter table public.person_tenancies enable row level security;
revoke all on public.person_tenancies from anon, authenticated;
grant select, insert, update, delete on public.person_tenancies to service_role;
drop policy if exists person_tenancies_service on public.person_tenancies;
create policy person_tenancies_service on public.person_tenancies
for all to service_role using (true) with check (true);

create or replace function public.ensure_public_actor(p_location_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_location_name text;
begin
  select actor_id into v_actor_id
  from public.location_public_actors
  where location_id=p_location_id;
  if v_actor_id is not null then return v_actor_id; end if;

  select name into v_location_name from public.locations where id=p_location_id;
  if not found then raise exception 'NOXIA_LOCATION_NOT_FOUND'; end if;

  insert into public.actors(kind,display_name,bio_short,personality,decision_weights)
  values (
    'institution',
    coalesce(v_location_name,'Kolonie') || ' – Öffentliche Dienste',
    'Öffentlicher Arbeitgeber und Budgetträger der lokalen Infrastruktur.',
    '{}'::jsonb,'{}'::jsonb
  ) returning id into v_actor_id;

  insert into public.location_public_actors(location_id,actor_id)
  values (p_location_id,v_actor_id);
  return v_actor_id;
end;
$$;

revoke all on function public.ensure_public_actor(uuid) from public;
revoke all on function public.ensure_public_actor(uuid) from anon;
revoke all on function public.ensure_public_actor(uuid) from authenticated;
grant execute on function public.ensure_public_actor(uuid) to service_role;

create or replace function public.sync_public_unlocated_jobs(p_tick bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_actor_id uuid;
  v_assigned integer := 0;
begin
  for v_row in
    select pa.id,pa.location_id
    from public.person_assignments pa
    where pa.assignment_type='work'
      and pa.is_active=true
      and pa.employer_actor_id is null
      and pa.tile_entity_id is null
      and pa.role_code in (
        'educator','logistics','administrator','infrastructure_coordinator',
        'rover_operations_lead','water_life_support_lead','geology_lab_lead',
        'fabrication_center_lead','geologist','researcher','technician'
      )
    order by pa.location_id,pa.id
  loop
    v_actor_id := public.ensure_public_actor(v_row.location_id);
    update public.person_assignments
    set employer_actor_id=v_actor_id, updated_at=now()
    where id=v_row.id and employer_actor_id is null;
    if found then v_assigned := v_assigned + 1; end if;
  end loop;

  return jsonb_build_object('ok',true,'tick',p_tick,'assigned',v_assigned);
end;
$$;

revoke all on function public.sync_public_unlocated_jobs(bigint) from public;
revoke all on function public.sync_public_unlocated_jobs(bigint) from anon;
revoke all on function public.sync_public_unlocated_jobs(bigint) from authenticated;
grant execute on function public.sync_public_unlocated_jobs(bigint) to service_role;

create or replace function public.sync_person_tenancies(p_tick bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_landlord uuid;
  v_created integer := 0;
  v_updated integer := 0;
  v_exists boolean;
begin
  for v_row in
    select pa.id assignment_id,pa.person_id,pa.location_id,pa.tile_entity_id,
           te.owner_class,te.actor_id,te.profile_id
    from public.person_assignments pa
    left join public.tile_entities te on te.id=pa.tile_entity_id
    where pa.assignment_type='home' and pa.is_active=true
  loop
    v_landlord := null;
    if v_row.actor_id is not null then
      v_landlord := v_row.actor_id;
    elsif v_row.owner_class='STATE' then
      v_landlord := public.ensure_public_actor(v_row.location_id);
    elsif v_row.owner_class='PLAYER' and v_row.profile_id is not null then
      select actor_id into v_landlord
      from public.profile_economic_actors
      where profile_id=v_row.profile_id;
    end if;

    select exists(
      select 1 from public.person_tenancies where assignment_id=v_row.assignment_id
    ) into v_exists;

    insert into public.person_tenancies(
      assignment_id,person_id,location_id,tile_entity_id,landlord_actor_id,
      rent_per_billing,billing_interval_ticks,next_due_tick,status,updated_at
    ) values (
      v_row.assignment_id,v_row.person_id,v_row.location_id,v_row.tile_entity_id,v_landlord,
      null,720,null,'provided',now()
    )
    on conflict (assignment_id) do update set
      person_id=excluded.person_id,
      location_id=excluded.location_id,
      tile_entity_id=excluded.tile_entity_id,
      landlord_actor_id=coalesce(public.person_tenancies.landlord_actor_id,excluded.landlord_actor_id),
      updated_at=now();

    if v_exists then v_updated:=v_updated+1; else v_created:=v_created+1; end if;
  end loop;

  update public.person_tenancies t
  set status='ended',updated_at=now()
  where status<>'ended'
    and not exists (
      select 1 from public.person_assignments pa
      where pa.id=t.assignment_id
        and pa.assignment_type='home'
        and pa.is_active=true
    );

  return jsonb_build_object('ok',true,'tick',p_tick,'created',v_created,'updated',v_updated);
end;
$$;

revoke all on function public.sync_person_tenancies(bigint) from public;
revoke all on function public.sync_person_tenancies(bigint) from anon;
revoke all on function public.sync_person_tenancies(bigint) from authenticated;
grant execute on function public.sync_person_tenancies(bigint) to service_role;

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
  v_ref text;
begin
  for v_row in
    select *
    from public.person_tenancies
    where status='active'
      and landlord_actor_id is not null
      and rent_per_billing is not null
      and rent_per_billing>0
      and next_due_tick is not null
      and next_due_tick<=p_tick
    order by next_due_tick,id
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

    insert into public.npc_ledger(
      actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note
    ) values (
      v_tenant_actor,p_tick,'rent',null,0,-v_row.rent_per_billing,
      v_row.location_id,v_ref,'Mietzahlung'
    ) on conflict do nothing;

    if not found then
      update public.person_tenancies
      set next_due_tick=next_due_tick+billing_interval_ticks,updated_at=now()
      where id=v_row.id;
      continue;
    end if;

    insert into public.npc_ledger(
      actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note
    ) values (
      v_row.landlord_actor_id,p_tick,'rent',null,0,v_row.rent_per_billing,
      v_row.location_id,v_ref,'Mieteinnahme'
    ) on conflict do nothing;

    update public.person_tenancies
    set next_due_tick=next_due_tick+billing_interval_ticks,updated_at=now()
    where id=v_row.id;

    v_paid:=v_paid+1;
    v_total:=v_total+v_row.rent_per_billing;
  end loop;

  return jsonb_build_object('ok',true,'tick',p_tick,'paid',v_paid,'insufficient',v_insufficient,'total_credits',v_total);
end;
$$;

revoke all on function public.run_npc_rent_settlement(bigint) from public;
revoke all on function public.run_npc_rent_settlement(bigint) from anon;
revoke all on function public.run_npc_rent_settlement(bigint) from authenticated;
grant execute on function public.run_npc_rent_settlement(bigint) to service_role;
