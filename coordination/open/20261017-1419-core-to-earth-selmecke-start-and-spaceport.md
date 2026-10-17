---
title: "Earth-Start Selmecke: zivile Gebäude und kompakter Shuttleport im Sauerland-Szenario"
source_area: core
target_area: earth
status: open
priority: normal
created: 2026-10-17
claimed_by: null
depends_on: []
touches: []
input_sha: null            # beim Übernehmen auf aktuellen main setzen (Stand bei Anlage: 58af37ba)
write_scope:
  - lib/game/buildings/index.ts
  - lib/game/buildings/visuals.ts
  - app/api/game/build/spatial/route.ts
  - lib/world/spatial/sauerland2086Scenario.ts
  - public/assets/buildings/
read_scope:
  - Branch feat/earth-playability-catalog-v2
  - Branch feat/sauerland-spaceport-operating-concept-v2
risk_class: code
max_commits: 10
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

Auf der Erde zuerst zivile Gebäude anbieten (`apartment_house`, `community_center`, `local_workshop`, `mobility_hub`) statt des Kolonie-Katalogs. Im Sauerland-2086-Szenario den Shuttleport festlegen: unterirdische Schnellbahn Selmecke–Raumhafen, höchstens zwei Startplätze, Vorrang für Vorfeld, Wartung und Logistik.

## Kontext

Zusammengefasst aus #314 (27.09.) und #281 (24.09.). Die Erdkarte wurde seitdem stark umgebaut (World-Lab, PixiJS); Gebäude- und Bildstil gegen den aktuellen Stand prüfen.

Herkunft: #314, #281, geschlossen am 2026-10-17 bei der PR-Sichtung (zu weit hinter `main`). Der Code im Branch dient als Ausgangspunkt, wird aber auf aktuellem `main` neu aufgebaut, nicht rebased.

## Abgrenzung

Nur der beschriebene Umfang. Neue Ideen als eigener Auftrag.

## Arbeitsweise

- Vor jedem Push betroffene Test-Scripts lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei `max_commits` oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Erster Bauvorschlag auf der Erde ist zivil
- [ ] Szenario-Annahmen dokumentiert und getestet
- [ ] Earth- und Spatial-Workflows grün
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration:
- Deployment:
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
