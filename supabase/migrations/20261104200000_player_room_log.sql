-- 20261104200000_player_room_log.sql
-- Spieler unter sich im Raum (Thomas, 04.11.2026: „solltest du die Chats zwischen
-- Spielern auch freischalten, alles was gerade passiert, wenn jemand kommt, ist
-- wichtig für uns, um einzuschätzen, wo wir aufpassen müssen“).
--   player_room_messages – was Spieler im Raum zueinander sagen (Original und, falls
--                          Kontaktdaten entfernt wurden, die gezeigte Fassung);
--   player_room_events   – wer kommt und geht, Gesten, Meldungen.
-- Nur der Server schreibt (service_role). Auswertung: Sicht player_room_log.

create table if not exists public.player_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_key text not null,
  room_name text,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null,
  text text not null,
  shown_text text not null,
  topic text,
  flags text[] not null default '{}',
  peers integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists player_room_messages_room_idx on public.player_room_messages(room_key, created_at desc);
create index if not exists player_room_messages_sender_idx on public.player_room_messages(sender_id, created_at desc);

create table if not exists public.player_room_events (
  id uuid primary key default gen_random_uuid(),
  room_key text not null,
  room_name text,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('join', 'leave', 'gesture', 'report')),
  detail text,
  message_id uuid references public.player_room_messages(id) on delete set null,
  peers integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists player_room_events_room_idx on public.player_room_events(room_key, created_at desc);

alter table public.player_room_messages enable row level security;
alter table public.player_room_events enable row level security;
grant all on public.player_room_messages, public.player_room_events to service_role;

-- Alles in einer Zeitlinie, für die tägliche Durchsicht.
create or replace view public.player_room_log as
  select m.created_at, m.room_key, m.room_name, m.sender_id as profile_id, m.sender_name as player, 'message'::text as kind,
         m.text as detail, m.topic, m.flags, m.peers
    from public.player_room_messages m
  union all
  select e.created_at, e.room_key, e.room_name, e.profile_id, p.username, e.kind, e.detail, null, '{}'::text[], e.peers
    from public.player_room_events e left join public.profiles p on p.id = e.profile_id;
revoke all on public.player_room_log from anon, authenticated;
grant select on public.player_room_log to service_role;
