-- NOXIA cognitive modes v1: persistent scheduler state without duplicating person truth.
-- Personality/creativity stays in people.traits; this table stores runtime state only.

create table if not exists public.person_cognitive_state (
  person_id uuid primary key references public.people(id) on delete cascade,
  mode text not null default 'routine'
    check (mode in ('sleep','routine','reactive','deliberative','exploratory','contemplative','insight')),
  compute_tier smallint not null default 0 check (compute_tier between 0 and 3),
  trigger_score numeric(5,4) not null default 0 check (trigger_score between 0 and 1),
  last_consolidation_tick bigint,
  last_insight_tick bigint,
  insight_cooldown_until_tick bigint,
  updated_tick bigint,
  updated_at timestamptz not null default now()
);

create index if not exists idx_person_cognitive_mode on public.person_cognitive_state(mode, compute_tier);
alter table public.person_cognitive_state enable row level security;
drop policy if exists "person_cognitive_state_service" on public.person_cognitive_state;
create policy "person_cognitive_state_service" on public.person_cognitive_state for all to service_role using (true) with check (true);
grant all on public.person_cognitive_state to service_role;

-- Insight artifacts are hypotheses with provenance, never canonical facts.
create table if not exists public.person_insight_candidates (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  problem_ref text not null,
  hypothesis text not null,
  confidence numeric(5,4) not null default 0.5 check (confidence between 0 and 1),
  provenance text not null check (provenance in ('dream_recombination','meditation_recombination','knowledge_gateway')),
  inspiration_refs jsonb not null default '[]'::jsonb,
  status text not null default 'hypothesis' check (status in ('hypothesis','testing','supported','contradicted','discarded')),
  canonical boolean not null default false check (canonical = false),
  created_tick bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_person_insight_candidates_person on public.person_insight_candidates(person_id, created_tick desc);
alter table public.person_insight_candidates enable row level security;
drop policy if exists "person_insight_candidates_service" on public.person_insight_candidates;
create policy "person_insight_candidates_service" on public.person_insight_candidates for all to service_role using (true) with check (true);
grant all on public.person_insight_candidates to service_role;
