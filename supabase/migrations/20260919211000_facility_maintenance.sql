create table if not exists public.facility_maintenance (
  tile_entity_id uuid primary key references public.tile_entities(id) on delete cascade,
  condition numeric not null default 1 check (condition >= 0 and condition <= 1),
  wear numeric not null default 0 check (wear >= 0 and wear <= 1),
  maintenance_due boolean not null default false,
  last_maintained_tick bigint,
  updated_tick bigint,
  updated_at timestamptz not null default now()
);

alter table public.facility_maintenance enable row level security;

comment on table public.facility_maintenance is
  'Canonical deterministic maintenance projection for facility tile entities.';
