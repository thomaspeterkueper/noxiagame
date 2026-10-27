-- Gesprächsprotokoll Spieler ↔ Figur für die Testphase (Wunsch Thomas, 27.10.2026).
--
-- Jede Wortmeldung wird als eigene Zeile angehängt (append-only), damit sich
-- auswerten lässt, was Spieler fragen, wo Figuren scheitern und wo sich
-- Gespräche im Kreis drehen. Getrennt vom Gesprächsgedächtnis der Figur
-- (npc_player_conversation_memory), das bewusst vergisst.
--
-- Nur für den Server (Service-Rolle): RLS an, keine Policies. Löscht ein
-- Spieler sein Konto, verschwinden seine Zeilen mit (on delete cascade).
-- Vor einem öffentlichen Start: Hinweis für Spieler und Aufbewahrungsfrist
-- festlegen (docs/workstreams/population-economy.md).

set search_path to public;

create table if not exists public.npc_conversation_log (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  player_profile_id uuid not null references auth.users(id) on delete cascade,
  npc_person_id    uuid references public.people(id) on delete set null,
  npc_key          text not null,
  npc_name         text,
  npc_role         text,
  location_name    text,
  opening          boolean not null default false,
  turn_index       integer not null default 0,
  player_text      text not null,
  player_norm      text not null default '',
  npc_reply        text,
  outcome          text not null check (outcome in ('reply', 'repeat_hint', 'breakoff', 'dismissed', 'error')),
  similar_count    integer not null default 0,
  world_action     text,
  error_code       text,
  provider_ms      integer,
  model            text
);

create index if not exists npc_conversation_log_pair_idx
  on public.npc_conversation_log (player_profile_id, npc_key, created_at desc);
create index if not exists npc_conversation_log_created_idx
  on public.npc_conversation_log (created_at desc);

alter table public.npc_conversation_log enable row level security;
revoke all on public.npc_conversation_log from anon, authenticated;

-- Auswertung --------------------------------------------------------------

-- Tagesübersicht: Umfang, Abbrüche, Fehler, Antwortlänge.
create or replace view public.npc_conversation_daily
with (security_invoker = on) as
select date_trunc('day', created_at)::date               as day,
       count(*)                                           as turns,
       count(distinct player_profile_id)                  as players,
       count(distinct npc_key)                            as npcs,
       count(*) filter (where opening)                    as openings,
       count(*) filter (where outcome = 'repeat_hint')    as repeat_hints,
       count(*) filter (where outcome = 'breakoff')       as breakoffs,
       count(*) filter (where outcome = 'dismissed')      as dismissed,
       count(*) filter (where outcome = 'error')          as errors,
       round(avg(length(npc_reply)) filter (where outcome = 'reply'))::int as avg_reply_chars,
       round(avg(provider_ms) filter (where provider_ms is not null))::int as avg_provider_ms
from public.npc_conversation_log
group by 1
order by 1 desc;

-- Was Spieler am häufigsten fragen (normalisiert, ohne Eröffnungen).
create or replace view public.npc_conversation_top_questions
with (security_invoker = on) as
select player_norm,
       count(*)                          as asked,
       count(distinct player_profile_id) as players,
       count(distinct npc_key)           as npcs,
       max(created_at)                   as last_asked,
       (array_agg(npc_reply order by created_at desc))[1] as last_reply
from public.npc_conversation_log
where not opening and length(player_norm) >= 8
group by player_norm
order by asked desc;

-- Gespräche, die sich im Kreis gedreht haben (Hinweis oder Abbruch).
create or replace view public.npc_conversation_loops
with (security_invoker = on) as
select player_profile_id, npc_key, npc_name, location_name,
       count(*) filter (where outcome in ('repeat_hint', 'breakoff')) as loop_turns,
       count(*) filter (where outcome = 'breakoff')                   as breakoffs,
       min(created_at) as first_at, max(created_at) as last_at
from public.npc_conversation_log
group by player_profile_id, npc_key, npc_name, location_name
having count(*) filter (where outcome in ('repeat_hint', 'breakoff')) > 0
order by last_at desc;

revoke all on public.npc_conversation_daily, public.npc_conversation_top_questions, public.npc_conversation_loops
  from anon, authenticated;

-- Übernahme: Was das Gesprächsgedächtnis der Figuren noch enthält, kommt
-- einmalig ins Protokoll, damit die Auswertung nicht bei null beginnt.
-- (Nur beim ersten Anlegen; Normalisierung wie normalizeUtterance.)
insert into public.npc_conversation_log
  (created_at, player_profile_id, npc_person_id, npc_key, npc_name, location_name,
   opening, player_text, player_norm, npc_reply, outcome, world_action)
select coalesce((ex->>'at')::timestamptz, m.last_interaction_at, now()),
       m.player_profile_id, m.npc_person_id, m.npc_person_id::text, p.display_name,
       nullif(ex->>'location', ''),
       (ex->>'player') like '(tritt heran%',
       ex->>'player',
       case when (ex->>'player') like '(tritt heran%' then '' else trim(regexp_replace(regexp_replace(replace(replace(replace(replace(lower(ex->>'player'), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g')) end,
       ex->>'npc', 'reply', nullif(ex->>'action', '')
from public.npc_player_conversation_memory m
join auth.users u on u.id = m.player_profile_id
left join public.people p on p.id = m.npc_person_id
cross join lateral jsonb_array_elements(coalesce(m.recent_exchanges, '[]'::jsonb)) ex
where coalesce(ex->>'player', '') <> ''
  and not exists (select 1 from public.npc_conversation_log);
