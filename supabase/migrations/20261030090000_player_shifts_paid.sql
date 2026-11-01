-- 20261030090000_player_shifts_paid.sql
-- Spieler arbeiten bezahlt im Lokal (R-20; Thomas, 30.10.2026):
-- „Bezahlung freischalten, aber Geld gibt es nur, wenn auch die Aufgaben erfüllt
-- wurden, sonst Abzüge; eventuell keine Folgeanstellung am selben Ort, wenn bei
-- drei Schichten immer noch keine Aufgaben erledigt wurden. Für Nichtstun gibt es
-- kein Geld.“
-- Regeln wie lib/game/hospitality/playerShift.ts (shiftPay, shiftStanding):
--   * Einsatz 300 echte Sekunden, zählt als 4 Spielstunden (Putzen 3).
--   * Voller Lohn = Stundenlohn × Spielstunden × gespielter Anteil.
--   * Pflichten kommen im Takt der Stelle; wer drei Viertel davon erledigt
--     (Gästeaufgaben zählen mit), bekommt den vollen Lohn, darunter anteilig,
--     ohne erledigte Aufgabe nichts.
--   * Drei Schichten hintereinander ohne erledigte Aufgabe im selben Haus:
--     dort sieben Tage keine Schicht mehr.
--   * Je Haus eine Schicht je 24 echte Minuten (ein Spieltag bei 60×).
-- Zahlt der Betreiber wie pay_npc_wage: Betreiberkonto, sonst Eigentümer, sonst Ort.

