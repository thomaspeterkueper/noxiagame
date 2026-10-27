-- supabase/migrations/20261027060000_earth_line_details.sql
-- Hauptstraßen, Kreisverkehre und Gleise in voller Genauigkeit für die Weltkarte
-- (Thomas, 27.10.2026: Straßen, Kreisel und Bahnhof „noch chaotisch“). Die
-- Regionsimporte vereinfachen diese Linien auf ~13 m; die begehbare Erdszene
-- liest diese Tabelle nicht.
create table if not exists public.earth_line_details (
  id         text primary key,
  kind       text not null check (kind in ('road', 'rail')),
  props      jsonb not null default '{}'::jsonb,
  coords     jsonb not null,
  min_lat    double precision not null,
  max_lat    double precision not null,
  min_lon    double precision not null,
  max_lon    double precision not null,
  fetched_at timestamptz not null default now()
);
create index if not exists earth_line_details_box on public.earth_line_details(min_lat, max_lat, min_lon, max_lon);
create table if not exists public.earth_line_cells (
  cell       text primary key,
  lines      integer not null default 0,
  error      text,
  fetched_at timestamptz not null default now()
);
alter table public.earth_line_details enable row level security;
alter table public.earth_line_cells enable row level security;
drop policy if exists earth_line_details_read on public.earth_line_details;
create policy earth_line_details_read on public.earth_line_details for select using (true);
grant select on public.earth_line_details to anon, authenticated;
grant all on public.earth_line_details, public.earth_line_cells to service_role;
