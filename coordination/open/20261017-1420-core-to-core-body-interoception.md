---
title: "Körperkern, Regulation und Interozeption zusammenführen (#481 plus #455)"
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
  - lib/game/cognition/personBody*.ts
  - lib/game/cognition/personRegulation*.ts
  - lib/game/cognition/affectiveInteroception*.ts
  - .github/workflows/npc-body.yml
  - package.json
read_scope:
  - Branch feat/affective-interoception-v01
  - Branch claude/person-body-from-459
risk_class: code
max_commits: 12
excluded_actions:
  - direkter Push auf main ohne Freigabe
  - Schreibzugriff auf Produktion
  - Migration in Produktion anwenden
---

# Auftrag

#481 auf aktuellen main bringen und die 9 fehlschlagenden Checks beheben. Die Brücke Körper → Interozeption → Affekt aus #455 darin aufnehmen, abgeglichen mit dem vorhandenen `personAffect.ts`.

## Kontext

#455 (07.10.) und #481 (14.10.) behandeln dasselbe Thema. #481 ist der aktuellere Stand und bleibt offen; #455 wird zugunsten dieses Auftrags geschlossen. Migration `person_body` aus #481 ist nicht eingespielt.

Herkunft: #455 (geschlossen am 2026-10-17, zu weit hinter `main`) und #481 (bleibt offen, nur 24 Commits hinter `main` – dort rebasen und weiterarbeiten).

## Abgrenzung

Nur der beschriebene Umfang. Neue Ideen als eigener Auftrag.

## Arbeitsweise

- Vor jedem Push betroffene Test-Scripts lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei `max_commits` oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] Kein zweites Affektmodell neben `personAffect.ts`
- [ ] Alle Checks von #481 grün
- [ ] Migration getrennt geprüft, nicht in Produktion angewendet
- [ ] Nur Dateien aus `write_scope` geändert.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration:
- Deployment:
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments


## Update 2026-10-27 — canonical coarse baseline now on main

A new minimal canonical layer now exists on `main`:

- `lib/game/cognition/personInteroception.ts`
- `lib/game/population/interoceptionRuntime.ts`
- `person_regulation_state`
- `docs/decisions/NOXIA-LIVING-0011-interoception-memory-family.md`

This baseline deliberately models **dimensionless regulatory signals**, not literal
hormone concentrations:

- stress axis
- social bonding tone
- reward drive
- arousal

It derives them from already authoritative needs, affect and relationship evidence.

Therefore the older body/interoception branches referenced in this request must **not**
be merged wholesale. They are now candidates for a later, finer-resolution physical
body layer beneath this stable interface. Any salvage must preserve:

1. no dopamine/oxytocin/cortisol = single emotion shortcuts;
2. no body signal may directly create belief, love, consent, partnership or family intent;
3. observer-visible body/affect remains separate from internal state;
4. deeper physiology is activated only where Adaptive Detail Resolution warrants it.

The earlier note that no canonical interoception baseline existed is superseded by this
section. A full `person_body` layer is still not live.
