-- supabase/migrations/20260830190000_tharsis_hub_start_seed.sql
-- OTA-NOX-REQ-20260830-THARSIS-HUB-START-SEED — Tharsis Hub als staatliche Startkolonie
-- Erstellt: 30.08.2026
--
-- Kanonischer Start-Seed mit 497 Bewohnern und 504 Habitatplätzen.
-- GENERIERT aus lib/game/seeds/tharsisHubSeed.ts (kanonische Quelle).
-- Die Akzeptanztests (npx tsx lib/game/seeds/tharsisHubSeed.test.ts) prüfen
-- Stückzahlen, N-1-Straßenpfade, Rettungszugänge und doppelte Medienanbindung.
--
-- Eigentumsmodell: bestehendes kanonisches Owner-Konzept, KEINE neue
-- Eigentums-ID: owner_class='STATE', is_state_owned=true, owner_id=NULL.
-- Betreiber/Okkupant kann später über concessions/occupant_id abweichen.
--
-- Ersetzt das alte Tharsis-Startlayout vollständig:
--   * locations.mars: 497 Einwohner / 504 Plätze (base=0 → 6 Cluster × 84)
--   * alte STATE/NPC-Produktions-/Wohn-Seedbauten werden entfernt
--     (PLAYER-Eigentum bleibt unangetastet); Service-Bauten (bank, school,
--     shipyard, admin, scanner) bleiben als laufende Staatsservices erhalten
--   * Seed-Zellen mit Fremdbelegung (PLAYER-Eigentum oder erhaltene
--     Staatsservices) werden NIE überschrieben: Abschnitt 6/8 bricht dann mit
--     einer dokumentierten Meldung ab, statt die Unique-Indexes
--     te_building_per_tile/uniq_building_per_tile roh zu verletzen
--   * Fahrwege werden persistente STATE-Infrastruktur (entity_id='road'),
--     die das alte prozedurale Mars-Straßennetz ablöst (ADR-strassen-infrastruktur)
--   * Utility Ring A/B als eigene, von Fahrwegen getrennte Netzlogik

SET search_path TO public;

-- ══════════════════════════════════════════════════════════════
-- 1. Schema-Härtung (idempotent — entspricht dem Zustand nach
--    den archivierten Migrationen 003/005/033)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS base_population_max integer;

-- STATE-Zeilen haben kanonisch KEIN Profil (owner_id=NULL). Der NOT-NULL-
-- Zwang auf profile_id stammt aus der Alt-Schema-Ebene; Code und UI behandeln
-- profile_id bereits heute als nullable.
ALTER TABLE tile_entities ALTER COLUMN profile_id DROP NOT NULL;

