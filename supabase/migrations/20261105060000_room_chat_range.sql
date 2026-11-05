-- Flüstern, Sagen, Rufen (Second-Life-Mechanik, Teil 4; Thomas, 04.11.2026: „alles nacheinander“).
-- Flüstern geht nur an einen Spieler, Sagen hören die in der Nähe, Rufen der ganze Raum.
alter table public.player_room_messages
  add column if not exists range text not null default 'say' check (range in ('whisper', 'say', 'shout')),
  add column if not exists to_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists pos_x integer,
  add column if not exists pos_y integer;
create index if not exists player_room_messages_to_idx on public.player_room_messages (to_profile_id, created_at desc) where to_profile_id is not null;
