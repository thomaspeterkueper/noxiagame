---
title: "Autonome Personen-Schleife auf dem Population-Pfad"
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
  - lib/game/population/autonomousActor.ts (neu)
  - lib/game/population/autonomousActor.test.ts (neu)
  - package.json
read_scope:
  - Branch feat/autonomous-actor-observer-loop-20260919
risk_class: code
max_commits: 6
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

Kleine Schleife für autonome Personen über `runPopulationTick` und die bestehende Kette Person → Entscheidung → ActionIntent, ohne neue Identitäten, Rechte oder Schreibbefugnisse.

## Kontext

Nicht zu verwechseln mit dem Spiel-Tester in `lib/tester/`. Ursprünglich #215 (19.09.). Vorher prüfen, ob die Habit- und Kognitionsschichten seither Teile davon abdecken.

Herkunft: #215, geschlossen am 2026-10-17 bei der PR-Sichtung (zu weit hinter `main`). Der Code im Branch dient als Ausgangspunkt, wird aber auf aktuellem `main` neu aufgebaut, nicht rebased.

## Abgrenzung

Nur der beschriebene Umfang. Neue Ideen als eigener Auftrag.

## Arbeitsweise

- Vor jedem Push betroffene Test-Scripts lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei `max_commits` oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Keine neue Identität, kein Sonderweg für NPCs (NPCs sind Spieler)
- [ ] Test grün
- [ ] Abgrenzung zu `lib/tester/` dokumentiert
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration:
- Deployment:
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
