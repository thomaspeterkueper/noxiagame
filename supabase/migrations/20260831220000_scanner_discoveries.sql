-- Canonical scanner discovery persistence.
-- Discovery is player knowledge about existing world state, not world truth itself.

create table if not exists public.scanner_discoveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  ground_truth_key text not null,
  tile_row integer not null,
  tile_col integer not null,
  signal_kind text not null,
  source_type text not null,
  interpretation_label text not null,
  confidence text not null check (confidence in ('low','medium')),
  evidence text not null,
  first_discovered_at timestamptz not null default now(),
  last_measured_at timestamptz not null default now(),
  measurement_count integer not null default 1 check (measurement_count > 0),
  unique (profile_id, location_id, ground_truth_key)
);

create index if not exists scanner_discoveries_profile_location_idx
  on public.scanner_discoveries(profile_id, location_id);

comment on table public.scanner_discoveries is
  'NOXIA player knowledge produced by Ground Truth -> Measurement -> Interpretation -> Discovery. Not ground truth and not a parallel simulation.';
comment on column public.scanner_discoveries.ground_truth_key is
  'Stable NOXIA idempotency key derived from canonical world truth; repeated scans update rather than duplicate the discovery.';

alter table public.scanner_discoveries enable row level security;

-- No browser write policy. The authenticated game API validates scanner ownership
-- and writes through the service role so discovery cannot be forged client-side.
revoke all on public.scanner_discoveries from anon, authenticated;
