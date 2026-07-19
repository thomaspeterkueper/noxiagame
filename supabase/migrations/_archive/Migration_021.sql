-- Migration 021: Staatliche Werften auf Erde + Mond
-- Stand: 21.06.2026
--
-- Werft (shipyard) als staatliches Startgebäude auf Industrie-Stationen.
-- Nur Erde + Mond zu Beginn — Mars/Phobos haben keine Werft.
-- Spieler können Werften überall bauen sobald Voraussetzungen erfüllt.
--
-- Bestehende Belegung:
--   Erde: (3,4) landing_pad · (3,5) admin · (3,6) school · (2,5) warehouse
--   Mond: (3,4) landing_pad · (3,5) admin
--
-- Werft-Position:
--   Erde: (3,3) — links vom Landeplatz, logisch (Werft → Landeplatz → Abflug)
--   Mond: (3,6) — rechts von Admin (Mond hat Platz)

INSERT INTO tile_entities
  (profile_id, location_id, tile_level, tile_row, tile_col,
   entity_type, entity_id, is_state_owned, built_at)
SELECT
  NULL, l.id, 0, s.row, s.col, 'building', 'shipyard', true, now()
FROM locations l,
(VALUES
  ('earth', 3, 3),
  ('moon',  3, 6)
) AS s(slug, row, col)
WHERE l.slug = s.slug
AND NOT EXISTS (
  SELECT 1 FROM tile_entities t
  WHERE t.location_id = l.id
    AND t.tile_level  = 0
    AND t.tile_row    = s.row
    AND t.tile_col    = s.col
    AND t.entity_type = 'building'
);

-- Kontrolle: alle staatlichen Gebäude
SELECT l.slug, te.entity_id, te.tile_row, te.tile_col, te.is_state_owned
FROM tile_entities te
JOIN locations l ON l.id = te.location_id
WHERE te.is_state_owned = true
ORDER BY l.slug, te.tile_row, te.tile_col;
