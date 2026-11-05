-- Veranstaltungen im Lokal (Second-Life-Mechanik, Teil 5; Thomas, 04.11.2026: „alles nacheinander“).
-- Der Eigentümer kündigt DJ-Abend, Lesung, Quiz … an; Aushang im Lokal und Liste „Was ist los?“.
-- Echte Uhrzeit, damit sich Spieler verabreden können. Geprüft wird in /api/game/hospitality/events.
create table if not exists public.venue_events (
  id uuid primary key default gen_random_uuid(),
  tile_entity_id uuid not null,
  kind text not null check (kind in ('dj', 'konzert', 'lesung', 'quiz', 'feier', 'stammtisch')),
  title text not null check (char_length(title) between 3 and 60),
  note text check (note is null or char_length(note) <= 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_by uuid not null references public.profiles(id) on delete cascade,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists venue_events_tile_idx on public.venue_events (tile_entity_id, starts_at);
create index if not exists venue_events_upcoming_idx on public.venue_events (ends_at) where not cancelled;
alter table public.venue_events enable row level security;
drop policy if exists venue_events_read on public.venue_events;
create policy venue_events_read on public.venue_events for select to authenticated using (true);
grant all on public.venue_events to service_role;
