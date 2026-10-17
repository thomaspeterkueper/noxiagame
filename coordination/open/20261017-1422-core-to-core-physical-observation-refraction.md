---
title: "Physikalische Beobachtung v0.1: atmosphärische Refraktion"
source_area: core
target_area: core
status: open
priority: low
created: 2026-10-17
claimed_by: null
depends_on: []
touches: []
input_sha: null            # beim Übernehmen auf aktuellen main setzen (Stand bei Anlage: 58af37ba)
write_scope:
  - lib/game/physics/observation/ (neu)
  - lib/ssfKnowledge.ts
  - package.json
read_scope:
  - Branch feat/physical-observation-refraction-332
risk_class: code
max_commits: 6
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

Eigener Namensraum für physikalische Beobachtung: geometrische Wahrheit getrennt von scheinbarer Beobachtung, deterministische Refraktionsnäherung, ohne Atmosphäre keine Refraktion, Regressionsfälle Erde und Mars.

## Kontext

Erster Codeschritt zu #332. Ursprünglich #334 (28.09.), 3 fehlschlagende Checks.

Herkunft: #334, geschlossen am 2026-10-17 bei der PR-Sichtung (zu weit hinter `main`). Der Code im Branch dient als Ausgangspunkt, wird aber auf aktuellem `main` neu aufgebaut, nicht rebased.

## Abgrenzung

Nur der beschriebene Umfang. Neue Ideen als eigener Auftrag.

## Arbeitsweise

- Vor jedem Push betroffene Test-Scripts lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei `max_commits` oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Nicht mit dem bestehenden Game-Observation-Pfad vermischt
- [ ] Erde- und Mars-Regression grün
- [ ] Modellkennung für Provenienz dokumentiert
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration:
- Deployment:
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
