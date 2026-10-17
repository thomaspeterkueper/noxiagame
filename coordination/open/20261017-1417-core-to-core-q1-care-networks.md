---
title: "Q1: plurale Sorgegemeinschaften (WG, Care-Kreise) und Stations-Intelligenz"
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
  - docs/q1-social-fabric-station-ai.md
  - supabase/migrations/ (neue Datei)
read_scope:
  - Branch feature/q1-care-networks-station-ai
risk_class: migration
max_commits: 8
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

Gruppenmitgliedschaften für Wohngemeinschaften, Care-Kreise, Lerngruppen und Projektgruppen modellieren, inklusive ausdrücklicher Sorgeverantwortung ohne Familienannahme; Stations-Intelligenz als institutioneller, nicht-personaler Akteur mit begrenzten Datenrechten.

## Kontext

Erweitert das Zusammenleben über Kernfamilien hinaus. Ursprünglich #375 (03.10., Konzept plus Migration `20261003092000_q1_social_groups_station_ai.sql`).

Herkunft: #375, geschlossen am 2026-10-17 bei der PR-Sichtung (zu weit hinter `main`). Der Code im Branch dient als Ausgangspunkt, wird aber auf aktuellem `main` neu aufgebaut, nicht rebased.

## Abgrenzung

Nur der beschriebene Umfang. Neue Ideen als eigener Auftrag.

## Arbeitsweise

- Vor jedem Push betroffene Test-Scripts lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei `max_commits` oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Konzept gegen aktuelles Personen-/Beziehungsmodell abgeglichen
- [ ] Migration getrennt geprüft, nicht in Produktion angewendet
- [ ] Datenschutz- und Erklärbarkeitsgrenzen der Stations-KI dokumentiert
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration:
- Deployment:
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
