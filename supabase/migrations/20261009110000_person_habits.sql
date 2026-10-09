-- Passive storage for learned person habits; no runtime activation in this migration.
create table if not exists public.person_habits (
  person_id uuid not null references public.people(id) on delete cascade,
  context_key text not null check (length(context_key) between 1 and 160),
  action text not null,
  repetitions integer not null default 0 check (repetitions >= 0),
  successes integer not null default 0 check (successes >= 0 and successes <= repetitions),
  strength double precision not null default 0 check (strength between 0 and 1),
  success_expectation double precision not null default 0 check (success_expectation between 0 and 1),
  last_tick bigint not null,
  updated_at timestamptz not null default now(),
  primary key (person_id, context_key, action)
);
create index if not exists person_habits_person_idx on public.person_habits(person_id);
alter table public.person_habits enable row level security;
-- Service-role runtime only: no anon/authenticated grants or policies.
revoke all on public.person_habits from anon, authenticated;
