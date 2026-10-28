-- Verhaltensaufzeichnung der Testphase (Wunsch Thomas, 28.10.2026): was
-- Spieler tun, was nicht geht, wohin sie laufen, worauf sie klicken.
--
-- Eine Zeile je Ereignis aus lib/telemetry/playerActivity.ts, angenommen über
-- /api/game/activity. Keine Tastendrücke, keine Eingabeinhalte, keine
-- Serverantworten. Nur Server (RLS an, keine Policies); löscht ein Spieler
-- sein Konto, gehen seine Zeilen mit. In der Alpha wird nichts gelöscht.

set search_path to public;

create table if not exists public.player_activity_log (
  id                bigint generated always as identity primary key,
  created_at        timestamptz not null default now(),
  occurred_at       timestamptz not null,
  player_profile_id uuid not null references auth.users(id) on delete cascade,
  session_id        text not null,
  kind              text not null check (kind in ('session_start', 'heartbeat', 'view', 'click', 'dead_click',
                                                  'rage_click', 'action', 'api_error', 'js_error', 'position')),
  path              text,
  location          text,
  mode              text,
  target            text,
  data              jsonb
);

create index if not exists player_activity_log_time_idx on public.player_activity_log (occurred_at desc);
create index if not exists player_activity_log_player_idx on public.player_activity_log (player_profile_id, occurred_at desc);
create index if not exists player_activity_log_kind_idx on public.player_activity_log (kind, occurred_at desc);

alter table public.player_activity_log enable row level security;
revoke all on public.player_activity_log from anon, authenticated;

-- Sitzungen: Dauer, aktive Minuten, Klicks, Fehler, Gerät.
create or replace view public.player_sessions
with (security_invoker = on) as
select player_profile_id, session_id,
       min(occurred_at) as started_at, max(occurred_at) as last_at,
       round(extract(epoch from max(occurred_at) - min(occurred_at)) / 60)::int as span_min,
       count(*) filter (where kind = 'heartbeat')                       as active_min,
       count(*) filter (where kind in ('click', 'dead_click', 'rage_click')) as clicks,
       count(*) filter (where kind = 'dead_click')                      as dead_clicks,
       count(*) filter (where kind = 'rage_click')                      as rage_clicks,
       count(*) filter (where kind = 'action')                          as actions,
       count(*) filter (where kind in ('api_error', 'js_error'))        as errors,
       array_agg(distinct location) filter (where location is not null) as locations,
       bool_or((data->>'mobile')::boolean) filter (where kind = 'session_start') as mobile
from public.player_activity_log
group by player_profile_id, session_id
order by started_at desc;

-- Was nicht geht: tote Klicks und Wutklicks je Ansicht und Ziel.
create or replace view public.player_friction
with (security_invoker = on) as
select date_trunc('day', occurred_at)::date as day, kind, location, mode, target,
       count(*) as n, count(distinct player_profile_id) as players
from public.player_activity_log
where kind in ('dead_click', 'rage_click')
group by 1, 2, 3, 4, 5
order by 1 desc, 6 desc;

-- Fehler: Serveranfragen und Browserfehler.
create or replace view public.player_errors
with (security_invoker = on) as
select date_trunc('day', occurred_at)::date as day, kind, target,
       data->>'status' as status, data->>'action' as action, location,
       count(*) as n, count(distinct player_profile_id) as players
from public.player_activity_log
where kind in ('api_error', 'js_error')
group by 1, 2, 3, 4, 5, 6
order by 1 desc, 7 desc;

-- Worauf geklickt wird und welche Spielaktionen laufen.
create or replace view public.player_clicks
with (security_invoker = on) as
select date_trunc('day', occurred_at)::date as day, kind, location, mode, target,
       count(*) as n, count(distinct player_profile_id) as players
from public.player_activity_log
where kind in ('click', 'action')
group by 1, 2, 3, 4, 5
order by 1 desc, 6 desc;

-- Wohin gelaufen wird: Aufenthalte je Szene in 10er-Feldern.
create or replace view public.player_paths
with (security_invoker = on) as
select date_trunc('day', occurred_at)::date as day, target as scene,
       (floor((data->>'x')::numeric / 10) * 10)::int as x10,
       (floor((data->>'y')::numeric / 10) * 10)::int as y10,
       count(*) as samples, count(distinct player_profile_id) as players
from public.player_activity_log
where kind = 'position' and data ? 'x' and data ? 'y'
group by 1, 2, 3, 4
order by 1 desc, 5 desc;

revoke all on public.player_sessions, public.player_friction, public.player_errors,
  public.player_clicks, public.player_paths
  from anon, authenticated;
