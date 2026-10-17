---
title: "Zwei seit Wochen rote Tests auf main reparieren (Colony run, Observation development)"
source_area: qa
target_area: core
status: open
priority: normal
created: 2026-10-17
claimed_by: null
depends_on: []
touches:
  - lib/game/population/
  - lib/game/
input_sha: 46b339ab
write_scope:
  - lib/game/population/socialDynamics.ts
  - lib/game/population/socialDynamics.test.ts
  - lib/game/prospectingResearchQuestions.ts
  - lib/game/prospectingResearchQuestions.test.ts
read_scope:
  - .github/workflows/colony-run.yml
  - .github/workflows/observation-development.yml
  - lib/game/population/
risk_class: code
max_commits: 6
excluded_actions:
  - Tests abschwächen oder entfernen, nur damit sie grün werden
  - Schreibzugriff auf Produktion
  - Änderungen außerhalb write_scope ohne neue Planung
---

# Auftrag

Zwei Workflows schlagen auf `main` fehl, unabhängig von der CI-Umstellung (#499):

1. **Colony research run** (`colony-run.yml`), Schritt „Friction, variety and relocation" – rot seit 2026-10-13.
   - `FAIL: lasting monotony makes a person move on`
   - `FAIL: people prefer to move near their friends`
2. **Observation development bridge** (`observation-development.yml`), Schritt `prospectingResearchQuestions` – rot seit 2026-09-29.
   - `FAIL development order carries measurable capability targets`

Beide lokal auf unverändertem `main` reproduziert (Node 22, vor #499) und in #499 erneut bestätigt.

## Kontext

Rote Checks auf `main` entwerten jeden späteren grünen PR-Lauf und verdecken neue Fehler. Ursache klären: Ist der Test veraltet (Verhalten bewusst geändert) oder der Code fehlerhaft (Regression)? Bei „Relocation" vermutlich Zusammenhang mit den Umzugs- und Reibungsregeln (Kolonie soll Bewegung zeigen).

## Abgrenzung

Keine fachliche Neugestaltung der Umzugslogik oder der Forschungsreihenfolge. Wenn der Test veraltet ist: Test an das bewusst geänderte Verhalten anpassen und die Entscheidung im Commit begründen.

## Arbeitsweise

- Vor jedem Push die beiden Workflow-Schritte lokal ausführen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Ursache je Fehler dokumentiert (Regression oder veralteter Test)
- [ ] `colony-run` und `observation-development` auf `main` grün
- [ ] Keine Prüfung entfernt oder abgeschwächt, ohne die fachliche Begründung zu dokumentieren

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration: keine
- Deployment: keins
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments
