-- Compact sleep-consolidation projection for subjective epistemic traces.
-- Raw observations remain immutable evidence; this table stores only the current
-- deterministic retention/replay assessment used by sleeping cognition.
create table if not exists public.person_epistemic_consolidation (
  person_id uuid not null references public.people(id) on delete cascade,
  trace_id text not null references public.person_epistemic_traces(id) on delete cascade,
  retention numeric(5,4) not null check (retention between 0 and 1),
  replay_priority numeric(5,4) not null check (replay_priority between 0 and 1),
  consolidated_tick bigint not null,
  updated_at timestamptz not null default now(),
  primary key (person_id, trace_id)
);
create index if not exists idx_person_epistemic_consolidation_person_priority
  on public.person_epistemic_consolidation(person_id, replay_priority desc);
alter table public.person_epistemic_consolidation enable row level security;
drop policy if exists person_epistemic_consolidation_service on public.person_epistemic_consolidation;
create policy person_epistemic_consolidation_service on public.person_epistemic_consolidation for all to service_role using(true) with check(true);
revoke all on public.person_epistemic_consolidation from anon,authenticated;
grant all on public.person_epistemic_consolidation to service_role;
