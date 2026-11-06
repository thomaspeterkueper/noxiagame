-- NOXIA #625: authoritative player presence, no browser-dependent timeout.
-- Stage 1: tracks warnings/handoffs, but DOES NOT yet move actors or close conversations.
create table if not exists public.player_absence_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id text,
  mode text not null default 'online' check (mode in ('online', 'idle-warning', 'away-autopilot')),
  last_interaction_at timestamptz not null default now(),
  disconnected_at timestamptz,
  handoff_at timestamptz,
  reason text check (reason is null or reason in ('idle', 'logout', 'disconnect')),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists player_absence_due_idx
  on public.player_absence_presence(last_interaction_at)
  where mode <> 'away-autopilot';
alter table public.player_absence_presence enable row level security;
revoke all on public.player_absence_presence from anon, authenticated;
-- Service role only. User identity is validated at the API boundary.
create or replace function public.noxia_presence_signal(
  p_user_id uuid, p_session_id text, p_signal text
) returns public.player_absence_presence
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r public.player_absence_presence;
  t timestamptz := clock_timestamp();
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if p_session_id is null or length(p_session_id) < 8 or length(p_session_id) > 80 then
    raise exception 'invalid session';
  end if;
  if p_signal not in ('resume', 'activity', 'logout', 'disconnect') then
    raise exception 'invalid signal';
  end if;
  insert into public.player_absence_presence (user_id, session_id, last_interaction_at)
    values (p_user_id, p_session_id, t) on conflict (user_id) do nothing;
  select * into r from public.player_absence_presence where user_id = p_user_id for update;

  if p_signal = 'resume' then
    update public.player_absence_presence set
      session_id = p_session_id, mode = 'online', last_interaction_at = t,
      disconnected_at = null, handoff_at = null, reason = null,
      revision = revision + case when r.mode = 'away-autopilot' then 1 else 0 end,
      updated_at = t where user_id = p_user_id returning * into r;
  elsif r.session_id = p_session_id then
    if p_signal = 'activity' and r.mode <> 'away-autopilot' then
      update public.player_absence_presence set
        mode = 'online', last_interaction_at = t, disconnected_at = null,
        updated_at = t where user_id = p_user_id returning * into r;
    elsif p_signal = 'logout' and r.mode <> 'away-autopilot' then
      update public.player_absence_presence set
        mode = 'away-autopilot', reason = 'logout', handoff_at = t,
        revision = revision + 1, updated_at = t
        where user_id = p_user_id returning * into r;
    elsif p_signal = 'disconnect' and r.mode <> 'away-autopilot' then
      update public.player_absence_presence set
        disconnected_at = coalesce(disconnected_at, t), updated_at = t
        where user_id = p_user_id returning * into r;
    end if;
  end if;
  return r;
end; $$;
revoke all on function public.noxia_presence_signal(uuid,text,text) from public, anon, authenticated;
grant execute on function public.noxia_presence_signal(uuid,text,text) to service_role;

create or replace function public.noxia_advance_presence()
returns table(warned integer, handed_off integer)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  t timestamptz := clock_timestamp();
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  with changed as (
    update public.player_absence_presence p
      set mode = 'away-autopilot',
          reason = case when p.disconnected_at is not null then 'disconnect' else 'idle' end,
          handoff_at = t, revision = p.revision + 1, updated_at = t
      where p.mode <> 'away-autopilot'
        and (p.disconnected_at <= t - interval '90 seconds'
          or (p.disconnected_at is null and p.last_interaction_at <= t - interval '20 minutes'))
      returning p.user_id
  )
  select count(*)::integer into handed_off from changed;
  with changed as (
    update public.player_absence_presence p set mode = 'idle-warning', updated_at = t
      where p.mode = 'online' and p.disconnected_at is null
        and p.last_interaction_at <= t - interval '15 minutes'
      returning p.user_id
  )
  select count(*)::integer into warned from changed;
  return next;
end; $$;
revoke all on function public.noxia_advance_presence() from public, anon, authenticated;
grant execute on function public.noxia_advance_presence() to service_role;
