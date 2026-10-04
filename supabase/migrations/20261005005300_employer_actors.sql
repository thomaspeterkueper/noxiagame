create table if not exists public.location_public_actors (
  location_id uuid primary key references public.locations(id) on delete cascade,
  actor_id uuid not null unique references public.actors(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_economic_actors (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  actor_id uuid not null unique references public.actors(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.location_public_actors enable row level security;
alter table public.profile_economic_actors enable row level security;
revoke all on public.location_public_actors from anon, authenticated;
revoke all on public.profile_economic_actors from anon, authenticated;
grant select, insert, update, delete on public.location_public_actors to service_role;
grant select, insert, update, delete on public.profile_economic_actors to service_role;

drop policy if exists location_public_actors_service on public.location_public_actors;
create policy location_public_actors_service on public.location_public_actors
for all to service_role using (true) with check (true);

drop policy if exists profile_economic_actors_service on public.profile_economic_actors;
create policy profile_economic_actors_service on public.profile_economic_actors
for all to service_role using (true) with check (true);

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
  where cl.amount>0 and cl.entry_type='tax_payout'
  on conflict do nothing;
  get diagnostics v_public_funding = row_count;

  return jsonb_build_object(
    'ok',true,'tick',p_tick,'assigned',v_assigned,
    'public_created',v_public_created,'player_created',v_player_created,
    'public_funding_entries',v_public_funding
  );
end;
$$;

revoke all on function public.sync_employer_economy(bigint) from public;
revoke all on function public.sync_employer_economy(bigint) from anon;
revoke all on function public.sync_employer_economy(bigint) from authenticated;
grant execute on function public.sync_employer_economy(bigint) to service_role;

create or replace function public.fund_player_corp(
  p_profile_id uuid,
  p_amount integer,
  p_tick bigint,
  p_request_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_actor_id uuid;
  v_username text;
  v_inserted uuid;
  v_treasury numeric;
begin
  if p_amount is null or p_amount<1 or p_amount>100000 then
    raise exception 'NOXIA_CORP_FUND_AMOUNT_INVALID';
  end if;
  if p_request_id is null then raise exception 'NOXIA_REQUEST_ID_REQUIRED'; end if;

  select credits,username into v_credits,v_username
  from public.profiles where id=p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  if v_credits<p_amount then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  select actor_id into v_actor_id
  from public.profile_economic_actors where profile_id=p_profile_id;

  if v_actor_id is null then
    insert into public.actors(kind,display_name,founded_by,bio_short,personality,decision_weights)
    values (
      'player_corp',
      coalesce(v_username,'Spieler') || ' – Unternehmen',
      p_profile_id,
      'Wirtschaftsakteur für spielereigene Betriebe und Beschäftigte.',
      '{}'::jsonb,'{}'::jsonb
    ) returning id into v_actor_id;
    insert into public.profile_economic_actors(profile_id,actor_id)
    values (p_profile_id,v_actor_id);
  end if;

  insert into public.npc_ledger(
    actor_id,tick,kind,resource,goods_delta,credit_delta,location_id,ref,note
  ) values (
    v_actor_id,p_tick,'income',null,0,p_amount,null,
    'profile_funding:' || p_request_id::text,
    left(coalesce(p_note,'Einlage des Eigentümers'),240)
  )
  on conflict do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select coalesce(sum(credit_delta),0) into v_treasury
    from public.npc_ledger where actor_id=v_actor_id;
    return jsonb_build_object(
      'ok',true,'duplicate',true,'amount',0,'actor_id',v_actor_id,
      'player_credits',v_credits,'corp_credits',v_treasury
    );
  end if;

  update public.profiles set credits=credits-p_amount where id=p_profile_id;
  select coalesce(sum(credit_delta),0) into v_treasury
  from public.npc_ledger where actor_id=v_actor_id;

  return jsonb_build_object(
    'ok',true,'duplicate',false,'amount',p_amount,'actor_id',v_actor_id,
    'player_credits',v_credits-p_amount,'corp_credits',v_treasury
  );
end;
$$;

revoke all on function public.fund_player_corp(uuid,integer,bigint,uuid,text) from public;
revoke all on function public.fund_player_corp(uuid,integer,bigint,uuid,text) from anon;
revoke all on function public.fund_player_corp(uuid,integer,bigint,uuid,text) from authenticated;
grant execute on function public.fund_player_corp(uuid,integer,bigint,uuid,text) to service_role;
