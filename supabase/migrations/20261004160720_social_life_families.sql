alter table public.person_relationships
  add column if not exists encounter_count_total integer not null default 0,
  add column if not exists recent_encounter_score numeric not null default 0 check (recent_encounter_score between 0 and 1),
  add column if not exists relationship_updated_tick bigint;

create table if not exists public.person_life_state (
  person_id uuid primary key references public.people(id) on delete cascade,
  life_stage text not null default 'adult' check (life_stage in ('child','adult')),
  age_ticks bigint not null default 0 check (age_ticks >= 0),
  family_desire numeric not null default 0.5 check (family_desire between 0 and 1),
  last_family_event_tick bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.person_life_state (person_id, life_stage, age_ticks, family_desire)
select
  p.id,
  'adult',
  0,
  greatest(0.2, least(0.9, 0.25 + (mod(abs(hashtextextended(p.id::text, 0)), 651)::numeric / 1000)))
from public.people p
on conflict (person_id) do nothing;

create table if not exists public.person_partnerships (
  id uuid primary key default gen_random_uuid(),
  person_a_id uuid not null references public.people(id) on delete cascade,
  person_b_id uuid not null references public.people(id) on delete cascade,
  status text not null default 'active' check (status in ('active','ended')),
  established_tick bigint not null,
  family_intent text not null default 'undecided' check (family_intent in ('undecided','considering','ready','paused')),
  family_intent_updated_tick bigint,
  last_birth_tick bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (person_a_id < person_b_id),
  unique (person_a_id, person_b_id)
);

create index if not exists person_partnerships_a_idx on public.person_partnerships(person_a_id) where status='active';
create index if not exists person_partnerships_b_idx on public.person_partnerships(person_b_id) where status='active';

create table if not exists public.person_parent_child (
  parent_id uuid not null references public.people(id) on delete cascade,
  child_id uuid not null references public.people(id) on delete cascade,
  partnership_id uuid references public.person_partnerships(id) on delete set null,
  created_tick bigint not null,
  created_at timestamptz not null default now(),
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create index if not exists person_parent_child_child_idx on public.person_parent_child(child_id);

create table if not exists public.location_family_demand (
  location_id uuid primary key references public.locations(id) on delete cascade,
  children_0_5 integer not null default 0,
  children_6_11 integer not null default 0,
  children_12_17 integer not null default 0,
  kindergarten_slots_needed integer not null default 0,
  playground_units_needed integer not null default 0,
  school_slots_needed integer not null default 0,
  updated_tick bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.person_life_state enable row level security;
alter table public.person_partnerships enable row level security;
alter table public.person_parent_child enable row level security;
alter table public.location_family_demand enable row level security;

revoke all on public.person_life_state from anon, authenticated;
revoke all on public.person_partnerships from anon, authenticated;
revoke all on public.person_parent_child from anon, authenticated;
revoke all on public.location_family_demand from anon, authenticated;

grant select, insert, update, delete on public.person_life_state to service_role;
grant select, insert, update, delete on public.person_partnerships to service_role;
grant select, insert, update, delete on public.person_parent_child to service_role;
grant select, insert, update, delete on public.location_family_demand to service_role;
