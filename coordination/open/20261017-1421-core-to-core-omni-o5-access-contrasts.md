---
title: "Forschung: deterministische O5-Zugangskontraste (Wohnung/Arbeit)"
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
  - lib/game/population/accessContrast.test.ts
  - .github/workflows/omni-o5-access.yml
  - package.json
read_scope:
  - Branch research/omni-o5-access-contrast-20261009
risk_class: code
max_commits: 4
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

Isolierte, deterministische Gegenfakten zu Torwächtern bei Wohnung und Arbeit als Test `test:omni-o5-access`. Keine Live-Population, keine Datenbank.

## Kontext

Bezug zur Omnizedenz (Kolonietest O5). Ursprünglich #468 (09.10.); dort 5 fehlschlagende Checks – Ursache klären. Neuer Workflow mit pnpm und Node 24 wie alle anderen.

Herkunft: #468, geschlossen am 2026-10-17 bei der PR-Sichtung (zu weit hinter `main`). Der Code im Branch dient als Ausgangspunkt, wird aber auf aktuellem `main` neu aufgebaut, nicht rebased.

## Abgrenzung

Nur der beschriebene Umfang. Neue Ideen als eigener Auftrag.

## Arbeitsweise

- Vor jedem Push betroffene Test-Scripts lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei `max_commits` oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Test läuft lokal und in CI grün
- [ ] Philosophische Deutung auf das Modellierte begrenzt
- [ ] Workflow nach aktuellem CI-Standard
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration:
- Deployment:
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
