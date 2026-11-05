-- 20261105090000_conversation_privacy_no_reading.sql
-- NOXIA-PRIVACY-0004 (Thomas, 05.11.2026): Gespräche werden nur automatisch
-- ausgewertet, kein Mensch liest mit. Ersetzt die Rohtext-Diagnostik aus
-- NOXIA-PRIVACY-0003.
--
--  * Auswertungssichten ohne Wortlaut und ohne Spieler-ID
--  * Löschfrist: Wortlaut nach 14 Tagen weg (Kennzahlen bleiben)
--  * conversation_reports: nur was Spieler selbst melden, ist lesbar (90 Tage)
--  * Gespräche von Admin-Testkonten bleiben lesbar und werden nicht gekürzt

set search_path to public;

-- 1. Sichten mit Wortlaut oder Spieler-ID ersetzen ----------------------------

drop view if exists public.npc_conversation_top_questions;
drop view if exists public.npc_conversation_real_world;
drop view if exists public.npc_conversation_followups;
drop view if exists public.npc_conversation_loops;
drop view if exists public.player_room_log;

-- Reale Meldungen: welche Schlagzeile, welche Figur – ohne Gesprächstext.
create view public.npc_conversation_real_world
with (security_invoker = on) as
select date_trunc('day', created_at)::date as day, npc_name, location_name, headline, headline_source,
       count(*) as turns
from public.npc_conversation_log
where headline is not null
group by 1, 2, 3, 4, 5
order by 1 desc;

-- Was eine Figur nach einem Gespräch tut – Thema und Aktion, kein Wortlaut.
create view public.npc_conversation_followups
with (security_invoker = on) as
select c.created_at, c.npc_name, c.topic,
       c.world_action                                as action_in_conversation,
       d.occurred_at                                 as next_decision_at,
       d.payload->>'action_code'                     as next_action,
       d.payload->>'reason'                          as next_reason
from public.npc_conversation_log c
left join lateral (
  select e.occurred_at, e.payload
  from public.population_events e
  where e.actor_person_id = c.npc_person_id
    and e.event_type = 'person_decision'
    and e.occurred_at > c.created_at
    and e.occurred_at <= c.created_at + interval '2 hours'
  order by e.occurred_at
  limit 1
) d on true
where c.npc_person_id is not null and not c.opening
order by c.created_at desc;

-- Gesprächsschleifen je Figur und Ort, nicht je Spieler.
create view public.npc_conversation_loops
with (security_invoker = on) as
select npc_key, npc_name, location_name,
       count(*) filter (where outcome in ('repeat_hint', 'breakoff')) as loop_turns,
       count(*) filter (where outcome = 'breakoff')                   as breakoffs,
       count(distinct player_profile_id)                              as players,
       max(created_at)                                                as last_at
from public.npc_conversation_log
group by npc_key, npc_name, location_name
having count(*) filter (where outcome in ('repeat_hint', 'breakoff')) > 0
order by last_at desc;

-- Raumgeschehen ohne Wortlaut: wer kommt/geht, Thema und Kennzeichen von Nachrichten.
create view public.player_room_log
with (security_invoker = on) as
  select m.created_at, m.room_key, m.room_name, 'message'::text as kind, m.topic, m.flags, m.peers
    from public.player_room_messages m
  union all
  select e.created_at, e.room_key, e.room_name, e.kind, null, '{}'::text[], e.peers
    from public.player_room_events e;

revoke all on public.npc_conversation_real_world, public.npc_conversation_followups,
  public.npc_conversation_loops, public.player_room_log from public, anon, authenticated;
grant select on public.npc_conversation_real_world, public.npc_conversation_followups,
  public.npc_conversation_loops, public.player_room_log to service_role;

-- 2. Löschfrist -------------------------------------------------------------

alter table public.npc_conversation_log add column if not exists text_purged_at timestamptz;

-- Entfernt den Wortlaut geschützter Gespräche nach p_days Tagen. Kennzahlen
-- (Thema, Ausgang, Ort, Figur, Weltaktion, Kausalspur) bleiben für die Auswertung.
-- Admin-Testkonten sind ausgenommen. Abgelaufene Meldungen werden gelöscht.
create or replace function public.purge_conversation_raw_text(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(p_days, 1));
  npc_rows integer;
  room_rows integer;
  report_rows integer;
begin
  update public.npc_conversation_log l
     set player_text = '', player_norm = '', npc_reply = null, text_purged_at = now()
   where l.created_at < cutoff
     and l.text_purged_at is null
     and not exists (select 1 from public.admin_profiles a where a.profile_id = l.player_profile_id);
  get diagnostics npc_rows = row_count;

  delete from public.player_room_messages m
   where m.created_at < cutoff
     and not exists (select 1 from public.admin_profiles a where a.profile_id = m.sender_id);
  get diagnostics room_rows = row_count;

  delete from public.conversation_reports r where r.expires_at < now();
  get diagnostics report_rows = row_count;

  return jsonb_build_object('npc_turns_purged', npc_rows, 'room_messages_deleted', room_rows,
                            'reports_expired', report_rows, 'cutoff', cutoff);
end;
$$;

-- 3. Meldungen durch Spieler ------------------------------------------------

create table if not exists public.conversation_reports (
  id bigint generated always as identity primary key,
  reporter_profile_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('npc', 'room')),
  reason text not null check (reason in ('error', 'harassment', 'feedback', 'other')),
  comment text check (comment is null or length(comment) <= 500),
  npc_person_id uuid,
  npc_name text,
  room_key text,
  location_name text,
  -- Vom Spieler freigegebener Ausschnitt: [{speaker, text, at}]
  excerpt jsonb not null default '[]'::jsonb check (jsonb_typeof(excerpt) = 'array'),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);
create index if not exists conversation_reports_created_idx on public.conversation_reports(created_at desc);
alter table public.conversation_reports enable row level security;
revoke all on public.conversation_reports from public, anon, authenticated;
grant select, insert, update, delete on public.conversation_reports to service_role;

revoke all on function public.purge_conversation_raw_text(integer) from public, anon, authenticated;
grant execute on function public.purge_conversation_raw_text(integer) to service_role;

-- 4. Rohtext-Diagnostik aus NOXIA-PRIVACY-0003 stilllegen ---------------------
-- Die Einwilligungstabelle war nie in Gebrauch (0 Zeilen) und entfällt mit dem
-- neuen Grundsatz. Das Lese-Audit bleibt für Abrufe gemeldeter Ausschnitte.
drop table if exists public.player_conversation_diagnostic_consent;
alter table public.admin_conversation_read_audit alter column conversation_log_id drop not null;
alter table public.admin_conversation_read_audit add column if not exists report_id bigint;
