-- W-13 (Gastronomie, 02.11.2026): Gedenkort auf dem Friedhof.
-- Ein Spieler zündet für sich eine Kerze an, wahlweise mit einem Namen. Nur er selbst
-- sieht sie (keine Moderation nötig, niemand liest Fremdes). Zugriff nur über den Server.
create table if not exists public.player_memorials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  place_ref text not null check (char_length(place_ref) between 1 and 120),
  place_name text check (place_name is null or char_length(place_name) <= 120),
  name text check (name is null or char_length(name) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists player_memorials_profile_idx on public.player_memorials (profile_id, created_at desc);
alter table public.player_memorials enable row level security;
grant select, insert, delete on public.player_memorials to service_role;
