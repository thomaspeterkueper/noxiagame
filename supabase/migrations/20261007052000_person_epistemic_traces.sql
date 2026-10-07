-- Persistent subjective epistemic traces for authoritative NPC cognition.
-- This is deliberately separate from event-derived autobiographical person_memories.
-- A trace records that a person observed/heard/inferred something; it is not world truth.

create table if not exists public.person_epistemic_traces (
  id text primary key,
  person_id uuid not null references public.people(id) on delete cascade,
  subject_ref text not null,
  attribute text not null,
  value jsonb not null,
  source_type text not null check (source_type in ('person','sensor','map','record','network','simulation')),
  source_ref text not null,
  modality text not null check (modality in ('visual','auditory','reported','map','sensor','system_record')),
  provenance_refs jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  salience numeric(5,4) not null check (salience between 0 and 1),
  observed_tick bigint not null,
  trace_kind text not null default 'observation' check (trace_kind in ('observation','hearsay','inference','memory_replay')),
  created_at timestamptz not null default now()
);

create index if not exists idx_person_epistemic_traces_person_tick
  on public.person_epistemic_traces(person_id, observed_tick desc);
create index if not exists idx_person_epistemic_traces_subject
  on public.person_epistemic_traces(person_id, subject_ref, attribute, observed_tick desc);

alter table public.person_epistemic_traces enable row level security;
drop policy if exists "person_epistemic_traces_service" on public.person_epistemic_traces;
create policy "person_epistemic_traces_service" on public.person_epistemic_traces
  for all to service_role using (true) with check (true);
grant all on public.person_epistemic_traces to service_role;
