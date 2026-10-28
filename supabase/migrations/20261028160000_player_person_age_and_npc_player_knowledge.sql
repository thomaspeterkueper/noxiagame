-- R-11 und R-12 (Gastronomie) – Wissen in beide Richtungen (Thomas, 28.10.2026: „bitte requests umsetzen“):
--
--   R-11 Alter einer Person als Wissen des Spielers: Geburtsjahr, wie der Name gelernt
--        (Quelle, Tick). Das Alter rechnet lib/game/gameCalendar.ts aus Spieljahr und
--        Geburtsjahr; gespeichert wird das Geburtsjahr, damit das Wissen mitaltert.
--   R-12 Was eine Figur vom Spieler weiß: Name, unter dem sie ihn kennt, und zählbare
--        Gefälligkeiten. Keine freie Textablage – Felder, die die Gesprächsroute als
--        Fakt mitgibt.

set search_path to public;

alter table public.player_person_identity_knowledge
  add column if not exists known_birth_year integer check (known_birth_year is null or known_birth_year between 1900 and 2200),
  add column if not exists age_source_kind text,
  add column if not exists age_learned_tick bigint;

create table if not exists public.npc_player_knowledge (
  npc_person_id     uuid not null references public.people(id) on delete cascade,
  player_profile_id uuid not null references auth.users(id) on delete cascade,
  known_player_name text check (known_player_name is null or length(known_player_name) between 2 and 32),
  name_source_kind  text,
  name_learned_tick bigint,
  name_learned_at   timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (npc_person_id, player_profile_id)
);

create table if not exists public.npc_player_favors (
  id                bigint generated always as identity primary key,
  npc_person_id     uuid not null references public.people(id) on delete cascade,
  player_profile_id uuid not null references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('gift_credits', 'treated', 'helped')),
  amount            integer,
  detail            text,
  tick              bigint,
  created_at        timestamptz not null default now()
);
create index if not exists npc_player_favors_pair_idx on public.npc_player_favors (npc_person_id, player_profile_id, created_at desc);

alter table public.npc_player_knowledge enable row level security;
alter table public.npc_player_favors enable row level security;
revoke all on public.npc_player_knowledge, public.npc_player_favors from anon, authenticated;
