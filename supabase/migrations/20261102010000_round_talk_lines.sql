-- 20261102010000_round_talk_lines.sql
-- Offene Gesprächsrunden (Thomas, 31.10.2026): Beiträge der Anwesenden in einer Runde.
-- visible_to null: alle im Raum sehen den Beitrag (Figuren untereinander).
-- visible_to gesetzt: nur dieser Spieler (seine eigenen Worte und die Antworten darauf) –
-- so werden Texte von Spielern nicht anderen Spielern gezeigt.
create table if not exists public.round_talk_lines (
  id bigint generated always as identity primary key,
  round_key text not null,
  speaker_person_id uuid,
  speaker_name text not null,
  text text not null,
  visible_to uuid,
  created_at timestamptz not null default now()
);
alter table public.round_talk_lines enable row level security;
grant select, insert, update, delete on public.round_talk_lines to service_role;
create index if not exists round_talk_lines_round_idx on public.round_talk_lines (round_key, id);
create index if not exists round_talk_lines_created_idx on public.round_talk_lines (created_at);
