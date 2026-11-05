-- Polizei, Feuerwehr, Arztpraxis, Krankenhaus (Thomas, 05.11.2026: „ja, mache das“).
-- Was Spieler dort angeben: Anzeige, Fundsache, Verlust, Mitmachen bei der Freiwilligen
-- Feuerwehr, Termin, Besuch. Population wertet aus (R-34); geschrieben nur über /api/game/services.
create table if not exists public.service_cases (
  id uuid primary key default gen_random_uuid(),
  place_ref text not null check (char_length(place_ref) between 3 and 120),
  service text not null check (service in ('police', 'fire_station', 'doctors', 'hospital')),
  kind text not null check (kind in ('anzeige', 'fundsache', 'verloren', 'ff_mitmachen', 'termin', 'besuch')),
  text text check (text is null or char_length(text) <= 300),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'offen' check (status in ('offen', 'bearbeitet', 'erledigt')),
  created_at timestamptz not null default now()
);
create index if not exists service_cases_place_idx on public.service_cases (place_ref, created_at desc);
create index if not exists service_cases_profile_idx on public.service_cases (profile_id, created_at desc);
alter table public.service_cases enable row level security;
drop policy if exists service_cases_read_own on public.service_cases;
create policy service_cases_read_own on public.service_cases for select to authenticated using (profile_id = auth.uid());
grant all on public.service_cases to service_role;
