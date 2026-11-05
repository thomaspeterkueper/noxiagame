-- Gelände der Erdkarte (NOXIA-WORLD-0004, „Gelände zuerst“, Thomas 05.11.2026).
-- Rohimport: je Zelle der Kachelstufe 15 (≈ 760 m am 51. Breitengrad) 9 × 9 Höhen,
-- so wie die Quelle sie geliefert hat, mit Quelle, Datensatz und Lizenz.
-- Gefüllt vom täglichen Lauf /api/cron/world-terrain und beim ersten Besuch
-- (/api/world-lab/refresh); die Karte liest nur von hier.

create table if not exists public.earth_terrain_cells (
  z          smallint not null default 15,
  x          integer  not null,
  y          integer  not null,
  n          smallint not null default 9,
  heights    real[]   not null,
  source     text     not null,
  dataset    text     not null,
  license    text     not null,
  fetched_at timestamptz not null default now(),
  primary key (z, x, y)
);

-- Fehlversuche (damit derselbe Ort nicht bei jedem Aufruf neu angefragt wird)
create table if not exists public.earth_terrain_misses (
  z          smallint not null default 15,
  x          integer  not null,
  y          integer  not null,
  error      text,
  tried_at   timestamptz not null default now(),
  primary key (z, x, y)
);

alter table public.earth_terrain_cells enable row level security;
alter table public.earth_terrain_misses enable row level security;
drop policy if exists earth_terrain_cells_read on public.earth_terrain_cells;
create policy earth_terrain_cells_read on public.earth_terrain_cells for select using (true);
grant select on public.earth_terrain_cells to anon, authenticated;
grant all on public.earth_terrain_cells, public.earth_terrain_misses to service_role;
