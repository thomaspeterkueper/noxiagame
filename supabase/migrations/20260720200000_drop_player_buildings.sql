-- supabase/migrations/20260720200000_drop_player_buildings.sql
-- player_buildings ist deprecated seit Migration 002 (tile_entities)
-- Backup-Phase beendet — tile_entities ist verifiziert stabil
-- Erstellt: 20.07.2026

SET search_path TO public;

-- Erst prüfen ob noch Daten vorhanden
-- SELECT count(*) FROM player_buildings;
-- Wenn 0 → DROP

DROP TABLE IF EXISTS player_buildings CASCADE;

-- Kontrolle
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'player_buildings' AND table_schema = 'public'
) AS table_exists;
