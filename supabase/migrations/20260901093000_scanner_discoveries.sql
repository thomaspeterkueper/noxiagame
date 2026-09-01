-- Persistent NOXIA discovery state for the scanner vertical slice.
-- Ground truth remains in the existing world/simulation tables. This table stores
-- player knowledge derived from measurements; it is not a second world model.

create table if not exists public.scanner_discoveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  subject_id text not null,
  discovery_key text not null,
  kind text not null,
  tile_row integer,
  tile_col integer,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  first_discovered_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (profile_id, discovery_key)
);

create index if not exists scanner_discoveries_profile_location_idx
  on public.scanner_discoveries(profile_id, location_id);

comment on table public.scanner_discoveries is
  'NOXIA player knowledge produced by the canonical scanner pipeline. Not ground truth and not a parallel simulation.';
comment on column public.scanner_discoveries.discovery_key is
  'Stable NOXIA idempotency key for one player-visible discovery; repeated scans update rather than duplicate it.';

alter table public.scanner_discoveries enable row level security;

create policy "scanner discoveries readable by owner"
  on public.scanner_discoveries for select
  using (auth.uid() = profile_id);
