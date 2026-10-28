-- 20261028190000_state_base_seidfeld.sql
-- Umzug der staatlichen Basis von der Selmecke (Naturschutzgebiet, Waldtal ohne
-- Häuser und Straßen) an das Segelfluggelände Sundern-Seidfeld bei Wellpappen
-- Tillmann (Thomas, 28.10.2026: „ja A, denke den Segelflugplatz beziehen wir mit
-- ein, sozusagen das, was dort in Zukunft stehen könnte“).
--
-- Lageplan (docs/workstreams/world-map.md, „Staatliche Basis“):
-- - Landeplätze, Raumhafen-Kern, Lager und Service auf und am Segelfluggelände,
--   ausgerichtet an der Bahn (Achse 15,6° nördlich von Ost, rotation_deg −15,6).
-- - Werkhof südöstlich davon auf dem Acker: Werft, Fabrik, zwei Lager, Labor, Solarfeld.
-- - Verwaltung, Schule, Wohnblock, Habitat und Scanner südwestlich.
-- - Die Hafenkantine der Erde hatte keine Lage; sie steht jetzt am Raumhafen.
-- Hallen von Tillmann (reales Unternehmen) bleiben unberührt. Alle Bauten stehen
-- auf Acker, Wiese oder dem Flugfeld, mit mindestens 10 m Abstand zueinander,
-- 5 m zu den Feldwegen und ohne Überschneidung mit Häusern aus den Kartendaten.
--
-- Die alte Lage bleibt in state_base_relocation_20261028 erhalten (Rücknahme:
-- Zeilen zurückschreiben). Wohnzuweisungen und Stellen hängen an der id und ziehen mit.

set search_path to public;

create table if not exists public.state_base_relocation_20261028 (
  tile_entity_id uuid primary key,
  entity_id text not null,
  old_latitude_deg double precision, old_longitude_deg double precision,
  old_x_m double precision, old_y_m double precision, old_rotation_deg double precision,
  old_footprint_width_m double precision, old_footprint_depth_m double precision,
  old_spatial_region_id text, old_site_id uuid,
  moved_at timestamptz not null default now()
);
alter table public.state_base_relocation_20261028 enable row level security;
comment on table public.state_base_relocation_20261028 is 'Alte Lage der staatlichen Basis vor dem Umzug an das Segelfluggelände Seidfeld (28.10.2026) – zur Rücknahme.';

do $$
declare
  v_site uuid;
  v_earth uuid;
  v_moved integer;
