create table if not exists public.person_travel_state (
  person_id uuid primary key references public.people(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  from_tile_entity_id uuid not null references public.tile_entities(id) on delete restrict,
  to_tile_entity_id uuid not null references public.tile_entities(id) on delete restrict,
  route jsonb not null,
  route_index integer not null default 0 check (route_index >= 0),
  progress numeric(8,6) not null default 0 check (progress between 0 and 1),
  status text not null default 'active' check (status in ('active','arrived','blocked','cancelled')),
  started_tick bigint not null,
  updated_tick bigint not null,
  arrived_tick bigint,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_tile_entity_id <> to_tile_entity_id)
);
create index if not exists idx_person_travel_state_active on public.person_travel_state(location_id,status) where status='active';
alter table public.person_travel_state enable row level security;
drop policy if exists person_travel_state_service on public.person_travel_state;
create policy person_travel_state_service on public.person_travel_state for all to service_role using(true) with check(true);
revoke all on public.person_travel_state from anon,authenticated;
grant all on public.person_travel_state to service_role;
