-- Coarse neuroendocrine/interoceptive regulation projection.
-- Values are dimensionless simulation control signals, not measured hormone concentrations.

create table if not exists public.person_regulation_state (
  person_id uuid primary key references public.people(id) on delete cascade,
  stress_axis numeric not null default 0.35 check (stress_axis between 0 and 1),
  social_bonding_tone numeric not null default 0.25 check (social_bonding_tone between 0 and 1),
  reward_drive numeric not null default 0.40 check (reward_drive between 0 and 1),
  arousal numeric not null default 0.30 check (arousal between 0 and 1),
  updated_tick bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.person_regulation_state enable row level security;
drop policy if exists person_regulation_state_service on public.person_regulation_state;
create policy person_regulation_state_service
  on public.person_regulation_state
  for all to service_role
  using (true) with check (true);

revoke all on public.person_regulation_state from anon, authenticated;
grant all on public.person_regulation_state to service_role;

comment on table public.person_regulation_state is
  'Derived coarse interoceptive/neuroendocrine regulation state. Dimensionless proxies; not literal cortisol/oxytocin/dopamine concentrations.';
