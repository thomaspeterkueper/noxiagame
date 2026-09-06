-- 20260906170000_tharsis_hub_seed_review_resolution.sql
-- OTA Seed-Review-Klärung 2026-09-06
--
-- Die historische Start-Seed-Migration 20260830190000 enthielt bereits ein
-- gebautes Pflanzen-/Frischproduktionsmodul. Die fachliche Klärung setzt dieses
-- Objekt jedoch erst für Phase I nach dem Start an. Bereits migrierte Datenbanken
-- werden deshalb vorwärts korrigiert; die historische Migration bleibt unverändert.
--
-- Wichtig:
--   * Nur das deterministische staatliche Seed-Objekt auf (12,16) wird entfernt.
--   * Spieler-/später gebaute Pflanzenmodule bleiben unangetastet.
--   * Die Baukatalogdefinition bleibt aktiv: plant_module ist weiterhin baubar.
--   * Utility-Anbindungen werden vor dem Gebäude entfernt, damit durch
--     ON DELETE SET NULL keine verwaisten scheinbaren Backbone-Zeilen entstehen.

SET search_path TO public;

DO $$
DECLARE
  mars_id uuid;
  plant_id uuid;
BEGIN
  SELECT id INTO mars_id
  FROM locations
  WHERE slug = 'mars'
  LIMIT 1;

  IF mars_id IS NULL THEN
    RAISE NOTICE 'Tharsis seed review resolution skipped: location mars not found';
    RETURN;
  END IF;

  SELECT id INTO plant_id
  FROM tile_entities
  WHERE location_id = mars_id
    AND tile_level = 0
    AND tile_row = 12
    AND tile_col = 16
    AND entity_type = 'building'
    AND entity_id = 'plant_module'
    AND owner_class = 'STATE'
    AND is_state_owned = true
    AND owner_id IS NULL
  LIMIT 1;

  IF plant_id IS NULL THEN
    RAISE NOTICE 'Tharsis seed review resolution: no legacy STATE plant_module at (12,16); nothing to remove';
    RETURN;
  END IF;

  DELETE FROM location_utilities
  WHERE location_id = mars_id
    AND attaches_entity_id = plant_id;

  DELETE FROM tile_entities
  WHERE id = plant_id
    AND location_id = mars_id
    AND entity_type = 'building'
    AND entity_id = 'plant_module'
    AND owner_class = 'STATE'
    AND is_state_owned = true
    AND owner_id IS NULL;
END $$;