begin
  select id into v_earth from public.locations where slug = 'earth';
  if v_earth is null then return; end if;
  select site_id into v_site from public.tile_entities where id = '93d879a4-5467-4754-bd6a-d766dbfc95ba';

  create temp table _plan(id uuid, entity_id text, lat double precision, lon double precision, x double precision, y double precision, w double precision, d double precision) on commit drop;
  insert into _plan values
    ('4b579d4a-d090-4629-b515-79a654bef7a8'::uuid, 'spaceport_pad_standard', 51.3025500, 7.9752000, -2070.68, -2496.33, 120, 90),
    ('9bf4c7cc-cbff-4639-a5ea-468f2a773f83'::uuid, 'spaceport_pad_standard', 51.3029500, 7.9770000, -1945.61, -2451.85, 120, 90),
    ('dbd456c5-f627-4c12-9520-c5247db9b921'::uuid, 'spaceport_pad_mini', 51.3033000, 7.9786000, -1834.43, -2412.93, 70, 55),
    ('93d879a4-5467-4754-bd6a-d766dbfc95ba'::uuid, 'spaceport_core', 51.3027809, 7.9800000, -1737.15, -2470.65, 52, 38),
    ('f9c49518-ac0d-43b7-98a5-f5509d3e3228'::uuid, 'spaceport_service', 51.3022683, 7.9802158, -1722.15, -2527.65, 64, 42),
    ('d8cb978b-b8a9-45ae-b368-d5a4ec5142a1'::uuid, 'spaceport_storage', 51.3032666, 7.9799137, -1743.15, -2416.65, 72, 48),
    ('823a76e5-ad79-4916-af79-d2b5971891ed'::uuid, 'port_canteen', 51.3026460, 7.9793527, -1782.13, -2485.65, 22, 16),
    ('bd2807db-444e-449e-a54e-93b2283e4375'::uuid, 'shipyard', 51.3019111, 7.9806432, -1692.46, -2567.37, 42, 30),
    ('32ab3db2-e5b1-41ba-b4d4-1987dd3632e9'::uuid, 'factory', 51.3023698, 7.9811178, -1659.48, -2516.37, 42, 30),
    ('cede911c-f92b-44a8-8a37-2af88aca18e0'::uuid, 'warehouse', 51.3020191, 7.9813336, -1644.48, -2555.36, 36, 28),
    ('b94108ae-cae7-43b2-b839-36ceca79f94e'::uuid, 'warehouse_storage', 51.3017762, 7.9799527, -1740.44, -2582.37, 36, 28),
    ('cdcddb60-b71b-455a-a781-972ce210dd17'::uuid, 'laboratory', 51.3027745, 7.9808158, -1680.46, -2471.36, 32, 24),
    ('8dff8e85-aeb6-442a-8b15-cdec688f9c94'::uuid, 'solar', 51.3029364, 7.9815925, -1626.49, -2453.36, 60, 40),
    ('84a1512b-139e-4314-ba40-5f31e3ca32bb'::uuid, 'admin', 51.3016000, 7.9775000, -1910.86, -2601.96, 24, 24),
    ('b5d9e5f1-11f4-4159-a3ad-b06f039c74ae'::uuid, 'school', 51.3015191, 7.9770253, -1943.85, -2610.96, 24, 24),
    ('203e82d7-3bd4-441b-97c2-ccd611b85ecf'::uuid, 'residential_block', 51.3013032, 7.9775863, -1904.87, -2634.97, 28, 22),
    ('aebc4131-6802-482c-9b9b-cf7ac5afe939'::uuid, 'habitat', 51.3016540, 7.9780178, -1874.88, -2595.96, 28, 22),
    ('2969ce5e-0b2e-4295-85d7-f668ac6dac2b'::uuid, 'scanner', 51.3013572, 7.9781041, -1868.89, -2628.96, 24, 24);

  insert into public.state_base_relocation_20261028 (tile_entity_id, entity_id, old_latitude_deg, old_longitude_deg, old_x_m, old_y_m, old_rotation_deg, old_footprint_width_m, old_footprint_depth_m, old_spatial_region_id, old_site_id)
  select t.id, t.entity_id, t.latitude_deg, t.longitude_deg, t.x_m, t.y_m, t.rotation_deg, t.footprint_width_m, t.footprint_depth_m, t.spatial_region_id, t.site_id
    from public.tile_entities t join _plan p on p.id = t.id
   where t.location_id = v_earth and t.is_state_owned
  on conflict (tile_entity_id) do nothing;

  update public.tile_entities t set
    latitude_deg = p.lat, longitude_deg = p.lon, x_m = p.x, y_m = p.y,
    rotation_deg = -15.6, footprint_width_m = p.w, footprint_depth_m = p.d,
    spatial_region_id = 'earth-sauerland', placement_mode = 'world',
    site_id = coalesce(t.site_id, v_site),
    terrain_status = 'origin_pending', ground_elevation_m = null, terrain_min_elevation_m = null, terrain_max_elevation_m = null, terrain_slope_deg = null
  from _plan p
  where t.id = p.id and t.location_id = v_earth and t.is_state_owned and t.entity_id = p.entity_id;
  get diagnostics v_moved = row_count;
  raise notice 'Staatliche Basis: % Bauten an das Segelfluggelände Seidfeld verlegt', v_moved;
end $$;