ALTER TABLE tile_entities
  ADD COLUMN IF NOT EXISTS owner_class text NOT NULL DEFAULT 'PLAYER',
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS occupant_id uuid,
  ADD COLUMN IF NOT EXISTS lease_id uuid,
  ADD COLUMN IF NOT EXISTS lease_price integer,
  ADD COLUMN IF NOT EXISTS is_state_owned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.tile_entities(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS slot smallint,
  ADD COLUMN IF NOT EXISTS condition smallint,
  ADD COLUMN IF NOT EXISTS status text;

-- ══════════════════════════════════════════════════════════════
-- 2. Standort-Seed ersetzen (497 Bewohner, 504 Plätze)
-- ══════════════════════════════════════════════════════════════

UPDATE locations SET
  population          = 497,
  population_max      = 504,
  base_population_max = 0,   -- Kapazität kommt aus 6 Habitatclustern × 84
  is_supplied         = true,
  description         = 'Staatliche Startkolonie auf dem Tharsis-Plateau. '
                        '497 Bewohner, sechs isolierbare Habitatcluster, drei '
                        'Energie-Domänen, drei Wasserstränge.'
WHERE slug = 'mars';

-- ══════════════════════════════════════════════════════════════
-- 3. Altes Tharsis-Startlayout entfernen (nur Staats-/NPC-Bestand;
--    PLAYER-Gebäude bleiben unangetastet)
-- ══════════════════════════════════════════════════════════════

DELETE FROM tile_entities te
WHERE te.location_id = (SELECT id FROM locations WHERE slug = 'mars')
  AND te.owner_class IN ('STATE','NPC','CORPORATION')
  AND te.entity_type = 'building'
  AND te.entity_id IN (
    'habitat','residential_block','mine','solar','ice_drill','water_recycler',
    'factory','laboratory','smelter','bar','oxygen_recycler','reactor',
    'command_center','landing_pad','warehouse','docking_bay','market'
  );

-- Kollisionsschutz: der kanonische Seed gewinnt jede Zelle, die nicht fremd
-- belegt ist. Alte STATE/NPC/CORPORATION-Bauten auf Seed-Zellen werden entfernt
-- (nur wenn sie NICHT zu den erhaltenen Staatsservices gehören); PLAYER-Eigentum
-- und erhaltene Staatsservices bleiben unangetastet. Verbleibt eine Fremdbelegung
-- auf einer Seed-Zelle, bricht Abschnitt 6/8 mit einer dokumentierten Meldung ab
-- statt einer rohen Unique-Verletzung.
DELETE FROM tile_entities te
USING (VALUES
      (2,28),
      (3,26),
      (3,27),
      (3,28),
      (4,26),
      (4,27),
      (5,0),
      (5,1),
      (5,26),
      (5,27),
      (6,0),
      (6,1),
      (6,2),
      (6,3),
      (6,22),
      (6,23),
      (6,24),
      (6,25),
      (6,26),
      (6,27),
      (7,0),
      (7,1),
      (7,2),
      (7,3),
      (7,22),
      (7,26),
      (7,27),
      (7,28),
      (8,0),
      (8,3),
      (8,4),
      (8,22),
      (9,0),
      (9,2),
      (9,3),
      (9,4),
      (9,5),
      (9,22),
      (9,23),
      (9,24),
      (10,0),
      (10,22),
      (10,23),
      (11,0),
      (11,23),
      (12,0),
      (12,12),
      (12,13),
      (12,14),
      (12,15),
      (12,16),
      (12,17),
      (12,23),
      (13,0),
      (13,10),
      (13,11),
      (13,12),
      (13,13),
      (13,14),
      (13,15),
      (13,16),
      (13,17),
      (13,18),
      (13,19),
      (13,23),
      (13,24),
      (13,25),
      (13,28),
      (14,0),
      (14,9),
      (14,10),
      (14,11),
      (14,12),
      (14,13),
      (14,14),
      (14,15),
      (14,16),
      (14,17),
      (14,18),
      (14,19),
      (14,23),
      (15,0),
      (15,9),
      (15,10),
      (15,11),
      (15,12),
      (15,13),
      (15,14),
      (15,15),
      (15,16),
      (15,17),
      (15,18),
      (15,19),
      (15,23),
      (16,0),
      (16,9),
      (16,10),
      (16,11),
      (16,12),
      (16,13),
      (16,14),
      (16,15),
      (16,16),
      (16,17),
      (16,18),
      (16,19),
      (16,23),
      (17,0),
      (17,9),
      (17,10),
      (17,11),
      (17,12),
      (17,13),
      (17,14),
      (17,15),
      (17,16),
      (17,17),
      (17,18),
      (17,19),
      (17,20),
      (17,21),
      (17,22),
      (17,23),
      (18,0),
      (18,7),
      (18,8),
      (18,9),
      (18,10),
      (18,11),
      (18,12),
      (18,13),
      (18,14),
      (18,15),
      (18,16),
      (18,17),
      (18,18),
      (18,23),
      (19,0),
      (19,8),
      (19,16),
      (19,18),
      (20,0),
      (20,6),
      (20,7),
      (20,16),
      (20,17),
      (20,18),
      (20,19),
      (20,20),
      (21,0),
      (21,4),
      (21,5),
      (21,6),
      (21,7),
      (21,8),
      (21,18),
      (21,27),
      (22,0),
      (22,3),
      (22,4),
      (22,5),
      (22,6),
      (22,7),
      (22,8),
      (22,9),
      (22,10),
      (22,11),
      (22,12),
      (22,13),
      (22,14),
      (22,15),
      (22,16),
      (22,17),
      (22,18),
      (22,26),
      (22,27),
      (23,0),
      (23,1),
      (23,2),
      (23,3),
      (23,4),
      (23,18),
      (23,19),
      (23,20),
      (23,21),
      (23,22),
      (23,23),
      (23,24),
      (23,25),
      (23,26),
      (23,27),
      (23,28)
     ) AS seed(r, c)
WHERE te.location_id = (SELECT id FROM locations WHERE slug = 'mars')
  AND te.owner_class IN ('STATE','NPC','CORPORATION')
  AND te.entity_type = 'building'
  AND te.entity_id NOT IN ('bank','school','shipyard','admin','scanner')
  AND te.tile_row = seed.r AND te.tile_col = seed.c;

-- ══════════════════════════════════════════════════════════════
-- 4. Baukatalog: neue NOXIA-Objektklassen registrieren
--    (NOXIA-eigene Kosten/Bauzeiten; Balancing bleibt NOXIA)
-- ══════════════════════════════════════════════════════════════

INSERT INTO building_definitions
  (key, name, description, category, tier, cost_credits, build_time_ticks,
   production, consumption, population_bonus, allowed_locations, is_active)
VALUES
  ('habitat_cluster','Habitatcluster','84 Plätze · zwei interne Druck-/Brandsegmente · Safe-Haven · lokale ECLSS integriert','housing',2,12000,12,
   '[]'::jsonb,'[]'::jsonb,84,ARRAY['mars'],true),
  ('eclss_hub','Regionaler ECLSS-/Utility-Hub','Versorgt zwei Habitatcluster · degradierter Betrieb trägt Mindest-O₂-/CO₂-Bedarf','infrastructure',2,9000,8,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('reactor_module','Reaktormodul','Nennleistung ca. 1,25 MW · 2 Module je Energie-Komplex','production',2,12000,10,
   '[{"resource":"energy","amount":8}]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('black_start','Black-Start-/Speicherknoten','Integrierter Schwarzstart- und Speicherknoten je Energie-Komplex','infrastructure',2,5000,4,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('water_isru','Wasser-ISRU-/Aufbereitungskomplex','Eigener Roh-/Prozesswasserpuffer (8 t) · drei unabhängige Prozessstränge im Start-Seed','production',2,9000,8,
   '[{"resource":"water","amount":3}]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('radiator_field','Radiatorfeld','Thermische Abstrahlung · Staubdegradation/Reinigung/Feldisolation abbildbar','infrastructure',1,2500,3,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('medical_core','Medical-Core-Komplex','Zwei getrennte klinische Zellen · zwei unabhängige Medienzuführungen','service',2,8000,6,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('medical_annex','Emergency Medical Annex','Stabilisierung bei Isolation/Ausfall des Hauptkerns · anderer Habitatcluster','service',2,3500,4,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('reserve_depot','Strategisches Reserve-Depot','Lagerfähige 30-Tage-Reserve · intern getrennte Zonen','infrastructure',1,4000,4,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('plant_module','Frischproduktions-/Pflanzenmodul','Nicht überlebenskritisch · keine Kalorienautarkie','production',1,3000,3,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('logistics_hub','Logistik-/Frachtumschlag-Hub','Grenze Außenbereich ↔ Drucksystem · eigene Staub-/Dekontaminationslinie','infrastructure',2,5500,5,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('workshop_clean','Werkstatt — Elektronik/Präzision/ECLSS','Saubere Werkstattzelle','production',1,3500,3,
   '[{"resource":"components","amount":1}]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('workshop_heavy','Werkstatt — Mechanik/Fertigung/Bau','Schwere Werkstattzelle','production',1,4500,4,
   '[{"resource":"components","amount":1}]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('material_complex','Material-/Reststoff-Komplex','Nassstrom-Behandlungszug + Trocken-/Materialzelle · medizinischer Stoffpfad gekapselt','infrastructure',2,4500,4,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('command_node','Command-&-Control-Knoten','Lokale Steuerung · kein alleiniger Master','infrastructure',2,6000,5,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('surface_relay','Oberflächen-Relay-/Navigationspunkt','Lokale Funk-/Navigationsabdeckung','infrastructure',1,1500,2,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('longrange_comms','Langstrecken-Kommunikationsstation','Erde-/Orbit-Uplink · redundant ausgelegt','infrastructure',2,7000,6,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true),
  ('landing_pad','Landeplatz','Lande- und Frachtbereich mit direktem Schwerlastweg zum Logistik-Hub','infrastructure',1,4000,3,
   '[]'::jsonb,'[]'::jsonb,0,ARRAY['mars'],true)
ON CONFLICT (key) DO UPDATE SET
  cost_credits     = EXCLUDED.cost_credits,
  build_time_ticks = EXCLUDED.build_time_ticks,
  production       = EXCLUDED.production,
  population_bonus = EXCLUDED.population_bonus,
  allowed_locations= EXCLUDED.allowed_locations,
  is_active        = true;

-- ══════════════════════════════════════════════════════════════
-- 5. Deterministische UUIDs (idempotent, wie Living-Population-Seed)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.noxia_tharsis_uuid(ref text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT (substr(md5('noxia-tharsis:'||ref),1,8)||'-'||
          substr(md5('noxia-tharsis:'||ref),9,4)||'-4'||
          substr(md5('noxia-tharsis:'||ref),14,3)||'-8'||
          substr(md5('noxia-tharsis:'||ref),18,3)||'-'||
          substr(md5('noxia-tharsis:'||ref),21,12))::uuid
$$;

-- ══════════════════════════════════════════════════════════════
-- 6. Startobjekte — staatlich owned
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  mars_id uuid;
  b_uuid  uuid;
  seed    record;
BEGIN
  SELECT id INTO mars_id FROM locations WHERE slug='mars' LIMIT 1;
  IF mars_id IS NULL THEN
    RAISE NOTICE 'Tharsis seed skipped: location mars not found';
    RETURN;
  END IF;

  FOR seed IN SELECT * FROM (VALUES
      ('workshop_clean','workshop_clean',12,12),
      ('reserve_depot_2','reserve_depot',12,13),
      ('eclss_hub_3','eclss_hub',12,14),
      ('reserve_depot_3','reserve_depot',12,15),
      ('plant_module','plant_module',12,16),
      ('eclss_hub_2','eclss_hub',12,17),
      ('eclss_hub_1','eclss_hub',14,12),
      ('habitat_cluster_1','habitat_cluster',14,13),
      ('habitat_cluster_2','habitat_cluster',14,14),
      ('habitat_cluster_3','habitat_cluster',14,15),
      ('medical_core','medical_core',14,16),
      ('command_node_1','command_node',14,17),
      ('reserve_depot_1','reserve_depot',16,12),
      ('habitat_cluster_4','habitat_cluster',16,13),
      ('habitat_cluster_5','habitat_cluster',16,14),
      ('habitat_cluster_6','habitat_cluster',16,15),
      ('medical_annex','medical_annex',16,16),
      ('command_node_2','command_node',16,17),
      ('logistics_hub','logistics_hub',14,11),
      ('workshop_heavy','workshop_heavy',15,11),
      ('material_complex_1','material_complex',16,11),
      ('material_complex_2','material_complex',17,11),
      ('water_isru_1','water_isru',18,7),
      ('water_isru_2','water_isru',20,6),
      ('water_isru_3','water_isru',21,4),
      ('reactor_module_1','reactor_module',5,27),
      ('reactor_module_2','reactor_module',4,27),
      ('black_start_1','black_start',6,27),
      ('reactor_module_3','reactor_module',5,1),
      ('reactor_module_4','reactor_module',6,1),
      ('black_start_2','black_start',6,2),
      ('reactor_module_5','reactor_module',21,27),
      ('reactor_module_6','reactor_module',22,27),
      ('black_start_3','black_start',22,26),
      ('radiator_field_1','radiator_field',3,28),
      ('radiator_field_2','radiator_field',7,28),
      ('radiator_field_3','radiator_field',13,28),
      ('radiator_field_4','radiator_field',9,2),
      ('radiator_field_5','radiator_field',23,28),
      ('surface_relay_1','surface_relay',9,24),
      ('surface_relay_2','surface_relay',13,25),
      ('surface_relay_3','surface_relay',18,23),
      ('longrange_comms_1','longrange_comms',2,28),
      ('longrange_comms_2','longrange_comms',22,3),
      ('landing_pad','landing_pad',20,20)
     ) AS s(seed_id, entity_id, trow, tcol)
  LOOP
    b_uuid := noxia_tharsis_uuid('building:'||seed.seed_id);

    -- Kollisionsschutz: te_building_per_tile/uniq_building_per_tile erlauben
    -- nur EIN Gebäude je Zelle. Eine fremde Belegung der Seed-Zelle
    -- (PLAYER-Eigentum oder laufender Staatsservice) wird nie überschrieben —
    -- PLAYER-Eigentum bleibt unangetastet (ADR-Entscheidung 6). Statt einer
    -- rohen Unique-Verletzung bricht die Migration hier bewusst und
    -- dokumentiert ab.
    IF EXISTS (
      SELECT 1 FROM tile_entities
       WHERE location_id = mars_id
         AND tile_level = 0
         AND tile_row = seed.trow
         AND tile_col = seed.tcol
         AND entity_type = 'building'
         AND id <> b_uuid
    ) THEN
      RAISE EXCEPTION
        'Tharsis-Hub-Seed: Zelle (%,%) ist durch ein fremdes Gebäude belegt (Seed-Objekt %, ID %). PLAYER-Eigentum und laufende Staatsservices bleiben unangetastet — bitte Konflikt manuell auflösen oder Seed anpassen.',
        seed.trow, seed.tcol, seed.seed_id, b_uuid;
    END IF;

    INSERT INTO tile_entities
      (id, profile_id, location_id, tile_level, tile_row, tile_col,
       entity_type, entity_id, owner_class, owner_id, is_state_owned, built_at)
    VALUES
      (b_uuid, NULL, mars_id, 0, seed.trow, seed.tcol,
       'building', seed.entity_id, 'STATE', NULL, true, now())
    ON CONFLICT (id) DO UPDATE SET
      tile_row      = EXCLUDED.tile_row,
      tile_col      = EXCLUDED.tile_col,
      entity_id     = EXCLUDED.entity_id,
      owner_class   = 'STATE',
      is_state_owned= true,
      profile_id    = NULL;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 7. Fahrzeug-Startbestand (Abschnitt 2) — staatlich owned
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  mars_id uuid;
  v_uuid  uuid;
  seed    record;
BEGIN
  SELECT id INTO mars_id FROM locations WHERE slug='mars' LIMIT 1;
  IF mars_id IS NULL THEN RETURN; END IF;

  FOR seed IN SELECT * FROM (VALUES
      ('rescue_rover_1','rescue_rover',21,10),
      ('rescue_rover_2','rescue_rover',21,11),
      ('rescue_rover_3','rescue_rover',21,12),
      ('cargo_transporter_1','cargo_transporter',21,17),
      ('cargo_transporter_2','cargo_transporter',21,19),
      ('cargo_transporter_3','cargo_transporter',21,20),
      ('cargo_transporter_4','cargo_transporter',21,21),
      ('construction_vehicle_1','construction_vehicle',20,13),
      ('construction_vehicle_2','construction_vehicle',20,14),
      ('maintenance_vehicle_1','maintenance_vehicle',20,10),
      ('maintenance_vehicle_2','maintenance_vehicle',20,11),
      ('maintenance_vehicle_3','maintenance_vehicle',20,12),
      ('inspection_drone_1','inspection_drone',10,4),
      ('inspection_drone_2','inspection_drone',10,5),
      ('inspection_drone_3','inspection_drone',11,4),
      ('inspection_drone_4','inspection_drone',11,5),
      ('inspection_drone_5','inspection_drone',12,4),
      ('inspection_drone_6','inspection_drone',12,5),
      ('inspection_drone_7','inspection_drone',13,4),
      ('inspection_drone_8','inspection_drone',13,5)
     ) AS s(seed_id, class_id, trow, tcol)
  LOOP
    v_uuid := noxia_tharsis_uuid('vehicle:'||seed.seed_id);
    INSERT INTO tile_entities
      (id, profile_id, location_id, tile_level, tile_row, tile_col,
       entity_type, entity_id, owner_class, owner_id, is_state_owned, built_at)
    VALUES
      (v_uuid, NULL, mars_id, 0, seed.trow, seed.tcol,
       'vehicle', seed.class_id, 'STATE', NULL, true, now())
    ON CONFLICT (id) DO UPDATE SET
      tile_row      = EXCLUDED.tile_row,
      tile_col      = EXCLUDED.tile_col,
      entity_id     = EXCLUDED.entity_id,
      owner_class   = 'STATE',
      is_state_owned= true,
      profile_id    = NULL;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 8. Fahrwege — persistente STATE-Infrastruktur (ADR-strassen-infrastruktur)
--    Innerer Service-Ring + drei Hauptkorridore + Service-Spurs.
--    Kein dekoratives Netz, keine Schiene. Ein Road-Tile trägt NICHT
--    automatisch alle Medien (Utility-Netze sind getrennte Netzlogik).
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  mars_id uuid;
  r_uuid  uuid;
  seed    record;
BEGIN
  SELECT id INTO mars_id FROM locations WHERE slug='mars' LIMIT 1;
  IF mars_id IS NULL THEN RETURN; END IF;

  FOR seed IN SELECT * FROM (VALUES
      (13,10,'ring'),
      (13,11,'ring'),
      (13,12,'ring'),
      (13,13,'ring'),
      (13,14,'ring'),
      (13,15,'ring'),
      (13,16,'ring'),
      (13,17,'ring'),
      (13,18,'ring'),
      (18,10,'ring'),
      (18,11,'ring'),
      (18,12,'ring'),
      (18,13,'ring'),
      (18,14,'ring'),
      (18,15,'ring'),
      (18,16,'ring'),
      (18,17,'ring'),
      (18,18,'ring'),
      (14,10,'ring'),
      (15,10,'ring'),
      (16,10,'ring'),
      (17,10,'ring'),
      (14,18,'ring'),
      (15,18,'ring'),
      (16,18,'ring'),
      (17,18,'ring'),
      (15,12,'spur'),
      (15,13,'spur'),
      (15,14,'spur'),
      (15,15,'spur'),
      (15,16,'spur'),
      (15,17,'spur'),
      (17,12,'spur'),
      (17,13,'spur'),
      (17,14,'spur'),
      (17,15,'spur'),
      (17,16,'spur'),
      (17,17,'spur'),
      (13,19,'energy'),
      (14,19,'energy'),
      (15,19,'energy'),
      (16,19,'energy'),
      (17,19,'energy'),
      (17,20,'energy'),
      (17,21,'energy'),
      (17,22,'energy'),
      (17,23,'energy'),
      (16,23,'energy'),
      (15,23,'energy'),
      (14,23,'energy'),
      (13,23,'energy'),
      (12,23,'energy'),
      (11,23,'energy'),
      (10,23,'energy'),
      (10,22,'energy'),
      (9,22,'energy'),
      (8,22,'energy'),
      (7,22,'energy'),
      (6,22,'energy'),
      (6,23,'energy'),
      (6,24,'energy'),
      (6,25,'energy'),
      (6,26,'energy'),
      (5,26,'energy'),
      (23,4,'energy'),
      (23,3,'energy'),
      (23,2,'energy'),
      (23,1,'energy'),
      (23,0,'energy'),
      (22,0,'energy'),
      (21,0,'energy'),
      (20,0,'energy'),
      (19,0,'energy'),
      (18,0,'energy'),
      (17,0,'energy'),
      (16,0,'energy'),
      (15,0,'energy'),
      (14,0,'energy'),
      (13,0,'energy'),
      (12,0,'energy'),
      (11,0,'energy'),
      (10,0,'energy'),
      (9,0,'energy'),
      (8,0,'energy'),
      (7,0,'energy'),
      (6,0,'energy'),
      (5,0,'energy'),
      (7,1,'energy'),
      (7,2,'energy'),
      (7,3,'energy'),
      (6,3,'energy'),
      (19,18,'energy'),
      (20,18,'energy'),
      (21,18,'energy'),
      (22,18,'energy'),
      (23,18,'energy'),
      (23,19,'energy'),
      (23,20,'energy'),
      (23,21,'energy'),
      (23,22,'energy'),
      (23,23,'energy'),
      (23,24,'energy'),
      (23,25,'energy'),
      (23,26,'energy'),
      (23,27,'energy'),
      (14,9,'water'),
      (15,9,'water'),
      (16,9,'water'),
      (17,9,'water'),
      (18,9,'water'),
      (18,8,'water'),
      (19,8,'water'),
      (20,7,'water'),
      (21,7,'water'),
      (21,6,'water'),
      (21,5,'water'),
      (21,8,'water'),
      (22,6,'water'),
      (22,7,'water'),
      (22,8,'water'),
      (22,9,'water'),
      (22,10,'water'),
      (22,11,'water'),
      (22,12,'water'),
      (22,13,'water'),
      (22,14,'water'),
      (22,15,'water'),
      (22,16,'water'),
      (22,17,'water'),
      (19,16,'freight'),
      (20,16,'freight'),
      (20,17,'freight'),
      (20,19,'freight'),
      (4,26,'spur'),
      (3,26,'spur'),
      (3,27,'spur'),
      (7,26,'spur'),
      (7,27,'spur'),
      (13,24,'spur'),
      (9,3,'spur'),
      (9,4,'spur'),
      (9,5,'spur'),
      (8,3,'spur'),
      (8,4,'spur'),
      (22,5,'spur'),
      (22,4,'spur'),
      (9,23,'spur')
     ) AS s(trow, tcol, kind)
  LOOP
    r_uuid := noxia_tharsis_uuid('road:'||seed.trow||':'||seed.tcol);

    -- Kollisionsschutz wie in Abschnitt 6: Fahrwege sind entity_type='building'
    -- und unterliegen damit denselben Unique-Indexes. Fremd belegte Zellen
    -- (PLAYER-Eigentum oder laufender Staatsservice) werden nie überschrieben.
    IF EXISTS (
      SELECT 1 FROM tile_entities
       WHERE location_id = mars_id
         AND tile_level = 0
         AND tile_row = seed.trow
         AND tile_col = seed.tcol
         AND entity_type = 'building'
         AND id <> r_uuid
    ) THEN
      RAISE EXCEPTION
        'Tharsis-Hub-Seed: Fahrweg-Zelle (%,%) ist durch ein fremdes Gebäude belegt (ID %). PLAYER-Eigentum und laufende Staatsservices bleiben unangetastet — bitte Konflikt manuell auflösen oder Seed anpassen.',
        seed.trow, seed.tcol, r_uuid;
    END IF;

    INSERT INTO tile_entities
      (id, profile_id, location_id, tile_level, tile_row, tile_col,
       entity_type, entity_id, owner_class, owner_id, is_state_owned, built_at)
    VALUES
      (r_uuid, NULL, mars_id, 0, seed.trow, seed.tcol,
       'building', 'road', 'STATE', NULL, true, now())
    ON CONFLICT (id) DO UPDATE SET
      tile_row      = EXCLUDED.tile_row,
      tile_col      = EXCLUDED.tile_col,
      owner_class   = 'STATE',
      is_state_owned= true,
      profile_id    = NULL;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 9. Mediennetz — Utility Ring A / B, physisch getrennt
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS location_utilities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  ring               text NOT NULL CHECK (ring IN ('A','B')),
  media              text[] NOT NULL DEFAULT '{}',
  node_row           smallint NOT NULL,
  node_col           smallint NOT NULL,
  attaches_entity_id uuid REFERENCES tile_entities(id) ON DELETE SET NULL,
  owner_class        text NOT NULL DEFAULT 'STATE',
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_utilities_ring
  ON location_utilities (location_id, ring);
CREATE INDEX IF NOT EXISTS idx_location_utilities_attaches
  ON location_utilities (attaches_entity_id)
  WHERE attaches_entity_id IS NOT NULL;

ALTER TABLE location_utilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_utilities_select" ON location_utilities;
CREATE POLICY "location_utilities_select"
  ON location_utilities FOR SELECT USING (true);

DROP POLICY IF EXISTS "location_utilities_service" ON location_utilities;
CREATE POLICY "location_utilities_service"
  ON location_utilities FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON location_utilities TO authenticated;
GRANT ALL    ON location_utilities TO service_role;

-- 9a. Ring-Backbones (Knoten mit Medienbelegung des jeweiligen Rings)
DELETE FROM location_utilities
WHERE location_id = (SELECT id FROM locations WHERE slug='mars')
  AND attaches_entity_id IS NULL;

INSERT INTO location_utilities (location_id, ring, media, node_row, node_col)
SELECT (SELECT id FROM locations WHERE slug='mars'), 'A',
       ARRAY['power','data','water','o2','gas'], r, c
FROM (VALUES
      ('A',11,10),
      ('A',11,11),
      ('A',11,12),
      ('A',11,13),
      ('A',11,14),
      ('A',11,15),
      ('A',11,16),
      ('A',11,17),
      ('A',11,18),
      ('A',11,19),
      ('A',12,19),
      ('A',13,20),
      ('A',14,20),
      ('A',15,20),
      ('A',16,20),
      ('A',18,20),
      ('A',19,20),
      ('A',20,21),
      ('A',20,22),
      ('A',20,23),
      ('A',20,24),
      ('A',20,25),
      ('A',20,26),
      ('A',19,26),
      ('A',18,26),
      ('A',17,26),
      ('A',16,26),
      ('A',15,26),
      ('A',14,26),
      ('A',12,26),
      ('A',12,25),
      ('A',12,24),
      ('A',12,22),
      ('A',12,21),
      ('A',19,9),
      ('A',20,8),
      ('A',20,5),
      ('A',20,4),
      ('A',20,3),
      ('A',20,2),
      ('A',11,9),
      ('A',10,8),
      ('A',9,8),
      ('A',8,7),
      ('A',7,6),
      ('A',6,5),
      ('A',5,4),
      ('A',4,3),
      ('A',3,3),
      ('A',2,3),
      ('A',10,24),
      ('A',9,25),
      ('A',8,25),
      ('A',8,26),
      ('A',5,25),
      ('A',4,25),
      ('A',3,25),
      ('A',2,26),
      ('A',2,27)
     ) AS s(label, r, c);

INSERT INTO location_utilities (location_id, ring, media, node_row, node_col)
SELECT (SELECT id FROM locations WHERE slug='mars'), 'B',
       ARRAY['power','data','water','o2','wastewater','thermal'], r, c
FROM (VALUES
      ('B',13,8),
      ('B',14,8),
      ('B',15,8),
      ('B',16,8),
      ('B',17,8),
      ('B',12,8),
      ('B',12,7),
      ('B',12,6),
      ('B',13,6),
      ('B',14,6),
      ('B',15,6),
      ('B',16,6),
      ('B',17,6),
      ('B',18,6),
      ('B',19,5),
      ('B',19,6),
      ('B',19,7),
      ('B',11,6),
      ('B',10,6),
      ('B',9,7),
      ('B',8,6),
      ('B',7,5),
      ('B',6,4),
      ('B',5,3),
      ('B',4,1),
      ('B',3,1),
      ('B',2,1),
      ('B',10,25),
      ('B',9,26),
      ('B',8,27),
      ('B',6,28),
      ('B',5,28),
      ('B',4,28),
      ('B',4,29),
      ('B',3,29),
      ('B',18,22),
      ('B',19,22),
      ('B',21,23),
      ('B',21,24),
      ('B',21,25),
      ('B',21,26)
     ) AS s(label, r, c);

-- 9b. Doppelte Medienanbindung: jeder Habitatcluster und jede kritische
--     Anlage erhält einen Versorgungspfad über Ring A und einen über Ring B.
DELETE FROM location_utilities
WHERE location_id = (SELECT id FROM locations WHERE slug='mars')
  AND attaches_entity_id IS NOT NULL;

INSERT INTO location_utilities
  (location_id, ring, media, node_row, node_col, attaches_entity_id)
SELECT (SELECT id FROM locations WHERE slug='mars'), l.ring,
       CASE WHEN l.ring='A' THEN ARRAY['power','data','water','o2','gas']
            ELSE ARRAY['power','data','water','o2','wastewater','thermal'] END,
       l.nrow, l.ncol,
       noxia_tharsis_uuid('building:'||l.object_id)
FROM (VALUES
      ('habitat_cluster_1','A',11,13),
      ('habitat_cluster_1','B',13,8),
      ('habitat_cluster_2','A',11,14),
      ('habitat_cluster_2','B',14,8),
      ('habitat_cluster_3','A',11,15),
      ('habitat_cluster_3','B',15,8),
      ('habitat_cluster_4','A',11,13),
      ('habitat_cluster_4','B',16,8),
      ('habitat_cluster_5','A',11,14),
      ('habitat_cluster_5','B',17,8),
      ('habitat_cluster_6','A',11,15),
      ('habitat_cluster_6','B',18,6),
      ('eclss_hub_1','A',11,12),
      ('eclss_hub_1','B',13,8),
      ('eclss_hub_2','A',11,16),
      ('eclss_hub_2','B',15,8),
      ('eclss_hub_3','A',11,14),
      ('eclss_hub_3','B',17,8),
      ('medical_core','A',11,16),
      ('medical_core','B',14,8),
      ('medical_annex','A',11,16),
      ('medical_annex','B',15,8),
      ('command_node_1','A',11,17),
      ('command_node_1','B',14,8),
      ('command_node_2','A',11,15),
      ('command_node_2','B',17,8),
      ('workshop_clean','A',11,12),
      ('workshop_clean','B',13,8),
      ('workshop_heavy','A',11,10),
      ('workshop_heavy','B',14,8),
      ('reserve_depot_1','A',11,11),
      ('reserve_depot_1','B',14,8),
      ('reserve_depot_2','A',11,11),
      ('reserve_depot_2','B',15,8),
      ('reserve_depot_3','A',11,16),
      ('reserve_depot_3','B',16,8),
      ('plant_module','A',11,14),
      ('plant_module','B',16,8),
      ('logistics_hub','A',11,10),
      ('logistics_hub','B',13,8),
      ('material_complex_1','A',11,10),
      ('material_complex_1','B',15,8),
      ('material_complex_2','A',11,10),
      ('material_complex_2','B',16,8),
      ('water_isru_1','A',19,9),
      ('water_isru_1','B',19,6),
      ('water_isru_2','A',20,5),
      ('water_isru_2','B',19,6),
      ('water_isru_3','A',20,3),
      ('water_isru_3','B',19,5),
      ('reactor_module_1','A',5,25),
      ('reactor_module_1','B',5,28),
      ('reactor_module_2','A',4,25),
      ('reactor_module_2','B',4,28),
      ('black_start_1','A',5,25),
      ('black_start_1','B',6,28),
      ('reactor_module_3','A',5,4),
      ('reactor_module_3','B',4,1),
      ('reactor_module_4','A',6,5),
      ('reactor_module_4','B',5,3),
      ('black_start_2','A',6,5),
      ('black_start_2','B',5,3),
      ('reactor_module_5','A',20,26),
      ('reactor_module_5','B',21,26),
      ('reactor_module_6','A',20,26),
      ('reactor_module_6','B',21,26),
      ('black_start_3','A',20,25),
      ('black_start_3','B',21,26),
      ('radiator_field_1','A',2,27),
      ('radiator_field_1','B',3,29),
      ('radiator_field_2','A',8,26),
      ('radiator_field_2','B',6,28),
      ('radiator_field_3','A',12,26),
      ('radiator_field_3','B',10,25),
      ('radiator_field_4','A',9,8),
      ('radiator_field_4','B',8,6),
      ('radiator_field_5','A',20,26),
      ('radiator_field_5','B',21,26),
      ('surface_relay_1','A',9,25),
      ('surface_relay_1','B',9,26),
      ('surface_relay_2','A',12,25),
      ('surface_relay_2','B',10,25),
      ('surface_relay_3','A',18,26),
      ('surface_relay_3','B',18,22),
      ('longrange_comms_1','A',2,27),
      ('longrange_comms_1','B',3,29),
      ('longrange_comms_2','A',20,3),
      ('longrange_comms_2','B',19,5),
      ('landing_pad','A',20,21),
      ('landing_pad','B',19,22)
     ) AS l(object_id, ring, nrow, ncol);

-- ══════════════════════════════════════════════════════════════
-- 10. Personen-Zuordnungen auf die neuen Seed-Objekte umhängen
--     (Löschungen aus Abschnitt 3 setzen tile_entity_id auf NULL)
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  mars_id   uuid;
  home_id   uuid;
  work_id   uuid;
BEGIN
  SELECT id INTO mars_id FROM locations WHERE slug='mars' LIMIT 1;
  IF mars_id IS NULL THEN RETURN; END IF;

  SELECT id INTO home_id FROM tile_entities
   WHERE location_id=mars_id AND entity_type='building' AND entity_id='habitat_cluster'
   ORDER BY id LIMIT 1;

  SELECT id INTO work_id FROM tile_entities
   WHERE location_id=mars_id AND entity_type='building' AND entity_id IN ('logistics_hub','workshop_clean')
   ORDER BY CASE entity_id WHEN 'logistics_hub' THEN 0 ELSE 1 END LIMIT 1;

  IF home_id IS NOT NULL THEN
    UPDATE person_assignments SET tile_entity_id = home_id
     WHERE location_id = mars_id AND assignment_type='home' AND tile_entity_id IS NULL;
  END IF;
  IF work_id IS NOT NULL THEN
    UPDATE person_assignments SET tile_entity_id = work_id
     WHERE location_id = mars_id AND assignment_type='work' AND tile_entity_id IS NULL;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.noxia_tharsis_uuid(text);

-- ══════════════════════════════════════════════════════════════
-- 11. Kontrolle
-- ══════════════════════════════════════════════════════════════

SELECT slug, population, population_max, base_population_max, is_supplied
FROM locations WHERE slug='mars';

SELECT entity_id, count(*) AS anzahl
FROM tile_entities
WHERE location_id = (SELECT id FROM locations WHERE slug='mars')
  AND owner_class = 'STATE'
  AND entity_type IN ('building','vehicle')
GROUP BY entity_id
ORDER BY anzahl DESC;

SELECT ring, count(*) AS knoten, count(attaches_entity_id) AS anbindungen
FROM location_utilities
WHERE location_id = (SELECT id FROM locations WHERE slug='mars')
GROUP BY ring;
