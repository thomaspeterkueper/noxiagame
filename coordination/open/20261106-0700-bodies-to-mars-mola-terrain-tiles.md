---
title: "MOLA-Höhen je Kachel für die neue Marskarte"
source_area: bodies
target_area: mars
status: open
priority: normal
created: 2026-11-06
claimed_by: null
depends_on: []
touches: [lib/worldlab/bodyTiles.ts, app/world-lab/BodyWorld.tsx]
input_sha: 2cbf7976abb876d1297e91c6270aa9e14d6f91a7
write_scope: [lib/game/spatial/, app/api/world-lab/body/]
read_scope: [lib/worldlab/terrain.ts, lib/worldlab/bodyProjection.ts, lib/game/spatial/molaTerrainAdapter.ts, lib/game/spatial/marsTerrainRuntime.ts]
risk_class: code
max_commits: 8
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Migration in Produktion anwenden
---

# Auftrag

Für die neue Weltkarte auf dem Mars (`docs/workstreams/world-map-bodies.md`) je Kachel Eckhöhen liefern – Form wie auf der Erde (`TileTerrainPart` in `lib/worldlab/terrain.ts`: 9 × 9 Punkte je Kachel), damit dieselbe Hangschattierung und dieselben Höhenlinien gezeichnet werden.

## Kontext

Die Erde zeigt Gelände seit 05.11.2026 (`NOXIA-WORLD-0004`, Schritt 4). Die neue Marskarte ist bisher flach. Es gibt MOLA-Adapter (`molaTerrainAdapter.ts`), aber in `terrain_tiles` sind nur 3 Kacheln `ready` (Stand 06.11.2026).

## Abgrenzung

- Kachelraster: `bodyProjection(PLANETARY_REFERENCES.mars.equatorialRadiusM)`, Stufe 17 (≈ 158 m bei Tharsis).
- Zeichnen bleibt beim Teilprojekt „Weltkarte jenseits der Erde“; hier nur Daten und Abruf (z. B. `GET /api/world-lab/body/terrain?location=mars&x=…&y=…`).
- Höhenbezug MOLA/GMM-2B-Areoid wie in `world_frames.derived_config`.

## Akzeptanzkriterien

- [ ] Eckhöhen für die Kacheln um Tharsis Hub (mindestens 7 × 7) abrufbar, mit Quelle und Lizenzvermerk.
- [ ] Tests für Umrechnung Kachelecke → MOLA-Rasterpunkt.
- [ ] Ergebnis hier und in `docs/workstreams/world-map-bodies.md` eingetragen.

## Ergebnis / Nachweis
