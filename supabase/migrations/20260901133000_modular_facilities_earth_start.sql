-- supabase/migrations/20260901133000_modular_facilities_earth_start.sql
-- NOXIA — Modulare Anlagen + öffentliche Earth-Startinfrastruktur
-- Erstellt: 01.09.2026
--
-- Kanonische Codequelle: lib/game/facilities/* + lib/game/seeds/earthStartSeed.ts
-- Grundregel: physische Erweiterung belegt reale Nachbartiles. Kein freies bzw.
-- legal nutzbares Tile => das Modul kann nicht gebaut werden.

SET search_path TO public;

-- ══════════════════════════════════════════════════════════════
-- 1. Earth als öffentlicher Referenz-/Startort sicherstellen
-- ══════════════════════════════════════════════════════════════

INSERT INTO locations (slug, name, description, population, population_max, is_supplied)
VALUES (
  'earth',
  'Tharsis Hub Sauerland',
  'Gemeinsamer NOXIA-Earth-Start im Sauerland, Nordrhein-Westfalen, Deutschland. Regionale Referenz: Sundern (Sauerland). Die 32x24-Karte ist eine verdichtete, topografisch plausible Repräsentation und kein Katasterplan.',
  999999999,
  999999999,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_supplied = true;

UPDATE locations SET
  celestial_body_id = '10000000-0000-0000-0000-000000000002',
  location_type = 'colony',
  grid_radius = 16,
  owner_id = NULL,
  is_public = true,
  simulate_tick = false
WHERE slug = 'earth';

-- Earth ist Export-/Startbasis, aber keine simulierte Bevölkerungskolonie.
INSERT INTO location_resources (location_id, resource, stock, consumption, production)
SELECT l.id, v.resource::resource_type, v.stock, 0, v.production
FROM locations l,
(VALUES
  ('water',  999999, 9999),
  ('energy', 999999, 9999),
  ('metal',  999999, 9999)
) AS v(resource, stock, production)
WHERE l.slug = 'earth'
ON CONFLICT (location_id, resource) DO UPDATE SET
  stock = GREATEST(location_resources.stock, EXCLUDED.stock),
  consumption = 0,
  production = EXCLUDED.production;

INSERT INTO market_prices (location_id, resource, buy_price, sell_price)
SELECT l.id, v.resource::resource_type, v.buy_price, v.sell_price
FROM locations l,
(VALUES
  ('water',  60, 1),
  ('energy', 40, 1),
  ('metal',  20, 1)
) AS v(resource, buy_price, sell_price)
WHERE l.slug = 'earth'
ON CONFLICT (location_id, resource) DO UPDATE SET
  buy_price = EXCLUDED.buy_price,
  sell_price = EXCLUDED.sell_price;

INSERT INTO colony_settings (location_id, tax_property, tax_transaction, tax_landing)
SELECT id, 0, 0, 0 FROM locations WHERE slug = 'earth'
ON CONFLICT (location_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 2. Generisches Anlagen-/Modulschema
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS facility_module_definitions (
  key                text PRIMARY KEY,
  name               text NOT NULL,
  facility_type      text NOT NULL,
  role               text NOT NULL,
  description        text NOT NULL DEFAULT '',
  footprint          jsonb NOT NULL DEFAULT '[{"row":0,"col":0}]'::jsonb,
  capacity           jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities       jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_locations  text[],
  requires_facility  boolean NOT NULL DEFAULT false,
  adjacent_roles     text[],
  buildable          boolean NOT NULL DEFAULT true,
  balancing_status   text NOT NULL DEFAULT 'tuning'
    CHECK (balancing_status IN ('canonical','tuning')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facility_instances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_key       text UNIQUE,
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  facility_type  text NOT NULL,
  name           text NOT NULL,
  owner_class    text NOT NULL DEFAULT 'PLAYER'
    CHECK (owner_class IN ('PLAYER','STATE','NPC','CORPORATION')),
  owner_id       uuid,
  operator_id    uuid,
  public_access  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facility_modules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_key        text UNIQUE,
  facility_id     uuid NOT NULL REFERENCES facility_instances(id) ON DELETE CASCADE,
  definition_key  text NOT NULL REFERENCES facility_module_definitions(key),
  tile_entity_id  uuid UNIQUE REFERENCES tile_entities(id) ON DELETE CASCADE,
  operator_id     uuid,
  occupant_id     uuid,
  public_access   boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facility_instances_location
  ON facility_instances(location_id);
CREATE INDEX IF NOT EXISTS idx_facility_modules_facility
  ON facility_modules(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_modules_definition
  ON facility_modules(definition_key);

GRANT SELECT ON facility_module_definitions, facility_instances, facility_modules TO authenticated;
GRANT ALL ON facility_module_definitions, facility_instances, facility_modules TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 3. Erste Moduldefinitionen
-- ══════════════════════════════════════════════════════════════

INSERT INTO facility_module_definitions
  (key, name, facility_type, role, description, capacity, capabilities,
   allowed_locations, requires_facility, adjacent_roles, buildable, balancing_status)
VALUES
  ('spaceport_core','Raumhafen-Kern','spaceport','core',
   'Kontrolle, Abfertigung, Basisservice und Anschluss der Pad-Module.',
   '{}'::jsonb,
   '["spaceport-control","dispatch","basic-service","module-connection"]'::jsonb,
   ARRAY['earth','moon','mars','phobos'],false,NULL,true,'canonical'),

  ('spaceport_pad_mini','Mini-Pad','spaceport','pad',
   'Kompaktes Pad mit integriertem Minilager und Basisservice.',
   '{"shipParking":2,"activeShipOperations":1,"shipClasses":["small","standard"],"storageUnits":1}'::jsonb,
   '["landing","launch","short-term-parking","mini-storage","basic-service"]'::jsonb,
   ARRAY['earth','moon','mars','phobos'],true,ARRAY['core','service','pad'],true,'canonical'),

  ('spaceport_pad_standard','Standard-Pad','spaceport','pad',
   'Mehrplatz-Pad; Start-/Landebetrieb und Parkkapazität sind getrennte Größen.',
   '{"shipParking":4,"activeShipOperations":1,"shipClasses":["small","standard"]}'::jsonb,
   '["landing","launch","parking","turnaround"]'::jsonb,
   ARRAY['earth','moon','mars'],true,ARRAY['core','service','pad'],true,'tuning'),

  ('spaceport_pad_cargo','Cargo-Pad','spaceport','cargo',
   'Pad mit Schwerpunkt Frachtumschlag und direkter Logistikanbindung.',
   '{"shipParking":3,"activeShipOperations":1,"shipClasses":["small","standard"],"storageUnits":2}'::jsonb,
   '["landing","launch","cargo-transfer","short-term-storage"]'::jsonb,
   ARRAY['earth','moon','mars'],true,ARRAY['core','storage','service','pad','cargo'],true,'tuning'),

  ('spaceport_pad_passenger','Passagier-Pad','spaceport','passenger',
   'Pad für Passagierabfertigung mit Terminalanschluss.',
   '{"shipParking":3,"activeShipOperations":1,"shipClasses":["small","standard"],"passengerUnits":2}'::jsonb,
   '["landing","launch","passenger-transfer"]'::jsonb,
   ARRAY['earth','moon','mars'],true,ARRAY['core','passenger','service','pad'],true,'tuning'),

  ('spaceport_pad_heavy','Heavy-Pad','spaceport','pad',
   'Verstärktes Einzelpad für schwere Schiffe und hohe Bodenlasten.',
   '{"shipParking":1,"activeShipOperations":1,"shipClasses":["heavy"]}'::jsonb,
   '["heavy-landing","heavy-launch","heavy-service"]'::jsonb,
   ARRAY['earth','moon','mars'],true,ARRAY['core','service','cargo','pad'],true,'tuning'),

  ('spaceport_service','Raumhafen-Service','spaceport','service',
   'Wartung, Versorgung und technische Bodenabfertigung.',
   '{}'::jsonb,
   '["maintenance","refuelling-interface","ground-service"]'::jsonb,
   ARRAY['earth','moon','mars','phobos'],true,ARRAY['core','pad','cargo','passenger'],true,'canonical'),

  ('spaceport_storage','Raumhafen-Lager','spaceport','storage',
   'Frachtpuffer mit direkter Übergabe an Pad- und Logistikmodule.',
   '{"storageUnits":4}'::jsonb,
   '["cargo-storage","cargo-buffer"]'::jsonb,
   ARRAY['earth','moon','mars','phobos'],true,ARRAY['core','cargo','service','storage'],true,'tuning'),

  ('warehouse_core','Lager-Kern','warehouse','core',
   'Warenannahme und erste physische Lagerfläche.',
   '{"storageUnits":2}'::jsonb,
   '["goods-receiving","storage"]'::jsonb,
   NULL,false,NULL,true,'tuning'),

  ('warehouse_storage','Lagerhalle','warehouse','storage',
   'Physische Erweiterung der Lagerkapazität auf einem Nachbartile.',
   '{"storageUnits":4}'::jsonb,
   '["storage"]'::jsonb,
   NULL,true,ARRAY['core','storage','cargo'],true,'tuning'),

  ('academy_core','Akademie-Kern','education','core',
   'Unterricht, Wissenszugang und Verwaltung.',
   '{}'::jsonb,
   '["education","knowledge-access"]'::jsonb,
   NULL,false,NULL,true,'canonical'),

  ('academy_lab','Akademie-Labor','education','research',
   'Praktisches Labor als räumliche Spezialisierung.',
   '{"researchUnits":1}'::jsonb,
   '["laboratory","practical-education","research"]'::jsonb,
   NULL,true,ARRAY['core','education','research'],true,'tuning'),

  ('administration_core','Verwaltungs-Kern','administration','core',
   'Öffentliche Verwaltung und Services.',
   '{}'::jsonb,
   '["administration","public-service"]'::jsonb,
   NULL,false,NULL,true,'canonical')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  facility_type = EXCLUDED.facility_type,
  role = EXCLUDED.role,
  description = EXCLUDED.description,
  capacity = EXCLUDED.capacity,
  capabilities = EXCLUDED.capabilities,
  allowed_locations = EXCLUDED.allowed_locations,
  requires_facility = EXCLUDED.requires_facility,
  adjacent_roles = EXCLUDED.adjacent_roles,
  buildable = EXCLUDED.buildable,
  balancing_status = EXCLUDED.balancing_status,
  updated_at = now();

-- Die sichtbaren Tile-Entities bekommen minimale Katalogeinträge, damit alte
-- Build-/Name-Pfade sie verstehen. Modulkapazitäten bleiben Source of Truth in
-- facility_module_definitions, nicht in building_definitions.
INSERT INTO building_definitions
  (key,name,description,category,tier,cost_credits,build_time_ticks,
   production,consumption,population_bonus,allowed_locations,is_active)
VALUES
  ('spaceport_core','Raumhafen-Kern','Kern einer modularen Raumhafenanlage.','infrastructure',1,6000,4,'[]'::jsonb,'[]'::jsonb,0,ARRAY['earth','moon','mars','phobos'],true),
  ('spaceport_pad_mini','Mini-Pad','Kompaktes Pad mit Minilager und Basisservice.','infrastructure',1,3500,3,'[]'::jsonb,'[]'::jsonb,0,ARRAY['earth','moon','mars','phobos'],true),
  ('spaceport_pad_standard','Standard-Pad','Mehrplatz-Pad für regulären Raumhafenbetrieb.','infrastructure',1,5000,4,'[]'::jsonb,'[]'::jsonb,0,ARRAY['earth','moon','mars'],true),
  ('spaceport_service','Raumhafen-Service','Wartung und Bodenabfertigung.','infrastructure',1,3000,3,'[]'::jsonb,'[]'::jsonb,0,ARRAY['earth','moon','mars','phobos'],true),
  ('spaceport_storage','Raumhafen-Lager','Frachtpuffer des Raumhafens.','infrastructure',1,3000,3,'[]'::jsonb,'[]'::jsonb,0,ARRAY['earth','moon','mars','phobos'],true),
  ('warehouse_storage','Lagerhalle','Physische Lagererweiterung.','infrastructure',1,2500,3,'[]'::jsonb,'[]'::jsonb,0,NULL,true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  cost_credits = EXCLUDED.cost_credits,
  build_time_ticks = EXCLUDED.build_time_ticks,
  allowed_locations = EXCLUDED.allowed_locations,
  is_active = true;

-- ══════════════════════════════════════════════════════════════
-- 4. Öffentliche Earth-Anlagen
-- ══════════════════════════════════════════════════════════════

INSERT INTO facility_instances
  (seed_key, location_id, facility_type, name, owner_class, owner_id, operator_id, public_access)
SELECT v.seed_key, l.id, v.facility_type, v.name, 'STATE', NULL, NULL, true
FROM locations l,
(VALUES
  ('earth_public_spaceport','spaceport','Tharsis Hub Sauerland'),
  ('earth_public_admin','administration','Tharsis Hub Verwaltung'),
  ('earth_public_academy','education','Tharsis Hub Akademie'),
  ('earth_public_warehouse','warehouse','Tharsis Hub Logistik')
) AS v(seed_key, facility_type, name)
WHERE l.slug = 'earth'
ON CONFLICT (seed_key) DO UPDATE SET
  name = EXCLUDED.name,
  owner_class = 'STATE',
  owner_id = NULL,
  public_access = true;

-- Altes Alpha-Startquartett nur an seinen historischen Positionen entfernen.
DELETE FROM tile_entities te
WHERE te.location_id = (SELECT id FROM locations WHERE slug = 'earth')
  AND te.tile_level = 0
  AND te.owner_class = 'STATE'
  AND (te.tile_row, te.tile_col, te.entity_id) IN (
    (3,4,'landing_pad'),
    (3,5,'admin'),
    (3,6,'school'),
    (2,5,'warehouse')
  );

-- Kollisionsschutz für den neuen kanonischen Seed: fremde Belegung wird nicht
-- verdrängt. Die Migration meldet stattdessen verständlich den Konflikt.
-- Die Seed-Zellen sind die südöstliche Hardstand-/Betonzone (P) der Earth-v5-
-- Karte — kanonisch laut lib/game/seeds/earthStartSeed.ts EARTH_START_MODULES.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tile_entities te
    JOIN locations l ON l.id = te.location_id
    JOIN (VALUES
      (19,26),(18,26),(19,27),(20,26),(19,25),(20,25),
      (21,25),(21,26),(21,27),(21,28)
    ) AS s(r,c) ON te.tile_row=s.r AND te.tile_col=s.c
    WHERE l.slug='earth' AND te.tile_level=0
      AND NOT (te.owner_class='STATE' AND te.entity_type='building')
  ) THEN
    RAISE EXCEPTION 'Earth modular start seed blocked by non-STATE entity on a required tile';
  END IF;
END $$;

-- Alte STATE-Bauten auf den Seed-Zellen dürfen durch den neuen kanonischen
-- Zustand ersetzt werden; PLAYER/NPC/CORPORATION wurden oben ausdrücklich geschützt.
DELETE FROM tile_entities te
USING locations l, (VALUES
  (19,26),(18,26),(19,27),(20,26),(19,25),(20,25),
  (21,25),(21,26),(21,27),(21,28)
) AS s(r,c)
WHERE te.location_id=l.id AND l.slug='earth'
  AND te.tile_level=0
  AND te.tile_row=s.r AND te.tile_col=s.c
  AND te.entity_type='building'
  AND te.owner_class='STATE';

INSERT INTO tile_entities
  (profile_id, location_id, tile_level, tile_row, tile_col,
   entity_type, entity_id, owner_class, owner_id, is_state_owned, occupant_id, built_at)
SELECT NULL, l.id, 0, v.r, v.c,
       'building', v.entity_id, 'STATE', NULL, true, NULL, now()
FROM locations l,
-- Positionen = EARTH_START_MODULES aus lib/game/seeds/earthStartSeed.ts:
-- der Tharsis Hub liegt auf der südöstlichen P-Hardstand-Zone (Zeilen 18–21,
-- Spalten 25–28) der Earth-v5-Karte, nicht im nordwestlichen Waldgürtel.
(VALUES
  (19,26,'spaceport_core'),
  (18,26,'spaceport_pad_standard'),
  (19,27,'spaceport_pad_standard'),
  (20,26,'spaceport_pad_mini'),
  (19,25,'spaceport_service'),
  (20,25,'spaceport_storage'),
  (21,25,'admin'),
  (21,26,'school'),
  (21,27,'warehouse'),
  (21,28,'warehouse_storage')
) AS v(r,c,entity_id)
WHERE l.slug='earth';

-- Facility-Module mit den soeben erzeugten physischen Tile-Entities verbinden.
INSERT INTO facility_modules
  (seed_key, facility_id, definition_key, tile_entity_id, operator_id, occupant_id, public_access)
SELECT
  v.module_key,
  fi.id,
  v.definition_key,
  te.id,
  NULL,
  NULL,
  true
FROM (VALUES
  ('earth_spaceport_core','earth_public_spaceport','spaceport_core',19,26,'spaceport_core'),
  ('earth_pad_standard_1','earth_public_spaceport','spaceport_pad_standard',18,26,'spaceport_pad_standard'),
  ('earth_pad_standard_2','earth_public_spaceport','spaceport_pad_standard',19,27,'spaceport_pad_standard'),
  ('earth_pad_mini_1','earth_public_spaceport','spaceport_pad_mini',20,26,'spaceport_pad_mini'),
  ('earth_spaceport_service','earth_public_spaceport','spaceport_service',19,25,'spaceport_service'),
  ('earth_spaceport_storage','earth_public_spaceport','spaceport_storage',20,25,'spaceport_storage'),
  ('earth_admin_core','earth_public_admin','administration_core',21,25,'admin'),
  ('earth_academy_core','earth_public_academy','academy_core',21,26,'school'),
  ('earth_warehouse_core','earth_public_warehouse','warehouse_core',21,27,'warehouse'),
  ('earth_warehouse_storage_1','earth_public_warehouse','warehouse_storage',21,28,'warehouse_storage')
) AS v(module_key, facility_key, definition_key, r, c, entity_id)
JOIN facility_instances fi ON fi.seed_key=v.facility_key
JOIN locations l ON l.id=fi.location_id AND l.slug='earth'
JOIN tile_entities te ON te.location_id=l.id
  AND te.tile_level=0 AND te.tile_row=v.r AND te.tile_col=v.c
  AND te.entity_type='building' AND te.entity_id=v.entity_id
ON CONFLICT (seed_key) DO UPDATE SET
  facility_id=EXCLUDED.facility_id,
  definition_key=EXCLUDED.definition_key,
  tile_entity_id=EXCLUDED.tile_entity_id,
  public_access=true;

-- ══════════════════════════════════════════════════════════════
-- 5. Kontrolle
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  module_count integer;
  ship_parking integer;
BEGIN
  SELECT count(*) INTO module_count
  FROM facility_modules fm
  JOIN facility_instances fi ON fi.id=fm.facility_id
  WHERE fi.seed_key LIKE 'earth_public_%';

  IF module_count <> 10 THEN
    RAISE EXCEPTION 'Earth facility seed incomplete: % modules instead of 10', module_count;
  END IF;

  SELECT COALESCE(sum((fmd.capacity->>'shipParking')::integer),0)
  INTO ship_parking
  FROM facility_modules fm
  JOIN facility_instances fi ON fi.id=fm.facility_id
  JOIN facility_module_definitions fmd ON fmd.key=fm.definition_key
  WHERE fi.seed_key='earth_public_spaceport';

  IF ship_parking < 6 THEN
    RAISE EXCEPTION 'Earth public spaceport capacity too small: %', ship_parking;
  END IF;
END $$;
