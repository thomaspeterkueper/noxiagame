-- 20261104190000_credit_transfers.sql
-- Credits untereinander (Thomas, 04.11.2026: „Trinkgeld lassen wir weg, aber es sollte
-- Möglichkeiten geben, generell Credits untereinander auszutauschen“). Entschieden:
--   * Spieler an Spieler, Spieler an Bewohner, Bewohner an Spieler;
--   * bar von Hand zu Hand (wer sich trifft) und als Überweisung bei der Bank.
-- Jede Übergabe ist ein Nullsummen-Transfer nach NOXIA-FIN-0001: Was der eine abgibt,
-- bekommt der andere. Keine Emission, keine Steuer (Geschenk, Zahlung unter Leuten).
-- Spieler zahlen aus profiles.credits; Bewohner aus ihrem Konto im npc_ledger
-- (person_economic_actors, angelegt wie bei pay_npc_wage).
-- Missbrauch: an andere Spieler höchstens 2000 Cr je Tag und Spieler.

create table if not exists public.credit_transfers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  channel text not null check (channel in ('cash', 'bank')),
  from_profile_id uuid references public.profiles(id) on delete set null,
  from_person_id uuid references public.people(id) on delete set null,
  to_profile_id uuid references public.profiles(id) on delete set null,
  to_person_id uuid references public.people(id) on delete set null,
  amount integer not null check (amount between 1 and 10000),
  note text,
  place text,
  created_at timestamptz not null default now(),
  check ((from_profile_id is not null) <> (from_person_id is not null)),
  check ((to_profile_id is not null) <> (to_person_id is not null))
);
create index if not exists credit_transfers_from_idx on public.credit_transfers(from_profile_id, created_at desc);
create index if not exists credit_transfers_to_idx on public.credit_transfers(to_profile_id, created_at desc);
alter table public.credit_transfers enable row level security;
grant all on public.credit_transfers to service_role;

