-- supabase/migrations/20260720300000_weltarchitektur_phase1.sql
-- Weltarchitektur Phase 1: celestial_bodies + locations Migration
-- Erstellt: 20.07.2026
-- ADR: docs/decisions/ADR-weltarchitektur-sonnensystem.md
--
-- Koordinatensystem:
--   Oberfläche: echte geographische Koordinaten (lat/lon in Dezimalgrad)
--   Orbit:      Höhe in km (LEO ~400, MEO ~2000, GEO ~36000)
--   Sonnensystem: orbit_radius_au (Astronomische Einheiten)

SET search_path TO public;

-- ══════════════════════════════════════════════════════════════════
-- 1. celestial_bodies — Himmelskörper im Sonnensystem
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS celestial_bodies (
  id               uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text     NOT NULL,
  slug             text     UNIQUE NOT NULL,
  body_type        text     NOT NULL CHECK (body_type IN (
                     'star', 'planet', 'moon', 'asteroid', 'lagrange', 'belt'
                   )),
  parent_id        uuid     REFERENCES celestial_bodies(id),

  -- Orbitale Parameter
  orbit_radius_au  numeric,          -- Abstand zur Sonne in AE
  orbit_period_d   numeric,          -- Umlaufzeit in Tagen
  orbit_eccentricity numeric DEFAULT 0,

  -- Physikalische Parameter
  surface_gravity  numeric  DEFAULT 1.0,   -- Erde = 1.0
  radius_km        numeric,                -- Radius des Körpers
  has_atmosphere   boolean  DEFAULT false,
  atmosphere_type  text,                   -- 'oxygen_rich' | 'co2' | 'thin' | 'none'

  -- Sonnensystem-Karte (UI-Position)
  map_x            numeric  DEFAULT 0,
  map_y            numeric  DEFAULT 0,

  -- Metadata
  description      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_celestial_bodies_parent
  ON celestial_bodies (parent_id);

CREATE INDEX IF NOT EXISTS idx_celestial_bodies_type
  ON celestial_bodies (body_type);

-- ══════════════════════════════════════════════════════════════════
-- 2. Seed: Bekannte Himmelskörper (2087 Zustand)
-- ══════════════════════════════════════════════════════════════════

INSERT INTO celestial_bodies (id, name, slug, body_type, parent_id,
  orbit_radius_au, orbit_period_d, surface_gravity, radius_km,
  has_atmosphere, atmosphere_type, map_x, map_y, description)
VALUES

-- Sonne
('10000000-0000-0000-0000-000000000001',
 'Sonne', 'sun', 'star', NULL,
 0, 0, 28.0, 696000,
 false, NULL, 0, 0,
 'Der Zentralstern des Sonnensystems. Primärquelle aller Energie.'),

-- Erde
('10000000-0000-0000-0000-000000000002',
 'Erde', 'earth', 'planet',
 '10000000-0000-0000-0000-000000000001',
 1.0, 365.25, 1.0, 6371,
 true, 'oxygen_rich', 200, 0,
 'Heimatwelt der Menschheit. Hauptsitz der Solar Central Bank.'),

-- Mond (Erdmond)
('10000000-0000-0000-0000-000000000003',
 'Mond', 'moon', 'moon',
 '10000000-0000-0000-0000-000000000002',
 0.00257, 27.32, 0.165, 1737,
 false, 'none', 220, -15,
 'Erste permanente Außenposten der Menschheit. Metall-Exporteur.'),

-- Mars
('10000000-0000-0000-0000-000000000004',
 'Mars', 'mars', 'planet',
 '10000000-0000-0000-0000-000000000001',
 1.524, 686.97, 0.376, 3390,
 true, 'co2', 350, 20,
 'Zweitgrößte Siedlung der Menschheit (2087: ~18.000 Kolonisten). Tharsis-Region.'),

-- Phobos
('10000000-0000-0000-0000-000000000005',
 'Phobos', 'phobos', 'moon',
 '10000000-0000-0000-0000-000000000004',
 0.0000627, 0.319, 0.0006, 11,
 false, 'none', 360, 15,
 'Innerer Mars-Mond. Freihafen. Extrem niedrige Schwerkraft.'),

-- Deimos
('10000000-0000-0000-0000-000000000006',
 'Deimos', 'deimos', 'moon',
 '10000000-0000-0000-0000-000000000004',
 0.000157, 1.263, 0.0003, 6,
 false, 'none', 365, 25,
 'Äußerer Mars-Mond. Noch unbewohnt (2087).'),

-- Asteroid-Gürtel (Repräsentativ)
('10000000-0000-0000-0000-000000000007',
 'Ceres', 'ceres', 'asteroid',
 '10000000-0000-0000-0000-000000000001',
 2.77, 1680, 0.029, 473,
 false, 'none', 500, -10,
 'Größtes Objekt im Asteroidengürtel. Reich an Wasser-Eis.'),

-- Jupiter (noch unbewohnt, aber für Navigation relevant)
('10000000-0000-0000-0000-000000000008',
 'Jupiter', 'jupiter', 'planet',
 '10000000-0000-0000-0000-000000000001',
 5.203, 4332, 2.528, 69911,
 true, 'hydrogen', 650, -30,
 'Gasriese. Gravitationsanker für Lagrange-Punkte L4/L5.')

ON CONFLICT (slug) DO UPDATE SET
  orbit_radius_au = EXCLUDED.orbit_radius_au,
  surface_gravity = EXCLUDED.surface_gravity,
  map_x = EXCLUDED.map_x,
  map_y = EXCLUDED.map_y;

-- ══════════════════════════════════════════════════════════════════
-- 3. locations erweitern
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS celestial_body_id  uuid REFERENCES celestial_bodies(id),
  ADD COLUMN IF NOT EXISTS location_type      text NOT NULL DEFAULT 'colony'
    CHECK (location_type IN ('colony', 'station', 'outpost', 'relay')),
  -- Oberflächen-Position (echte Geo-Koordinaten)
  ADD COLUMN IF NOT EXISTS surface_lat        numeric,   -- Breitengrad (-90 bis +90)
  ADD COLUMN IF NOT EXISTS surface_lon        numeric,   -- Längengrad (-180 bis +180)
  -- Grid-Größe (dynamisch, wächst mit Siedlung)
  ADD COLUMN IF NOT EXISTS grid_radius        integer NOT NULL DEFAULT 16,
  -- Orbit-Parameter (nur für Stationen)
  ADD COLUMN IF NOT EXISTS orbit_altitude_km  integer,   -- LEO~400, MEO~2000, GEO~36000
  ADD COLUMN IF NOT EXISTS orbit_inclination  numeric,   -- 0=äquatorial, 90=polar
  ADD COLUMN IF NOT EXISTS orbit_class        text
    CHECK (orbit_class IN ('LEO', 'MEO', 'GEO', 'HEO', NULL)),
  -- Eigentümer (Gründer)
  ADD COLUMN IF NOT EXISTS owner_id           uuid,      -- profile_id oder NULL (STATE)
  ADD COLUMN IF NOT EXISTS founded_at         timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_public          boolean NOT NULL DEFAULT true;

-- ══════════════════════════════════════════════════════════════════
-- 4. Bestehende Locations migrieren
-- ══════════════════════════════════════════════════════════════════

-- Mond / Shackleton-Kraterpol (89.9°S, 0°W — Südpol)
UPDATE locations SET
  celestial_body_id = '10000000-0000-0000-0000-000000000003',
  location_type     = 'colony',
  surface_lat       = -89.9,
  surface_lon       = 0.0,
  grid_radius       = 16
WHERE slug = 'moon';

-- Mars / Tharsis Hub (14°N, 102°W — Tharsis-Plateau)
UPDATE locations SET
  celestial_body_id = '10000000-0000-0000-0000-000000000004',
  location_type     = 'colony',
  surface_lat       = 14.0,
  surface_lon       = -102.0,
  grid_radius       = 24
WHERE slug = 'mars';

-- Phobos Station (kein Boden-Grid, Orbit-Station)
UPDATE locations SET
  celestial_body_id = '10000000-0000-0000-0000-000000000005',
  location_type     = 'station',
  surface_lat       = NULL,
  surface_lon       = NULL,
  orbit_altitude_km = 6,       -- Phobos selbst ist ~6000km vom Mars
  orbit_class       = 'LEO',   -- relativ zum Mars: sehr niedrig
  grid_radius       = 8
WHERE slug = 'phobos';

-- Prometheus (falls vorhanden — L5 Lagrange Habitat)
UPDATE locations SET
  celestial_body_id = '10000000-0000-0000-0000-000000000002',  -- Erde-nahe
  location_type     = 'station',
  orbit_altitude_km = 150000000,  -- L5 = ~150 Mio km von Erde
  orbit_class       = 'HEO',
  grid_radius       = 12
WHERE slug = 'prometheus';

-- ══════════════════════════════════════════════════════════════════
-- 5. Orbit-Klassen Referenz
-- ══════════════════════════════════════════════════════════════════
-- LEO (Low):    ~400km    — schnell erreichbar, kurze Umlaufzeit (~90min)
-- MEO (Medium): ~2000km   — Mittelweg, stabil
-- GEO/Areo:     ~36000km  — Geostationär, immer über gleichem Punkt
-- HEO (High):   >36000km  — Lagrange-Punkte, tief im Raum

-- ══════════════════════════════════════════════════════════════════
-- 6. Index + RLS
-- ══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_locations_celestial_body
  ON locations (celestial_body_id);

CREATE INDEX IF NOT EXISTS idx_locations_type
  ON locations (location_type);

CREATE INDEX IF NOT EXISTS idx_locations_surface
  ON locations (celestial_body_id, surface_lat, surface_lon)
  WHERE surface_lat IS NOT NULL;

ALTER TABLE celestial_bodies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "celestial_bodies_select_all" ON celestial_bodies;
CREATE POLICY "celestial_bodies_select_all"
  ON celestial_bodies FOR SELECT USING (true);

DROP POLICY IF EXISTS "celestial_bodies_service" ON celestial_bodies;
CREATE POLICY "celestial_bodies_service"
  ON celestial_bodies FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON celestial_bodies TO authenticated;
GRANT ALL    ON celestial_bodies TO service_role;

-- ══════════════════════════════════════════════════════════════════
-- 7. Reisezeit-Funktion
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calc_travel_time_seconds(
  p_from_location_id uuid,
  p_to_location_id   uuid,
  p_ship_speed_mult  numeric DEFAULT 1.0
) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_from  record;
  v_to    record;
  v_base  numeric;
BEGIN
  -- Lade beide Locations mit Himmelskörper-Daten
  SELECT l.*, cb.orbit_radius_au, cb.slug AS body_slug,
         l.orbit_altitude_km, l.surface_lat, l.surface_lon, l.location_type
  INTO v_from
  FROM locations l
  JOIN celestial_bodies cb ON cb.id = l.celestial_body_id
  WHERE l.id = p_from_location_id;

  SELECT l.*, cb.orbit_radius_au, cb.slug AS body_slug,
         l.orbit_altitude_km, l.surface_lat, l.surface_lon, l.location_type
  INTO v_to
  FROM locations l
  JOIN celestial_bodies cb ON cb.id = l.celestial_body_id
  WHERE l.id = p_to_location_id;

  IF v_from IS NULL OR v_to IS NULL THEN RETURN 30; END IF;

  -- Gleicher Himmelskörper, Oberfläche → Oberflächenentfernung
  IF v_from.celestial_body_id = v_to.celestial_body_id
     AND v_from.surface_lat IS NOT NULL AND v_to.surface_lat IS NOT NULL THEN
    -- Haversine-Näherung (vereinfacht: Winkelabstand × Radius × Faktor)
    v_base := abs(v_from.surface_lat - v_to.surface_lat)
            + abs(v_from.surface_lon - v_to.surface_lon);
    RETURN GREATEST(10, (v_base * 2 / p_ship_speed_mult)::integer);
  END IF;

  -- Gleicher Himmelskörper, Orbit-Differenz
  IF v_from.celestial_body_id = v_to.celestial_body_id THEN
    v_base := abs(coalesce(v_from.orbit_altitude_km,400)
                - coalesce(v_to.orbit_altitude_km,400)) * 0.001;
    RETURN GREATEST(15, (v_base / p_ship_speed_mult)::integer);
  END IF;

  -- Verschiedene Himmelskörper → vereinfachter Hohmann-Transfer
  v_base := sqrt(
    power(v_from.orbit_radius_au - v_to.orbit_radius_au, 2)
  ) * 86400 * 8;  -- 8 Tage pro AE (sehr vereinfacht, wird verfeinert)

  RETURN GREATEST(30, (v_base / p_ship_speed_mult)::integer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calc_travel_time_seconds TO service_role;
GRANT EXECUTE ON FUNCTION public.calc_travel_time_seconds TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- 8. Kontrolle
-- ══════════════════════════════════════════════════════════════════

SELECT
  cb.name AS körper,
  l.name  AS siedlung,
  l.location_type,
  l.surface_lat,
  l.surface_lon,
  l.orbit_class,
  l.grid_radius
FROM locations l
JOIN celestial_bodies cb ON cb.id = l.celestial_body_id
ORDER BY cb.orbit_radius_au, l.name;
