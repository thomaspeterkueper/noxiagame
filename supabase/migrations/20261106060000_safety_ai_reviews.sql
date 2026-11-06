-- 20261106060000_safety_ai_reviews.sql
-- NOXIA-SAFETY-0001, Stufe 2 (Thomas, 06.11.2026: „auch andere Sprachen, auch
-- Codes, die harmlos klingen“). Auffällige Raumfenster prüft eine KI im
-- Zusammenhang. Gespeichert wird nur das Ergebnis, nie der Wortlaut.
-- Dient der Sperrfrist (eine Prüfung je Person und Raum in 10 Minuten) und der
-- Auswertung, wie oft Regeln und KI übereinstimmen.

set search_path to public;

create table if not exists public.safety_reviews (
  id bigint generated always as identity primary key,
  subject_profile_id uuid references auth.users(id) on delete cascade,
  room_key text not null,
  whisper boolean not null default false,
  signals text[] not null default '{}',
  screen_language text,
  verdict text not null check (verdict in ('game', 'unclear', 'real_world', 'error')),
  category text,
  confidence real,
  detected_language text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists safety_reviews_subject_idx on public.safety_reviews(subject_profile_id, room_key, created_at desc);
create index if not exists safety_reviews_created_idx on public.safety_reviews(created_at desc);
alter table public.safety_reviews enable row level security;
revoke all on public.safety_reviews from public, anon, authenticated;
grant select, insert, update, delete on public.safety_reviews to service_role;
