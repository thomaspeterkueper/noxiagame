-- Persistent ship -> concrete landing-pad attribution.
--
-- NOXIA runtime state only. This does not mint OTA/KG identities and does not
-- change travel balancing. A ship can occupy at most one concrete pad; a pad
-- can host at most one ship. Existing ships remain unassigned until a caller
-- explicitly allocates a pad, so rollout is backwards-compatible.

create table if not exists public.ship_docking_assignments (
  ship_id uuid primary key references public.ships(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  pad_entity_id uuid not null references public.tile_entities(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pad_entity_id)
);

create index if not exists ship_docking_assignments_location_idx
  on public.ship_docking_assignments(location_id);

comment on table public.ship_docking_assignments is
  'NOXIA runtime attribution of a ship to one concrete landing-pad tile entity. Not canonical OTA/KG identity.';

comment on column public.ship_docking_assignments.pad_entity_id is
  'Concrete operational landing_pad or registered active landing-pad expansion entity selected by NOXIA runtime allocation.';

alter table public.ship_docking_assignments enable row level security;

-- Players may inspect only the docking assignment of their own ships. Runtime
-- writes are performed by server/service-role travel logic after validation.
drop policy if exists ship_docking_assignments_select_own on public.ship_docking_assignments;
create policy ship_docking_assignments_select_own
  on public.ship_docking_assignments
  for select
  using (
    exists (
      select 1
      from public.ships s
      where s.id = ship_docking_assignments.ship_id
        and s.profile_id = auth.uid()
    )
  );
