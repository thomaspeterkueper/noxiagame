-- Staged only: do not apply until body projection tests and runtime integration pass.
create table if not exists public.person_body (
  person_id uuid primary key references public.people(id) on delete cascade,
  body jsonb not null default '{"injuries":[],"coreTemperatureStress":0,"oxygenStress":0,"hydrationStress":0,"energyStress":0,"fatigue":0}'::jsonb,
  nociception numeric not null default 0 check (nociception between 0 and 1),
  systemic_distress numeric not null default 0 check (systemic_distress between 0 and 1),
  source_event_id uuid references public.population_events(id) on delete set null,
  updated_tick bigint,
  updated_at timestamptz not null default now()
);
alter table public.person_body enable row level security;
drop policy if exists person_body_service on public.person_body;
create policy person_body_service on public.person_body for all to service_role using (true) with check (true);
grant all on public.person_body to service_role;
