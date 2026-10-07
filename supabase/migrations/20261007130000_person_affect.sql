-- NOXIA-LIVING-0006 — persistent affect projection (emotion, mood, pain).
-- One row per person, written only when a causal event changes it. Readers
-- decay it from updated_tick, so idle persons cause no writes.

create table if not exists public.person_affect (
  person_id uuid primary key references public.people(id) on delete cascade,
  joy numeric not null default 0 check (joy >= 0 and joy <= 1),
  fear numeric not null default 0 check (fear >= 0 and fear <= 1),
  anger numeric not null default 0 check (anger >= 0 and anger <= 1),
  sadness numeric not null default 0 check (sadness >= 0 and sadness <= 1),
  mood numeric not null default 0 check (mood >= -1 and mood <= 1),
  pain numeric not null default 0 check (pain >= 0 and pain <= 1),
  -- Replay guard: the last authoritative event already folded into this row.
  source_event_id uuid references public.population_events(id) on delete set null,
  updated_tick bigint,
  updated_at timestamptz not null default now()
);

create table if not exists public.person_place_aversions (
  person_id uuid not null references public.people(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  strength numeric not null check (strength >= 0 and strength <= 1),
  learned_tick bigint not null,
  source_event_id uuid references public.population_events(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (person_id, location_id)
);

alter table public.person_affect enable row level security;
alter table public.person_place_aversions enable row level security;

drop policy if exists person_affect_service on public.person_affect;
create policy person_affect_service on public.person_affect for all to service_role using (true) with check (true);
drop policy if exists person_place_aversions_service on public.person_place_aversions;
create policy person_place_aversions_service on public.person_place_aversions for all to service_role using (true) with check (true);

grant all on public.person_affect to service_role;
grant all on public.person_place_aversions to service_role;

comment on table public.person_affect is
  'Felt affect per person (NOXIA-LIVING-0006). Derived from population_events; never written by dialogue or an LLM.';
comment on table public.person_place_aversions is
  'Places where a person was hurt; lowers perceived safety there and fades over time.';
