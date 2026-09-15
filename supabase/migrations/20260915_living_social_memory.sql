-- NOXIA-LIVING — social memory v1
-- Additive schema only. Existing people/person_needs/person_skills/person_assignments remain authoritative.

create table if not exists public.person_memories (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  other_person_id uuid references public.people(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  memory_kind text not null check (memory_kind in ('interaction','assistance','conflict','shared_work','crisis')),
  tick bigint not null,
  salience double precision not null default 0.5 check (salience between 0 and 1),
  valence double precision not null default 0 check (valence between -1 and 1),
  trust_delta double precision not null default 0 check (trust_delta between -1 and 1),
  summary text not null,
  source_event_id uuid,
  created_at timestamptz not null default now(),
  check (other_person_id is null or other_person_id <> person_id)
);

create index if not exists person_memories_person_tick_idx on public.person_memories(person_id, tick desc);
create index if not exists person_memories_other_person_idx on public.person_memories(other_person_id) where other_person_id is not null;

create table if not exists public.person_relationships (
  person_id uuid not null references public.people(id) on delete cascade,
  other_person_id uuid not null references public.people(id) on delete cascade,
  familiarity double precision not null default 0 check (familiarity between 0 and 1),
  trust double precision not null default 0 check (trust between -1 and 1),
  support_balance double precision not null default 0 check (support_balance between -10 and 10),
  last_interaction_tick bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (person_id, other_person_id),
  check (person_id <> other_person_id)
);

create table if not exists public.person_goals (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  goal_code text not null,
  subject_type text,
  subject_ref text,
  priority double precision not null default 0.5 check (priority between 0 and 1),
  progress double precision not null default 0 check (progress between 0 and 1),
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  created_tick bigint not null,
  updated_tick bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists person_goals_active_idx on public.person_goals(person_id, priority desc) where status = 'active';

alter table public.person_memories enable row level security;
alter table public.person_relationships enable row level security;
alter table public.person_goals enable row level security;

-- v1 intentionally defines no client policies. These are simulation-internal state,
-- written by the authoritative server/tick path. Service-role access bypasses RLS.
