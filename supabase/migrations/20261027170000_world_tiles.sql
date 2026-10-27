-- Erdkarte, Aufgabe 3: Kacheln einmal erzeugen und ablegen, statt sie bei jedem
-- ersten Abruf (je Server-Instanz) aus allen Regionsobjekten neu zu rechnen.
--
-- world_tiles: die fertige Grundkachel (Straßen, Flächen, Gebäude, Orte) – ohne
-- Flurstücke, die ändern sich durch Spieler und werden weiter frisch gelesen.
-- Gültig ist eine abgelegte Kachel, solange
--   * das Kachelformat gleich ist (lib/worldlab/tileFormat.ts),
--   * dieselben Regionen beteiligt sind und keine davon geänderte Objekte hat
--     (world_tile_region_revs, hochgezählt durch Trigger auf region_features),
--   * keine genauere Linie in ihrem Ausschnitt dazukam (Trigger auf
--     earth_line_details löscht die betroffenen Kacheln).
-- Die Trigger fangen jeden Schreibweg ab (Import, Ortsdetail, Nachladen, Cron).

create table if not exists public.world_tiles (
  z smallint not null,
  x integer not null,
  y integer not null,
  format text not null,
  region_revs jsonb not null default '{}'::jsonb,
  data jsonb not null,
  -- Ausschnitt samt Rand, in dem genaue Linien die Kachel betreffen
  min_lat double precision not null,
  max_lat double precision not null,
  min_lon double precision not null,
  max_lon double precision not null,
  built_at timestamptz not null default now(),
  primary key (z, x, y)
);
create index if not exists world_tiles_box on public.world_tiles(min_lat, max_lat, min_lon, max_lon);
alter table public.world_tiles enable row level security;

-- Ohne Fremdschlüssel: Beim Löschen einer Region soll der Zähler trotzdem steigen.
create table if not exists public.world_tile_region_revs (
  region_id uuid primary key,
  rev bigint not null default 0,
  changed_at timestamptz not null default now()
);
alter table public.world_tile_region_revs enable row level security;

grant select, insert, update, delete on public.world_tiles to service_role;
grant select, insert, update, delete on public.world_tile_region_revs to service_role;

-- Regionsobjekte geändert → Zähler der Region hoch (einmal je Anweisung, nicht je Zeile).
create or replace function public.world_tiles_bump_regions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.world_tile_region_revs(region_id, rev, changed_at)
    select distinct region_id, 1, now() from new_rows where region_id is not null
    on conflict (region_id) do update set rev = world_tile_region_revs.rev + 1, changed_at = now();
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    insert into public.world_tile_region_revs(region_id, rev, changed_at)
    select distinct region_id, 1, now() from old_rows where region_id is not null
    on conflict (region_id) do update set rev = world_tile_region_revs.rev + 1, changed_at = now();
  end if;
  return null;
end $$;

drop trigger if exists trg_world_tiles_regions_ins on public.region_features;
drop trigger if exists trg_world_tiles_regions_upd on public.region_features;
drop trigger if exists trg_world_tiles_regions_del on public.region_features;
create trigger trg_world_tiles_regions_ins after insert on public.region_features
  referencing new table as new_rows for each statement execute function public.world_tiles_bump_regions();
create trigger trg_world_tiles_regions_upd after update on public.region_features
  referencing new table as new_rows old table as old_rows for each statement execute function public.world_tiles_bump_regions();
create trigger trg_world_tiles_regions_del after delete on public.region_features
  referencing old table as old_rows for each statement execute function public.world_tiles_bump_regions();

-- Genaue Linie dazugekommen oder geändert → Kacheln in ihrem Ausschnitt verwerfen.
create or replace function public.world_tiles_drop_for_lines() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.world_tiles t
   using new_rows l
   where t.min_lat <= l.max_lat and t.max_lat >= l.min_lat and t.min_lon <= l.max_lon and t.max_lon >= l.min_lon;
  return null;
end $$;

drop trigger if exists trg_world_tiles_lines_ins on public.earth_line_details;
drop trigger if exists trg_world_tiles_lines_upd on public.earth_line_details;
create trigger trg_world_tiles_lines_ins after insert on public.earth_line_details
  referencing new table as new_rows for each statement execute function public.world_tiles_drop_for_lines();
create trigger trg_world_tiles_lines_upd after update on public.earth_line_details
  referencing new table as new_rows for each statement execute function public.world_tiles_drop_for_lines();