-- Konto eines Bewohners (wie pay_npc_wage), bei Bedarf angelegt.
create or replace function public.noxia_person_actor(p_person_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_actor uuid; v_name text;
begin
  select actor_id into v_actor from public.person_economic_actors where person_id = p_person_id;
  if v_actor is not null then return v_actor; end if;
  select display_name into v_name from public.people where id = p_person_id;
  if v_name is null then raise exception 'NOXIA_TRANSFER_RECIPIENT_UNKNOWN'; end if;
  insert into public.actors(kind, display_name, bio_short, personality, decision_weights)
  values ('npc_person', v_name, 'Persönlicher Wirtschaftsakteur der Living Population.', '{}'::jsonb, '{}'::jsonb)
  returning id into v_actor;
  insert into public.person_economic_actors(person_id, actor_id) values (p_person_id, v_actor);
  return v_actor;
end $$;

-- Spieler gibt oder überweist: an einen Spieler (p_to_username) oder einen Bewohner (p_to_person_id).
create or replace function public.noxia_player_give_credits(
  p_profile_id uuid, p_request_id uuid, p_channel text, p_amount integer,
  p_to_username text default null, p_to_person_id uuid default null, p_note text default null, p_place text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_credits integer; v_to_profile uuid; v_to_name text; v_actor uuid; v_tick bigint; v_sent_today integer; v_row public.credit_transfers%rowtype;
begin
  if p_channel not in ('cash', 'bank') then raise exception 'NOXIA_TRANSFER_CHANNEL'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 10000 then raise exception 'NOXIA_TRANSFER_AMOUNT'; end if;
  select * into v_row from public.credit_transfers where request_id = p_request_id;
  if found then
    if v_row.from_profile_id is distinct from p_profile_id then raise exception 'NOXIA_TRANSFER_REQUEST_CONFLICT'; end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'credits', (select credits from public.profiles where id = p_profile_id));
  end if;
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  if v_credits < p_amount then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;

  if p_to_username is not null then
    select id, username into v_to_profile, v_to_name from public.profiles where lower(username) = lower(btrim(p_to_username));
    if v_to_profile is null then raise exception 'NOXIA_TRANSFER_RECIPIENT_UNKNOWN'; end if;
    if v_to_profile = p_profile_id then raise exception 'NOXIA_TRANSFER_SELF'; end if;
    select coalesce(sum(amount), 0) into v_sent_today from public.credit_transfers
     where from_profile_id = p_profile_id and to_profile_id is not null and created_at > now() - interval '24 hours';
    if v_sent_today + p_amount > 2000 then raise exception 'NOXIA_TRANSFER_DAILY_LIMIT:%', greatest(0, 2000 - v_sent_today); end if;
    perform 1 from public.profiles where id = v_to_profile for update;
    update public.profiles set credits = credits - p_amount where id = p_profile_id;
    update public.profiles set credits = credits + p_amount where id = v_to_profile;
  elsif p_to_person_id is not null then
    select display_name into v_to_name from public.people where id = p_to_person_id;
    if v_to_name is null then raise exception 'NOXIA_TRANSFER_RECIPIENT_UNKNOWN'; end if;
    -- Überweisen kann man nur an jemanden, dessen Namen man kennt; bar geht an jeden, den man trifft.
    if p_channel = 'bank' and not exists (select 1 from public.player_person_identity_knowledge k where k.profile_id = p_profile_id and k.person_id = p_to_person_id and k.identity_state = 'known') then
      raise exception 'NOXIA_TRANSFER_NAME_UNKNOWN';
    end if;
    v_actor := public.noxia_person_actor(p_to_person_id);
    select coalesce(max(tick_number), 0) into v_tick from public.tick_log;
    update public.profiles set credits = credits - p_amount where id = p_profile_id;
    insert into public.npc_ledger(actor_id, tick, kind, goods_delta, credit_delta, location_id, ref, note)
    values (v_actor, v_tick, 'gift_received', 0, p_amount, null, 'credit_transfer:' || p_request_id, case when p_channel = 'cash' then 'Bar von einem Spieler' else 'Überweisung von einem Spieler' end);
  else
    raise exception 'NOXIA_TRANSFER_RECIPIENT_UNKNOWN';
  end if;

  insert into public.credit_transfers(request_id, channel, from_profile_id, to_profile_id, to_person_id, amount, note, place)
  values (p_request_id, p_channel, p_profile_id, v_to_profile, p_to_person_id, p_amount, nullif(left(btrim(coalesce(p_note, '')), 120), ''), nullif(left(btrim(coalesce(p_place, '')), 80), ''));
  return jsonb_build_object('ok', true, 'duplicate', false, 'credits', v_credits - p_amount, 'toName', v_to_name, 'amount', p_amount);
end $$;

-- Bewohner zahlt einem Spieler (für Population: Gefälligkeit, Auftrag, Rückzahlung).
create or replace function public.noxia_person_pay_player(
  p_person_id uuid, p_profile_id uuid, p_amount integer, p_request_id uuid, p_channel text default 'cash', p_note text default null, p_place text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor uuid; v_balance numeric; v_tick bigint;
begin
  if p_amount is null or p_amount < 1 or p_amount > 10000 then raise exception 'NOXIA_TRANSFER_AMOUNT'; end if;
  if exists (select 1 from public.credit_transfers where request_id = p_request_id) then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  v_actor := public.noxia_person_actor(p_person_id);
  perform 1 from public.actors where id = v_actor for update;
  select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = v_actor;
  if v_balance < p_amount then raise exception 'NOXIA_CREDITS_INSUFFICIENT'; end if;
  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  select coalesce(max(tick_number), 0) into v_tick from public.tick_log;
  insert into public.npc_ledger(actor_id, tick, kind, goods_delta, credit_delta, location_id, ref, note)
  values (v_actor, v_tick, 'gift_sent', 0, -p_amount, null, 'credit_transfer:' || p_request_id, 'An einen Spieler');
  update public.profiles set credits = credits + p_amount where id = p_profile_id;
  insert into public.credit_transfers(request_id, channel, from_person_id, to_profile_id, amount, note, place)
  values (p_request_id, coalesce(p_channel, 'cash'), p_person_id, p_profile_id, p_amount, nullif(left(btrim(coalesce(p_note, '')), 120), ''), nullif(left(btrim(coalesce(p_place, '')), 80), ''));
  return jsonb_build_object('ok', true, 'duplicate', false, 'amount', p_amount);
end $$;

revoke all on function public.noxia_person_actor(uuid), public.noxia_player_give_credits(uuid, uuid, text, integer, text, uuid, text, text),
  public.noxia_person_pay_player(uuid, uuid, integer, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.noxia_person_actor(uuid), public.noxia_player_give_credits(uuid, uuid, text, integer, text, uuid, text, text),
  public.noxia_person_pay_player(uuid, uuid, integer, uuid, text, text, text) to service_role;
