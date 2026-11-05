-- Friedhofsflächen je Zelle einmal nachholen (W-13, /api/world-lab/areas)
create table if not exists public.earth_area_cells (
  cell text primary key,
  areas integer not null default 0,
  error text,
  fetched_at timestamptz not null default now()
);
alter table public.earth_area_cells enable row level security;
grant select, insert, update, delete on public.earth_area_cells to service_role;
