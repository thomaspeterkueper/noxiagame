-- Tägliche Gesprächsauswertung als eigene Zeilen (Thomas, 27.10.2026): nichts
-- löschen, damit sich über Wochen vergleichen lässt, wie sich Figuren und
-- Spieler mit den Gesprächen entwickeln. Geschrieben von der geplanten
-- täglichen Auswertung, eine Zeile je Tag (Berliner Datum).

set search_path to public;

create table if not exists public.npc_conversation_reviews (
  day            date primary key,
  created_at     timestamptz not null default now(),
  player_turns   integer not null default 0,
  players        integer not null default 0,
  npcs           integer not null default 0,
  npc_encounters integer not null default 0,
  topics         jsonb not null default '{}'::jsonb,
  summary        text not null,
  findings       jsonb not null default '[]'::jsonb
);

alter table public.npc_conversation_reviews enable row level security;
revoke all on public.npc_conversation_reviews from anon, authenticated;
