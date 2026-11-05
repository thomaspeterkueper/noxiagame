-- 20261030010000_station_layouts.sql
-- Prometheus (Kepler Station) und Q1 bekommen eine Lage in der Welt, damit man dort laufen kann
-- (Thomas, 30.10.2026: „erst 1 dann 2“ – Stationen begehbar machen).
-- Nur Bauten ohne Elternmodul bekommen eine Lage; die Räume in den Modulen
-- (z. B. Q1-Café, Archivbibliothek, Hafenkantine auf Prometheus) bleiben Innenräume.
-- Lageplan: lib/game/spatial/stationLayouts.ts. Die alte Lage (keine) bleibt in
-- station_placement_20261030 erhalten – Rücknahme: placement_mode auf den alten Wert, x_m/y_m auf null.

set search_path to public;

create table if not exists public.station_placement_20261030 (
  tile_entity_id uuid primary key,
  old_placement_mode text, old_x_m double precision, old_y_m double precision,
  old_rotation_deg double precision, old_footprint_width_m double precision, old_footprint_depth_m double precision,
  old_spatial_region_id text, old_terrain_status text,
  moved_at timestamptz not null default now()
);
alter table public.station_placement_20261030 enable row level security;
comment on table public.station_placement_20261030 is 'Alte Lage der Bauten auf Prometheus und Q1 vor der begehbaren Station (30.10.2026) – zur Rücknahme.';

do $$
declare v_moved integer;
begin
  create temp table _plan(id uuid, slug text, entity_id text, x double precision, y double precision, w double precision, d double precision) on commit drop;
  insert into _plan values
    ('1028a862-434c-49ae-bc04-9bc2f014c2d4'::uuid, 'prometheus', 'command_center', 0, 0, 24, 20),
    ('021487da-6b30-4f97-8053-070bbc681805'::uuid, 'prometheus', 'habitat', -34, 24, 28, 22),
    ('1df7ede5-343e-436c-83a5-ad2142defc87'::uuid, 'prometheus', 'habitat', 34, 24, 28, 22),
    ('1f385920-f14d-48ed-a77c-98ba917bfec4'::uuid, 'prometheus', 'habitat_module', -34, -24, 26, 22),
    ('c1e1ad67-59f1-4a7d-a0af-c1a07fe269db'::uuid, 'prometheus', 'water_recycler', 34, -24, 24, 20),
    ('ccf590fe-be4a-4cb4-9167-7385df0844a0'::uuid, 'prometheus', 'observatory', 0, 72, 24, 20),
    ('d74350ce-9a1d-4866-9116-d43d88ecd7f2'::uuid, 'prometheus', 'warehouse', 0, -72, 34, 26),
    ('4cb632e8-7f74-4dec-8d2c-5c853b48d258'::uuid, 'prometheus', 'docking_bay', 102, 0, 44, 30),
    ('9bcbb52e-5a4b-414f-8db6-7ed2063bd4c6'::uuid, 'prometheus', 'solar_array', -96, 28, 40, 24),
    ('7789d3b1-fa21-45b9-946c-6940f3e209fa'::uuid, 'prometheus', 'solar_array', -96, -28, 40, 24),
    ('839b9e19-fe86-4770-aea4-b438f3ca935d'::uuid, 'prometheus', 'solar_array', -152, 0, 40, 24),
    ('5770b661-7d6d-4e96-bd88-ad42262f1256'::uuid, 'prometheus', 'scanner', 86, 60, 16, 16),
    ('cac44894-ada4-440d-ad54-da28c36f83a2'::uuid, 'prometheus', 'scanner', 86, -60, 16, 16),
    ('e7a37cf0-1c71-45f5-84cd-c692ac15b8ca'::uuid, 'q1', 'q1_transfer_node', 0, 0, 40, 30),
    ('0c601957-6263-47dc-9559-c9caad3caa29'::uuid, 'q1', 'q1_altbogen', -72, 0, 40, 26),
    ('2b1be7db-a36f-4ae3-a587-f0b2132debcb'::uuid, 'q1', 'q1_archive_culture_district', -72, 52, 46, 32),
    ('7a68daeb-23fe-4375-859c-43826d8e175a'::uuid, 'q1', 'q1_everyday_life', 0, 72, 64, 42),
    ('0694ed5c-1a1a-4b8a-bd2e-254381316ee2'::uuid, 'q1', 'q1_harbour_district', 82, 0, 50, 34);

  insert into public.station_placement_20261030 (tile_entity_id, old_placement_mode, old_x_m, old_y_m, old_rotation_deg, old_footprint_width_m, old_footprint_depth_m, old_spatial_region_id, old_terrain_status)
  select t.id, t.placement_mode, t.x_m, t.y_m, t.rotation_deg, t.footprint_width_m, t.footprint_depth_m, t.spatial_region_id, t.terrain_status
    from public.tile_entities t join _plan p on p.id = t.id
  on conflict (tile_entity_id) do nothing;

  update public.tile_entities t set
    x_m = p.x, y_m = p.y, z_m = coalesce(t.z_m, 0), rotation_deg = 0,
    footprint_width_m = p.w, footprint_depth_m = p.d, placement_mode = 'world',
    spatial_region_id = case p.slug when 'prometheus' then 'prometheus-deck' else 'q1-deck' end,
    terrain_status = 'origin_pending', ground_elevation_m = null, terrain_min_elevation_m = null, terrain_max_elevation_m = null, terrain_slope_deg = null
  from _plan p join public.locations l on l.slug = p.slug
  where t.id = p.id and t.location_id = l.id and t.entity_id = p.entity_id and t.parent_id is null;
  get diagnostics v_moved = row_count;
  raise notice 'Stationen: % Bauten in die Welt gesetzt', v_moved;
end $$;
