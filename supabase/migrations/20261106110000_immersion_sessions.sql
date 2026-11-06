-- 20261106110000_immersion_sessions.sql
-- Erlebnis-Studio: Sitzungen im Pod, Bezahlung, gemeinsames Erleben (Thomas, 06.11.2026:
-- „mitarbeiter empfang, preise gemeinsames erleben“).
-- Preise/Dauer/Rabatt rechnet der Server (lib/game/immersion.ts), die Funktion bucht nur.
-- Gemeinsames Erleben: Sitzungen mit gleicher party_id im selben Studio, gleiches Erlebnis; ab 2 Personen Rabatt je Kopf.
-- Geld: Abbuchung beim Spieler, Gutschrift in der Koloniekasse der Erde (colony_ledger 'payout', Notiz „Studioerloes …“).
-- Rücknahme: drop function noxia_start_immersion, noxia_end_immersion; drop table immersion_sessions.

set search_path to public;

create table if not exists public.immersion_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  studio_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  experience_id text not null,
  category text not null check (category in ('chronotrip', 'game', 'abstract')),
  party_id uuid not null default gen_random_uuid(),
  price integer not null check (price >= 0),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz
);
create unique index if not exists immersion_sessions_one_open on public.immersion_sessions (profile_id) where ended_at is null;
create index if not exists immersion_sessions_party_idx on public.immersion_sessions (party_id) where ended_at is null;
create index if not exists immersion_sessions_studio_idx on public.immersion_sessions (studio_entity_id) where ended_at is null;
alter table public.immersion_sessions enable row level security;
comment on table public.immersion_sessions is 'Pod-Sitzungen im Erlebnis-Studio. Offen: ended_at is null. party_id verbindet gemeinsames Erleben.';

create or replace function public.noxia_start_immersion(
  p_profile_id uuid, p_studio_entity_id uuid, p_experience_id text, p_category text,
  p_party_id uuid, p_price integer, p_duration_seconds integer, p_party_max integer
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_credits integer;
  v_earth uuid;
  v_tick bigint;
  v_party uuid := coalesce(p_party_id, gen_random_uuid());
  v_members integer;
  v_session public.immersion_sessions;
begin
  select credits into v_credits from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'NOXIA_PROFILE_NOT_FOUND'; end if;
  update public.immersion_sessions set ended_at = now() where profile_id = p_profile_id and ended_at is null and ends_at <= now();
  if exists (select 1 from public.immersion_sessions where profile_id = p_profile_id and ended_at is null) then raise exception 'NOXIA_IMMERSION_ALREADY_ACTIVE'; end if;
  if p_price < 0 or p_duration_seconds < 1 then raise exception 'NOXIA_IMMERSION_INVALID'; end if;
  if p_party_id is not null then
    select count(*) into v_members from public.immersion_sessions
     where party_id = p_party_id and ended_at is null and ends_at > now() and studio_entity_id = p_studio_entity_id and experience_id = p_experience_id;
    if v_members = 0 then raise exception 'NOXIA_IMMERSION_PARTY_GONE'; end if;
    if v_members >= p_party_max then raise exception 'NOXIA_IMMERSION_PARTY_FULL'; end if;
  end if;
  if v_credits < p_price then raise exception 'NOXIA_IMMERSION_INSUFFICIENT:%:%', p_price, v_credits; end if;

  update public.profiles set credits = credits - p_price where id = p_profile_id;
  select id into v_earth from public.locations where slug = 'earth';
  select coalesce(max(tick_number), 0) into v_tick from public.tick_log;
  if p_price > 0 and v_earth is not null then
    insert into public.colony_ledger(location_id, tick, entry_type, profile_id, resource_type, amount, note)
    values (v_earth, v_tick, 'payout', p_profile_id, null, p_price, format('Studioerloes Erlebnis-Studio (%s)', p_experience_id));
  end if;
  insert into public.immersion_sessions (profile_id, studio_entity_id, experience_id, category, party_id, price, ends_at)
  values (p_profile_id, p_studio_entity_id, p_experience_id, p_category, v_party, p_price, now() + make_interval(secs => p_duration_seconds))
  returning * into v_session;
  return jsonb_build_object('ok', true, 'session', to_jsonb(v_session), 'credits', v_credits - p_price);
end $$;

create or replace function public.noxia_end_immersion(p_profile_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_session public.immersion_sessions;
begin
  update public.immersion_sessions set ended_at = now() where profile_id = p_profile_id and ended_at is null returning * into v_session;
  return jsonb_build_object('ok', true, 'ended', v_session.id is not null);
end $$;

revoke all on function public.noxia_start_immersion(uuid, uuid, text, text, uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.noxia_end_immersion(uuid) from public, anon, authenticated;
