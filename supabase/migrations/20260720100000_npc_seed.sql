-- supabase/migrations/20260720100000_npc_seed.sql
-- NPC Phase C: HeliosCorp + Produzenten-NPCs
-- Erstellt: 20.07.2026
--
-- Drei NPCs:
--   HeliosCorp   — Akkumulator (kauft Metall/Energie auf Vorrat)
--   Goibniu Co.  — Produzent (Minen auf Mond, verkauft Metall)
--   Belenus AG   — Produzent (Solar auf Mars, verkauft Energie)
--
-- Prinzip: NPCs sind im gleichen Kausalmodell wie Spieler.
-- HeliosCorp kauft — das treibt Preise. Goibniu produziert — das drückt Metall-Preis.
-- Spieler können das Muster erkennen (Kausalität sichtbar, nie erklärt).

SET search_path TO public;

-- HeliosCorp: Strategischer Rohstoff-Akkumulator
INSERT INTO actors (id, kind, display_name, bio_short, decision_weights)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'corporation',
  'HeliosCorp',
  'Interplanetarer Rohstoffkonzern. Gegründet 2058. Kauft strategische Ressourcen auf Vorrat.',
  '{
    "preferred_goods":  ["metal", "energy"],
    "buy_threshold":    0.7,
    "stockpile_factor": 5,
    "role":             "trader"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  decision_weights = EXCLUDED.decision_weights;

-- Goibniu Co.: Metall-Produzent (Mond)
INSERT INTO actors (id, kind, display_name, bio_short, decision_weights)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'corporation',
  'Goibniu Co.',
  'Bergbauunternehmen. Betreibt Minen auf dem Mond. Hauptlieferant für Metall im inneren System.',
  '{
    "role":          "producer",
    "sells":         ["metal"],
    "sell_floor":    25,
    "reserve":       50,
    "sell_per_tick": 15,
    "expand": {
      "building":     "mine",
      "location":     "moon",
      "cost":         1500,
      "treasury_min": 8000
    }
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  decision_weights = EXCLUDED.decision_weights;

-- Belenus AG: Energie-Produzent (Mars)
INSERT INTO actors (id, kind, display_name, bio_short, decision_weights)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'corporation',
  'Belenus AG',
  'Solarenergie-Konzern. Betreibt Solarfelder auf dem Mars. Versorgt die wachsende Kolonie.',
  '{
    "role":          "producer",
    "sells":         ["energy"],
    "sell_floor":    30,
    "reserve":       40,
    "sell_per_tick": 12,
    "expand": {
      "building":     "solar",
      "location":     "mars",
      "cost":         1200,
      "treasury_min": 6000
    }
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  decision_weights = EXCLUDED.decision_weights;

-- Startkapital (Endowment) — damit NPCs sofort aktiv sind
INSERT INTO npc_ledger (actor_id, tick, kind, credit_delta, note)
SELECT '00000000-0000-0000-0000-000000000001', 0, 'endowment', 50000, 'HeliosCorp Startkapital'
WHERE NOT EXISTS (SELECT 1 FROM npc_ledger WHERE actor_id = '00000000-0000-0000-0000-000000000001' AND kind = 'endowment');

INSERT INTO npc_ledger (actor_id, tick, kind, credit_delta, note)
SELECT '00000000-0000-0000-0000-000000000002', 0, 'endowment', 20000, 'Goibniu Co. Startkapital'
WHERE NOT EXISTS (SELECT 1 FROM npc_ledger WHERE actor_id = '00000000-0000-0000-0000-000000000002' AND kind = 'endowment');

INSERT INTO npc_ledger (actor_id, tick, kind, credit_delta, note)
SELECT '00000000-0000-0000-0000-000000000003', 0, 'endowment', 15000, 'Belenus AG Startkapital'
WHERE NOT EXISTS (SELECT 1 FROM npc_ledger WHERE actor_id = '00000000-0000-0000-0000-000000000003' AND kind = 'endowment');

-- note-Spalte in npc_ledger ergänzen falls nicht vorhanden
ALTER TABLE npc_ledger ADD COLUMN IF NOT EXISTS note text;

-- Kontrolle
SELECT id, display_name, kind FROM actors ORDER BY created_at;
