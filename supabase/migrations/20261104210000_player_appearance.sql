-- Eigene Figur gestalten (Thomas, 04.11.2026: Second-Life-Mechanik „alles nacheinander“).
-- Ein Aussehen je Spieler im Kiesel-Stil; geprüft wird in /api/game/appearance.
-- Andere Spieler sehen es über die Anwesenheit im Raum, gespeichert wird nur hier.
create table if not exists public.player_appearance (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  look jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.player_appearance enable row level security;
drop policy if exists player_appearance_read_own on public.player_appearance;
create policy player_appearance_read_own on public.player_appearance for select to authenticated using (profile_id = auth.uid());
grant all on public.player_appearance to service_role;
