create table if not exists public.pilot_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  prospect_id uuid not null references public.region_resources(id) on delete cascade,
  robot_vehicle_id uuid not null references public.vehicle_instances(id) on delete restrict,
  status text not null default 'running' check (status in ('running','completed','failed','cancelled')),
  target_mass_kg numeric not null default 50 check (target_mass_kg > 0),
  recovered_mass_kg numeric,
  energy_cost integer not null default 18 check (energy_cost >= 0),
  component_cost integer not null default 1 check (component_cost >= 0),
  wear_cost integer not null default 6 check (wear_cost >= 0),
  started_at timestamptz not null default now(),
  completes_at timestamptz not null,
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pilot_extraction_jobs_profile_location_idx
  on public.pilot_extraction_jobs(profile_id, location_id, created_at desc);
create index if not exists pilot_extraction_jobs_prospect_idx
  on public.pilot_extraction_jobs(prospect_id, created_at desc);

alter table public.pilot_extraction_jobs enable row level security;

drop policy if exists pilot_extraction_jobs_owner_select on public.pilot_extraction_jobs;
create policy pilot_extraction_jobs_owner_select on public.pilot_extraction_jobs
for select using (auth.uid() = profile_id);

drop policy if exists pilot_extraction_jobs_owner_insert on public.pilot_extraction_jobs;
create policy pilot_extraction_jobs_owner_insert on public.pilot_extraction_jobs
for insert with check (auth.uid() = profile_id);

drop policy if exists pilot_extraction_jobs_owner_update on public.pilot_extraction_jobs;
create policy pilot_extraction_jobs_owner_update on public.pilot_extraction_jobs
for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
