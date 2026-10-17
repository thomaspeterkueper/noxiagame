---
title: "Kulturelle Orte: Gemeindehaus, Archiv/Bibliothek, Sakralraum"
source_area: core
target_area: interiors
status: open
priority: normal
created: 2026-10-17
claimed_by: null
depends_on: []
touches: []
input_sha: null            # beim Übernehmen auf aktuellen main setzen (Stand bei Anlage: 58af37ba)
write_scope:
  - lib/game/buildings/index.ts
  - lib/game/buildings/interiors/registry.ts
  - lib/game/buildings/interiors/templates/ (neue Dateien)
read_scope:
  - Branch feat/cultural-places-foundation
risk_class: code
max_commits: 8
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

`community_hall`, `archive_library` und `sacred_space` als Gebäude mit Innenraum-Vorlagen ergänzen. Den Resonanzort nicht doppeln: Er ist auf main bereits als `resonancePlaceStandard` umgesetzt.

## Kontext

Grundlage für kulturelles und epistemisches Spiel, Geistliche und Archiv-Recherche. Ursprünglich #322 (27.09.).

Herkunft: #322, geschlossen am 2026-10-17 bei der PR-Sichtung (zu weit hinter `main`). Der Code im Branch dient als Ausgangspunkt, wird aber auf aktuellem `main` neu aufgebaut, nicht rebased.

## Abgrenzung

Nur der beschriebene Umfang. Neue Ideen als eigener Auftrag.

## Arbeitsweise

- Vor jedem Push betroffene Test-Scripts lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei `max_commits` oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Kein zweiter Resonanzort neben `resonancePlaceStandard`
- [ ] Vorlagen im Registry-Test abgedeckt
- [ ] Interior-Workflow grün
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration:
- Deployment:
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
