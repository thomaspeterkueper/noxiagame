-- NOXIA-LIVING — minimal persistent person health state.
-- Health is separate from generic needs so medical conditions remain explicit,
-- auditable and extensible without overloading safety/rest.

create table if not exists public.person_health (
  person_id uuid primary key references public.people(id) on delete cascade,
  wellbeing numeric not null default 1 check (wellbeing >= 0 and wellbeing <= 1),
  condition_code text,
  severity numeric not null default 0 check (severity >= 0 and severity <= 1),
  requires_medical_care boolean not null default false,
  source_event_id uuid references public.population_events(id) on delete set null,
  updated_tick bigint,
  updated_at timestamptz not null default now()
);

alter table public.person_health enable row level security;

comment on table public.person_health is
  'Canonical persistent physical-health projection for Living Population; explicit conditions are separate from generic needs.';
