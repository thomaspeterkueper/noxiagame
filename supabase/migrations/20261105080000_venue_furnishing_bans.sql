-- Einrichten und Hausrecht (Second-Life-Mechanik, Teil 6; Thomas, 04.11.2026: „alles nacheinander“).
-- Wem das Lokal gehört, stellt Tische um und schmückt (geprüft in /api/game/hospitality/house);
-- wer stört, bekommt Hausverbot – dann kein Einlass, keine Bestellung, kein Raum-Chat.
create table if not exists public.venue_furnishing (
  tile_entity_id uuid primary key,
  furnishing jsonb not null default '{"tables":{},"decor":[]}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.venue_bans (
  id uuid primary key default gen_random_uuid(),
  tile_entity_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 160),
  until timestamptz not null,
  lifted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists venue_bans_active_idx on public.venue_bans (tile_entity_id, profile_id, until) where not lifted;
alter table public.venue_furnishing enable row level security;
alter table public.venue_bans enable row level security;
drop policy if exists venue_furnishing_read on public.venue_furnishing;
create policy venue_furnishing_read on public.venue_furnishing for select to authenticated using (true);
drop policy if exists venue_bans_read_own on public.venue_bans;
create policy venue_bans_read_own on public.venue_bans for select to authenticated using (profile_id = auth.uid() or banned_by = auth.uid());
grant all on public.venue_furnishing to service_role;
grant all on public.venue_bans to service_role;
