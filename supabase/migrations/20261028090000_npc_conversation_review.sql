-- Auswertung der Gespräche, zweiter Schritt (Wunsch Thomas, 27.10.2026):
-- Anliegen je Wortmeldung, die mitgegebene reale Meldung, Gespräche der
-- Figuren untereinander und was eine Figur nach einem Gespräch tut.
--
-- Aufbewahrung: In der Alpha wird nichts gelöscht – längere Vergleiche zeigen,
-- wie sich das System mit den Gesprächen entwickelt (Thomas, 27.10.2026).

set search_path to public;

alter table public.npc_conversation_log
  add column if not exists topic text,
  add column if not exists headline text,
  add column if not exists headline_source text;

create index if not exists npc_conversation_log_npc_idx
  on public.npc_conversation_log (npc_person_id, created_at desc);
create index if not exists population_events_actor_type_time_idx
  on public.population_events (actor_person_id, event_type, occurred_at);

-- Anliegen je Tag (grob, Schlüsselwörter: lib/game/cognition/conversationTopic.ts).
create or replace view public.npc_conversation_topics_daily
with (security_invoker = on) as
select date_trunc('day', created_at)::date as day,
       coalesce(topic, 'unbestimmt')       as topic,
       count(*)                            as turns,
       count(distinct player_profile_id)   as players,
       count(*) filter (where outcome in ('breakoff', 'dismissed')) as ended
from public.npc_conversation_log
group by 1, 2
order by 1 desc, 3 desc;

-- Reale Meldungen im Gespräch: worüber gesprochen wurde und was die Figur sagte.
create or replace view public.npc_conversation_real_world
with (security_invoker = on) as
select created_at, npc_name, location_name, headline, headline_source, player_text, npc_reply
from public.npc_conversation_log
where headline is not null
order by created_at desc;

-- Figuren untereinander je Tag und Ort. Diese Begegnungen tragen heute keinen
-- Wortlaut, nur Ausgang und Ort (population_events).
create or replace view public.npc_social_daily
with (security_invoker = on) as
select date_trunc('day', e.occurred_at)::date as day,
       l.slug                                 as location,
       count(*) filter (where e.event_type = 'social_interaction') / 2       as encounters,
       count(*) filter (where e.event_type = 'npc_social_interaction')       as social_visits,
       count(*) filter (where e.event_type = 'person_conflict')              as conflicts,
       count(*) filter (where e.event_type = 'person_assistance')            as assistance,
       count(*) filter (where e.event_type = 'social_interaction' and e.payload->>'outcome' = 'neutral') / 2 as neutral_encounters
from public.population_events e
left join public.locations l on l.id = e.location_id
where e.event_type in ('social_interaction', 'npc_social_interaction', 'person_conflict', 'person_assistance')
group by 1, 2
order by 1 desc, 3 desc;

-- Was eine Figur nach einem Gespräch tut: Aktion aus dem Gespräch selbst und
-- ihre nächste eigene Entscheidung innerhalb von zwei Stunden.
create or replace view public.npc_conversation_followups
with (security_invoker = on) as
select c.created_at, c.npc_name, c.topic, c.player_text, c.npc_reply,
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

revoke all on public.npc_conversation_topics_daily, public.npc_conversation_real_world,
  public.npc_social_daily, public.npc_conversation_followups
  from anon, authenticated;
