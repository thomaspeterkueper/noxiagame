-- NOXIA-LIVING — derived live room presence inside persistent buildings.
-- Durable home/work/temporary assignments remain authoritative.
-- This table only projects where an active person currently is inside an assigned building.

set search_path to public;

create table if not exists public.person_interior_presence (
  person_id uuid primary key references public.people(id) on delete cascade,
  tile_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  template_id text not null,
  room_id text not null,
  target_room_id text,
  source_assignment_id uuid references public.person_assignments(id) on delete set null,
  source_kind text not null default 'assignment'
    check (source_kind in ('assignment','visit','activity')),
  entered_tick bigint,
  updated_tick bigint not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_person_interior_presence_building_room
  on public.person_interior_presence(tile_entity_id, room_id);

alter table public.person_interior_presence enable row level security;

drop policy if exists person_interior_presence_service on public.person_interior_presence;
create policy person_interior_presence_service on public.person_interior_presence
  for all to service_role using (true) with check (true);

revoke all on public.person_interior_presence from anon, authenticated;
grant all on public.person_interior_presence to service_role;

comment on table public.person_interior_presence is
  'Derived live room-level person presence. person_assignments remains the durable location/building source of truth.';