create table if not exists public.player_shifts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tile_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  role text not null check (role in ('door','bar','dj','service','reception','cleaning')),
  wage_per_hour integer not null default 0,
  game_hours numeric not null,
  employer_actor_id uuid references public.actors(id),
  own_venue boolean not null default false,
  referral jsonb,
  status text not null default 'active' check (status in ('active','ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  played_s integer,
  tasks_done integer not null default 0,
  guest_tasks integer not null default 0,
  task_keys text[] not null default '{}',
  last_task_at timestamptz,
  offered_duties integer,
  required_tasks integer,
  full_wage integer,
  wage_credits integer,
  deduction_credits integer
);
create index if not exists player_shifts_profile_idx on public.player_shifts(profile_id, status);
create index if not exists player_shifts_venue_idx on public.player_shifts(tile_entity_id, profile_id, started_at desc);
create unique index if not exists player_shifts_one_active on public.player_shifts(profile_id) where status = 'active';
alter table public.player_shifts enable row level security;

create or replace function public.noxia_shift_roles(p_kind text) returns text[]
language sql immutable as $$
  select case p_kind
    when 'nightclub' then array['door','bar','dj','cleaning']
    when 'bar' then array['bar','cleaning']
    when 'hotel' then array['reception','cleaning']
    when 'cafe' then array['service','cleaning']
    when 'restaurant' then array['service','cleaning']
    else array[]::text[] end
$$;

create or replace function public.noxia_shift_wage_rate(p_role text) returns integer
language sql immutable as $$
  select case p_role when 'door' then 9 when 'bar' then 8 when 'dj' then 10 when 'service' then 7 when 'reception' then 7 when 'cleaning' then 6 else 0 end
$$;

create or replace function public.noxia_shift_game_hours(p_role text) returns integer
language sql immutable as $$ select case p_role when 'cleaning' then 3 else 4 end $$;

-- Pflichten, die bis played_s erschienen sind (Takt wie PERIODS in playerShift.ts).
create or replace function public.noxia_shift_offered_duties(p_role text, p_played_s numeric) returns integer
language sql immutable as $$
  select case p_role
    when 'bar' then floor(p_played_s / 40)
    when 'door' then floor(p_played_s / 60)
    when 'dj' then floor(p_played_s / 35)
    when 'service' then floor(p_played_s / 45)
    when 'reception' then floor(p_played_s / 60)
    when 'cleaning' then floor(p_played_s / 40) + floor(p_played_s / 90)
    else 0 end::integer
$$;

create or replace function public.noxia_shift_duty_period(p_kind text) returns integer
language sql immutable as $$
  select case p_kind when 'rinse' then 40 when 'patrol' then 60 when 'music' then 35 when 'clear' then 45 when 'keys' then 60 when 'mop' then 40 when 'toilet' then 90 else null end
$$;

create or replace function public.noxia_shift_role_duties(p_role text) returns text[]
language sql immutable as $$
  select case p_role when 'bar' then array['rinse'] when 'door' then array['patrol'] when 'dj' then array['music']
    when 'service' then array['clear'] when 'reception' then array['keys'] when 'cleaning' then array['mop','toilet'] else array[]::text[] end
$$;

create or replace function public.noxia_shift_role_guest_kinds(p_role text) returns text[]
language sql immutable as $$
  select case p_role when 'bar' then array['serve'] when 'service' then array['serve'] when 'door' then array['admit']
    when 'reception' then array['greet'] when 'cleaning' then array['wipe'] else array[]::text[] end
$$;

-- Arbeitgeberkonto und Name: Betreiber, sonst Eigentümer (Spieler), sonst Ort.
create or replace function public.noxia_venue_employer(p_tile_entity_id uuid)
returns table(actor_id uuid, kind text, name text, owner_profile_id uuid, balance numeric)
language sql stable security definer set search_path = public as $$
  with t as (select * from public.tile_entities where id = p_tile_entity_id),
  e as (
    select coalesce(t.actor_id,
                    (select pea.actor_id from public.profile_economic_actors pea where pea.profile_id = t.profile_id),
                    (select lpa.actor_id from public.location_public_actors lpa where lpa.location_id = t.location_id)) as actor_id,
           case when t.actor_id is not null then 'operator' when t.profile_id is not null then 'owner' else 'public' end as kind,
           t.profile_id
      from t)
  select e.actor_id, e.kind,
         case e.kind
           when 'owner' then coalesce((select p.username from public.profiles p where p.id = e.profile_id), 'der Eigentümer')
           when 'public' then 'die Gemeinde'
           else coalesce((select a.display_name from public.actors a where a.id = e.actor_id), 'der Betreiber') end,
         e.profile_id,
         coalesce((select sum(l.credit_delta) from public.npc_ledger l where l.actor_id = e.actor_id), 0)
    from e
$$;

-- Abrechnen: Lohn nach erledigten Aufgaben, vom Arbeitgeber an den Spieler.
create or replace function public.noxia_close_player_shift(p_shift_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.player_shifts%rowtype;
  v_played numeric; v_offered integer; v_required integer; v_full integer; v_wage integer; v_balance numeric;
  v_tick bigint; v_location uuid; v_paid integer;
begin
  select * into s from public.player_shifts where id = p_shift_id for update;
  if not found then raise exception 'NOXIA_SHIFT_NOT_FOUND'; end if;
  if s.status = 'ended' then
    return jsonb_build_object('wage', s.wage_credits, 'full', s.full_wage, 'deduction', s.deduction_credits, 'tasks', s.tasks_done, 'required', s.required_tasks, 'duplicate', true);
  end if;
  v_played := least(300, greatest(0, extract(epoch from now() - s.started_at)));
  v_offered := public.noxia_shift_offered_duties(s.role, v_played);
  v_required := greatest(1, ceil(0.75 * v_offered))::integer;
  v_full := round(s.wage_per_hour * s.game_hours * (v_played / 300.0))::integer;
  v_wage := case when s.tasks_done = 0 then 0 else round(v_full * least(1, s.tasks_done::numeric / v_required))::integer end;
  v_paid := 0;
  if v_wage > 0 and s.employer_actor_id is not null and not s.own_venue then
    select coalesce(sum(credit_delta), 0) into v_balance from public.npc_ledger where actor_id = s.employer_actor_id;
    v_paid := least(v_wage, greatest(0, floor(v_balance))::integer);
    if v_paid > 0 then
      select coalesce(max(tick_number), 0) into v_tick from public.tick_log;
      select location_id into v_location from public.tile_entities where id = s.tile_entity_id;
      insert into public.npc_ledger(actor_id, tick, kind, goods_delta, credit_delta, location_id, ref, note)
      values (s.employer_actor_id, v_tick, 'wage', 0, -v_paid, v_location, 'player_shift:' || s.id, 'Lohn Spielerschicht (' || s.role || ')');
      update public.profiles set credits = credits + v_paid where id = s.profile_id;
    end if;
  end if;
  update public.player_shifts set status = 'ended', ended_at = now(), played_s = round(v_played), offered_duties = v_offered,
    required_tasks = v_required, full_wage = v_full, wage_credits = v_paid, deduction_credits = greatest(0, v_full - v_wage)
   where id = s.id;
  return jsonb_build_object('wage', v_paid, 'earned', v_wage, 'full', v_full, 'deduction', greatest(0, v_full - v_wage),
    'tasks', s.tasks_done, 'guestTasks', s.guest_tasks, 'required', v_required, 'offered', v_offered, 'ownVenue', s.own_venue,
    'shortPaid', v_wage - v_paid);
end $$;

-- Laufende Schichten über der Zeit schließen (Einsatz + eine Minute Spielraum).
create or replace function public.noxia_close_overdue_player_shifts(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.player_shifts where profile_id = p_profile_id and status = 'active' and started_at < now() - interval '360 seconds' loop
    perform public.noxia_close_player_shift(r.id);
  end loop;
end $$;

-- Stand des Spielers in einem Haus: Leerschichten in Folge, Sperre, Pause.
create or replace function public.noxia_player_shift_standing(p_profile_id uuid, p_tile_entity_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_streak integer := 0; v_last_empty_end timestamptz; v_last_start timestamptz; r record; v_blocked timestamptz;
  v_last jsonb;
begin
  for r in select tasks_done, ended_at from public.player_shifts
            where profile_id = p_profile_id and tile_entity_id = p_tile_entity_id and status = 'ended'
            order by ended_at desc limit 3 loop
    exit when r.tasks_done > 0;
    v_streak := v_streak + 1;
    if v_last_empty_end is null then v_last_empty_end := r.ended_at; end if;
  end loop;
  if v_streak >= 3 and v_last_empty_end > now() - interval '7 days' then v_blocked := v_last_empty_end + interval '7 days'; end if;
  select max(started_at) into v_last_start from public.player_shifts where profile_id = p_profile_id and tile_entity_id = p_tile_entity_id;
  select jsonb_build_object('role', role, 'tasks', tasks_done, 'required', required_tasks, 'wage', wage_credits, 'full', full_wage, 'deduction', deduction_credits, 'endedAt', ended_at)
    into v_last from public.player_shifts where profile_id = p_profile_id and tile_entity_id = p_tile_entity_id and status = 'ended' order by ended_at desc limit 1;
  return jsonb_build_object('emptyStreak', v_streak, 'blockedUntil', v_blocked,
    'nextShiftAt', case when v_last_start > now() - interval '24 minutes' then v_last_start + interval '24 minutes' end,
    'last', v_last);
end $$;

create or replace function public.noxia_player_shift_state(p_profile_id uuid, p_tile_entity_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.tile_entities%rowtype; e record; v_roles text[]; v_open text[] := '{}'; v_wages jsonb := '{}'; v_role text;
  a public.player_shifts%rowtype; v_active jsonb;
begin
  perform public.noxia_close_overdue_player_shifts(p_profile_id);
  select * into t from public.tile_entities where id = p_tile_entity_id and status = 'active';
  if not found then raise exception 'NOXIA_SHIFT_VENUE_NOT_FOUND'; end if;
  select * into e from public.noxia_venue_employer(p_tile_entity_id);
  v_roles := public.noxia_shift_roles(t.entity_id);
  foreach v_role in array v_roles loop
    v_wages := v_wages || jsonb_build_object(v_role, public.noxia_shift_wage_rate(v_role));
    if not exists (select 1 from public.player_shifts s where s.tile_entity_id = t.id and s.role = v_role and s.status = 'active' and s.profile_id <> p_profile_id)
       and (e.owner_profile_id = p_profile_id or e.balance >= public.noxia_shift_wage_rate(v_role) * public.noxia_shift_game_hours(v_role)) then
      v_open := v_open || v_role;
    end if;
  end loop;
  select * into a from public.player_shifts where profile_id = p_profile_id and status = 'active';
  if found then
    v_active := jsonb_build_object('shiftId', a.id, 'role', a.role, 'startedAt', a.started_at, 'wagePerHour', a.wage_per_hour, 'gameHours', a.game_hours,
      'tileEntityId', a.tile_entity_id, 'tasks', a.tasks_done, 'doneKeys', to_jsonb(a.task_keys));
  end if;
  return jsonb_build_object('open', to_jsonb(v_open), 'wages', v_wages, 'active', v_active,
    'employer', jsonb_build_object('kind', e.kind, 'name', e.name, 'ownVenue', coalesce(e.owner_profile_id = p_profile_id, false)),
    'standing', public.noxia_player_shift_standing(p_profile_id, p_tile_entity_id),
    'rules', jsonb_build_object('fullPayShare', 0.75, 'emptyShiftLimit', 3, 'blockDays', 7, 'einsatzS', 300, 'cooldownMin', 24));
end $$;

create or replace function public.noxia_start_player_shift(p_profile_id uuid, p_tile_entity_id uuid, p_role text, p_referral jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare st jsonb; e record; t public.tile_entities%rowtype; v_id uuid; v_started timestamptz; v_rate integer; v_own boolean;
begin
  st := public.noxia_player_shift_state(p_profile_id, p_tile_entity_id);
  if st->'active' is not null and st->'active' <> 'null'::jsonb then raise exception 'NOXIA_SHIFT_ALREADY_ACTIVE'; end if;
  if (st->'standing'->>'blockedUntil') is not null then raise exception 'NOXIA_SHIFT_BLOCKED'; end if;
  if (st->'standing'->>'nextShiftAt') is not null then raise exception 'NOXIA_SHIFT_COOLDOWN'; end if;
  if not (st->'open') ? p_role then raise exception 'NOXIA_SHIFT_ROLE_NOT_OPEN'; end if;
  select * into t from public.tile_entities where id = p_tile_entity_id;
  select * into e from public.noxia_venue_employer(p_tile_entity_id);
  v_own := coalesce(e.owner_profile_id = p_profile_id, false);
  v_rate := case when v_own then 0 else public.noxia_shift_wage_rate(p_role) end;
  insert into public.player_shifts(profile_id, tile_entity_id, role, wage_per_hour, game_hours, employer_actor_id, own_venue, referral)
  values (p_profile_id, p_tile_entity_id, p_role, v_rate, public.noxia_shift_game_hours(p_role), e.actor_id, v_own, p_referral)
  returning id, started_at into v_id, v_started;
  return jsonb_build_object('shiftId', v_id, 'startedAt', v_started, 'wagePerHour', v_rate, 'gameHours', public.noxia_shift_game_hours(p_role), 'ownVenue', v_own);
end $$;

-- Eine erledigte Aufgabe. Pflichten nur, wenn ihr Takt schon da ist; Gästeaufgaben
-- passend zur Stelle; höchstens eine Aufgabe je 2 Sekunden, jede nur einmal.
create or replace function public.noxia_player_shift_task(p_profile_id uuid, p_shift_id uuid, p_task_key text, p_kind text, p_guest boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.player_shifts%rowtype; v_elapsed numeric; v_slot integer; v_period integer;
begin
  select * into s from public.player_shifts where id = p_shift_id and profile_id = p_profile_id for update;
  if not found or s.status <> 'active' then raise exception 'NOXIA_SHIFT_NOT_ACTIVE'; end if;
  v_elapsed := extract(epoch from now() - s.started_at);
  if v_elapsed > 330 then raise exception 'NOXIA_SHIFT_NOT_ACTIVE'; end if;
  if p_task_key is null or length(p_task_key) > 120 or split_part(p_task_key, ':', 1) <> p_kind then raise exception 'NOXIA_SHIFT_TASK_INVALID'; end if;
  if p_task_key = any(s.task_keys) then return jsonb_build_object('ok', true, 'duplicate', true, 'tasks', s.tasks_done, 'tip', 0); end if;
  if s.last_task_at is not null and s.last_task_at > now() - interval '2 seconds' then raise exception 'NOXIA_SHIFT_TASK_TOO_FAST'; end if;
  if p_kind = any(public.noxia_shift_role_duties(s.role)) then
    v_period := public.noxia_shift_duty_period(p_kind);
    v_slot := nullif(split_part(p_task_key, ':', 2), '')::integer;
    if v_slot is null or v_slot < 1 or v_slot * v_period > v_elapsed + 5 then raise exception 'NOXIA_SHIFT_TASK_INVALID'; end if;
  elsif p_kind = any(public.noxia_shift_role_guest_kinds(s.role)) then
    if s.guest_tasks >= 20 then raise exception 'NOXIA_SHIFT_TASK_INVALID'; end if;
  else
    raise exception 'NOXIA_SHIFT_TASK_INVALID';
  end if;
  update public.player_shifts set tasks_done = tasks_done + 1,
    guest_tasks = guest_tasks + case when p_kind = any(public.noxia_shift_role_guest_kinds(s.role)) and p_kind <> 'wipe' then 1 else 0 end,
    task_keys = task_keys || p_task_key, last_task_at = now()
   where id = s.id;
  return jsonb_build_object('ok', true, 'tasks', s.tasks_done + 1, 'tip', 0);
end $$;

create or replace function public.noxia_end_player_shift(p_profile_id uuid, p_shift_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_tile uuid;
begin
  select tile_entity_id into v_tile from public.player_shifts where id = p_shift_id and profile_id = p_profile_id;
  if not found then raise exception 'NOXIA_SHIFT_NOT_FOUND'; end if;
  v := public.noxia_close_player_shift(p_shift_id);
  return v || jsonb_build_object('credits', (select credits from public.profiles where id = p_profile_id),
    'standing', public.noxia_player_shift_standing(p_profile_id, v_tile));
end $$;

revoke all on function public.noxia_venue_employer(uuid), public.noxia_close_player_shift(uuid), public.noxia_close_overdue_player_shifts(uuid),
  public.noxia_player_shift_standing(uuid, uuid), public.noxia_player_shift_state(uuid, uuid), public.noxia_start_player_shift(uuid, uuid, text, jsonb),
  public.noxia_player_shift_task(uuid, uuid, text, text, boolean), public.noxia_end_player_shift(uuid, uuid) from public, anon, authenticated;
