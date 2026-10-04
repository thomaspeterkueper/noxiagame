create table if not exists public.person_economic_actors (
  person_id uuid primary key references public.people(id) on delete cascade,
  actor_id uuid not null unique references public.actors(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.person_economic_actors enable row level security;
revoke all on public.person_economic_actors from anon, authenticated;
grant select, insert, update, delete on public.person_economic_actors to service_role;

drop policy if exists person_economic_actors_service on public.person_economic_actors;
create policy person_economic_actors_service
on public.person_economic_actors
for all to service_role
using (true)
with check (true);

alter table public.actors drop constraint if exists actors_kind_check;
alter table public.actors add constraint actors_kind_check check (
  kind = any (array['player_corp','npc_firm','npc_person','colony','institution']::text[])
);

alter table public.npc_ledger drop constraint if exists npc_ledger_kind_check;
alter table public.npc_ledger add constraint npc_ledger_kind_check check (
  kind = any (array[
    'endowment','produce','buy','sell','build',
    'gift_received','gift_sent','wage','income','expense',
    'property_purchase','rent'
  ]::text[])
);

create or replace function public.transfer_player_to_npc_credits(
  p_profile_id uuid,
  p_person_id uuid,
  p_amount integer,
  p_tick bigint default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_credits integer;
  v_person_name text;
  v_location_id uuid;
  v_actor_id uuid;
  v_actor_credits numeric;
begin
  if p_amount is null or p_amount < 1 or p_amount > 10000 then
    raise exception 'NOXIA_TRANSFER_AMOUNT_INVALID';
  end if;

  select credits
    into v_player_credits
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  if v_player_credits < p_amount then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  select display_name, current_location_id
    into v_person_name, v_location_id
  from public.people
  where id = p_person_id
  for update;

  if not found then raise exception 'NOXIA_PERSON_NOT_FOUND'; end if;

  select actor_id into v_actor_id
  from public.person_economic_actors
  where person_id = p_person_id;

  if v_actor_id is null then
    insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
    values (
      'npc_person',
      v_person_name,
      'Persönlicher Wirtschaftsakteur der Living Population.',
      '{}'::jsonb,
      '{}'::jsonb
    )
    returning id into v_actor_id;

    insert into public.person_economic_actors(person_id, actor_id)
    values (p_person_id, v_actor_id);
  end if;

  update public.profiles
  set credits = credits - p_amount
  where id = p_profile_id;

  insert into public.npc_ledger(
    actor_id, tick, kind, resource, goods_delta, credit_delta,
    location_id, ref, note
  )
  values (
    v_actor_id,
    coalesce(p_tick, 0),
    'gift_received',
    null,
    0,
    p_amount,
    v_location_id,
    'player:' || p_profile_id::text,
    left(coalesce(p_note, 'Geschenk eines Spielers'), 240)
  );

  select coalesce(sum(credit_delta),0)
    into v_actor_credits
  from public.npc_ledger
  where actor_id = v_actor_id;

  return jsonb_build_object(
    'ok', true,
    'person_id', p_person_id,
    'actor_id', v_actor_id,
    'amount', p_amount,
    'player_credits', v_player_credits - p_amount,
    'npc_credits', v_actor_credits
  );
end;
$$;

revoke all on function public.transfer_player_to_npc_credits(uuid,uuid,integer,bigint,text) from public;
revoke all on function public.transfer_player_to_npc_credits(uuid,uuid,integer,bigint,text) from anon;
revoke all on function public.transfer_player_to_npc_credits(uuid,uuid,integer,bigint,text) from authenticated;
grant execute on function public.transfer_player_to_npc_credits(uuid,uuid,integer,bigint,text) to service_role;
