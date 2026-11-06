-- supabase/migrations/20261106020000_earth_bus_routes.sql
-- Buslinien für die Weltkarte (Thomas, 06.11.2026: „Bus aus Fahrplan“, kein
-- Kulissenverkehr). Je Gegend einmal aus OpenStreetMap geholt (relation
-- route=bus mit Haltestellen), der Fahrplan hängt nur an der Uhrzeit.
create table if not exists public.earth_bus_routes (
  id         text primary key,                 -- osm:relation:<id>
  name       text not null,
  props      jsonb not null default '{}'::jsonb,
  coords     jsonb not null,                   -- [{lat,lon}] in Fahrtrichtung
  stops      jsonb not null default '[]'::jsonb, -- [{name, atM}]
  length_m   integer not null,
  min_lat    double precision not null,
  max_lat    double precision not null,
  min_lon    double precision not null,
  max_lon    double precision not null,
  fetched_at timestamptz not null default now()
);
create index if not exists earth_bus_routes_box on public.earth_bus_routes(min_lat, max_lat, min_lon, max_lon);
-- Welche Gegend (Raster 0,1°) schon geholt wurde, auch wenn dort keine Linie ist.
create table if not exists public.earth_bus_cells (
  cell       text primary key,
  routes     integer not null default 0,
  error      text,
  fetched_at timestamptz not null default now()
);
alter table public.earth_bus_routes enable row level security;
alter table public.earth_bus_cells enable row level security;
drop policy if exists earth_bus_routes_read on public.earth_bus_routes;
create policy earth_bus_routes_read on public.earth_bus_routes for select using (true);
grant select on public.earth_bus_routes to anon, authenticated;
grant all on public.earth_bus_routes, public.earth_bus_cells to service_role;
