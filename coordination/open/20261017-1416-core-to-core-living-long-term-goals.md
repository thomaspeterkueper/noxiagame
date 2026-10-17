---
title: "Living Population: langfristige Ziele aus sozialem Gedächtnis ableiten"
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
  - lib/game/personSocialMemory.ts
  - lib/game/personSocialMemory.test.ts
  - lib/game/personSocialMemoryPersistence.ts
  - lib/game/population/decision.ts
read_scope:
  - Branch feature/living-emergent-goals-v1
risk_class: migration
max_commits: 12
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

Deterministische Schleife Erfahrung → Ziel → Entscheidung: wiederholte positive Erinnerungen → `strengthen_social_bonds`, Konflikte → `repair_social_trust`, Krisen → `increase_resilience`; begrenzt und nachvollziehbar.

## Kontext

Passt zu Reibung, Bewegung und verblassenden Beziehungen in der Kolonie. Ursprünglich #316 (27.09., 805 Commits hinter main); der Branch enthält eine Migration `20260927_living_emergent_goal_guard.sql`.

Herkunft: #316, geschlossen am 2026-10-17 bei der PR-Sichtung (zu weit hinter `main`). Der Code im Branch dient als Ausgangspunkt, wird aber auf aktuellem `main` neu aufgebaut, nicht rebased.

## Abgrenzung

Nur der beschriebene Umfang. Neue Ideen als eigener Auftrag.

## Arbeitsweise

- Vor jedem Push betroffene Test-Scripts lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei `max_commits` oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Zielableitung rein, deterministisch, mit Schwellen und Obergrenze
- [ ] Migration als eigenes, geprüftes Artefakt, nicht in Produktion angewendet
- [ ] Population-Workflows grün
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration:
- Deployment:
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
