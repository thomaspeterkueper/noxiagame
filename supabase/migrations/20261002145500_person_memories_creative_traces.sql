-- Persistent autobiographical memories and subjective creative traces.
-- World events remain authoritative; these tables store a person's derived recollection/interpretation.

create table if not exists public.person_memories (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  other_person_id uuid references public.people(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  memory_kind text not null check (memory_kind in ('interaction','assistance','conflict','shared_work','crisis')),
  tick bigint not null,
  salience numeric not null default 0.4 check (salience between 0 and 1),
  valence numeric not null default 0 check (valence between -1 and 1),
  trust_delta numeric not null default 0 check (trust_delta between -1 and 1),
  summary text not null,
  source_event_id uuid not null references public.population_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(person_id,source_event_id)
);
create index if not exists idx_person_memories_person_tick on public.person_memories(person_id,tick desc);
alter table public.person_memories enable row level security;

create table if not exists public.person_creative_traces (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  source_memory_id uuid references public.person_memories(id) on delete set null,
  source_event_id uuid references public.population_events(id) on delete set null,
  trace_kind text not null check (trace_kind in ('note','motif','scene_seed','essay_seed','chronicle_seed')),
  subject_type text,
  subject_ref text,
  salience numeric not null default 0.5 check (salience between 0 and 1),
  interpretation text not null,
  epistemic_status text not null default 'subjective' check (epistemic_status in ('subjective','uncertain','revised')),
  created_tick bigint not null,
  created_at timestamptz not null default now(),
  unique(person_id,source_memory_id,trace_kind)
);
create index if not exists idx_person_creative_traces_person_tick on public.person_creative_traces(person_id,created_tick desc);
alter table public.person_creative_traces enable row level security;

comment on table public.person_creative_traces is
'Subjective creative processing by a person. Never authoritative world history; source event/memory remains separately addressable.';
