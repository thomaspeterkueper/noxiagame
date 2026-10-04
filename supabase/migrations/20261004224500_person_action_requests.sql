-- NOXIA-LIVING — person-originated procurement and capability requests.
-- A request is an authoritative action, but not an automatic purchase or grant.
-- Settlement remains owned by economy/inventory/training domain adapters.

set search_path to public;

create table if not exists public.person_action_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  request_kind text not null
    check (request_kind in ('tool','resource','capability')),
  subject_code text not null check (char_length(trim(subject_code)) > 0),
  amount numeric,
  min_level numeric,
  purpose text not null default 'general',
  status text not null default 'open'
    check (status in ('open','matched','fulfilled','blocked','cancelled')),
  source_action_code text,
  source_ref text,
  matched_subject_type text,
  matched_subject_ref text,
  created_tick bigint,
  resolved_tick bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount is null or amount > 0),
  check (min_level is null or (min_level >= 0 and min_level <= 1))
);

create index if not exists idx_person_action_requests_open
  on public.person_action_requests(person_id, status, created_tick desc);

create index if not exists idx_person_action_requests_location
  on public.person_action_requests(location_id, request_kind, status);

alter table public.person_action_requests enable row level security;

drop policy if exists person_action_requests_service on public.person_action_requests;
create policy person_action_requests_service on public.person_action_requests
  for all to service_role using (true) with check (true);

revoke all on public.person_action_requests from anon, authenticated;
grant all on public.person_action_requests to service_role;
