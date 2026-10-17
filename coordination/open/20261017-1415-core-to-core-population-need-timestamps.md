---
title: "Population-Tick: Bedürfnis-Zeitstempel nur bei echter Änderung aktualisieren"
source_area: core
target_area: core
status: open
priority: normal
created: 2026-10-17
claimed_by: null
depends_on: []
touches: []
input_sha: null            # beim Übernehmen auf aktuellen main setzen (Stand bei Anlage: 58af37ba)
write_scope:
  - lib/game/population/engine.ts
  - lib/game/population/tick.ts
  - lib/game/population/tickIntent.test.ts
read_scope:
  - Branch perf/person-needs-change-only-20261009
risk_class: code
max_commits: 5
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

Im Population-Tick `satisfaction` und `updated_tick` nur schreiben, wenn sich die Zufriedenheit tatsächlich ändert. Danach messen, ob dadurch Upserts entfallen.

## Kontext

Ressourcenschonung: unveränderte Bedürfnisse erzeugen heute bei jedem Tick neue Zeilen-Updates. Ursprünglich #471 (09.10., 288 Commits hinter main).

Herkunft: #471, geschlossen am 2026-10-17 bei der PR-Sichtung (zu weit hinter `main`). Der Code im Branch dient als Ausgangspunkt, wird aber auf aktuellem `main` neu aufgebaut, nicht rebased.

## Abgrenzung

Nur der beschriebene Umfang. Neue Ideen als eigener Auftrag.

## Arbeitsweise

- Vor jedem Push betroffene Test-Scripts lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei `max_commits` oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Unveränderte Bedürfnisse erzeugen keine Upsert-Zeile
- [ ] Anzahl Upserts pro Tick vorher/nachher gemessen und eingetragen
- [ ] Population-Workflows grün
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration:
- Deployment:
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
