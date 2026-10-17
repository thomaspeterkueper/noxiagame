---
title: "Phase-1-Pilot: Traum-Episoden nach dem Schlaf persistieren und selektiv nachwirken lassen"
source_area: core
target_area: core
status: open
priority: high
created: 2026-10-17
claimed_by: null
depends_on:
  - "PR #496 gemergt (Squash) gemäß external-tasks/open/NOXIA-REQ-20261017-dream-consolidation-abschluss-496.md"
touches:
  - lib/game/cognition/
input_sha: null            # beim Übernehmen auf den Squash-SHA von #496 auf main setzen
write_scope:
  - lib/game/cognition/dreamPersistence.ts          # neu
  - lib/game/cognition/dreamPersistence.test.ts     # neu
  - lib/game/cognition/personEpistemicPersistence.ts # nur Anbindung an sleepConsolidationRows
  - lib/game/cognition/personEpistemicSleep.test.ts
  - package.json                                    # nur Script test:dreams erweitern
read_scope:
  - lib/game/cognition/dreamRecombination.ts
  - lib/game/knowledge/dream*.ts
  - lib/game/cognition/npcRelationalMemory.ts
  - lib/game/cognition/personEpistemicPersistence.ts
  - external-tasks/open/NOXIA-REQ-20261016-dream-memory-external-knowledge.md
risk_class: code
max_commits: 15
excluded_actions:
  - Datenbank-Migration anlegen oder anwenden (falls nötig: eigener Auftrag mit risk_class migration)
  - Schreibzugriff auf Produktion
  - Feature-Flag standardmäßig einschalten
  - Live-Webabrufe oder wiederkehrende Hintergrundjobs
  - Änderungen außerhalb write_scope
---

# Auftrag

Schritt 5 aus `external-tasks/open/NOXIA-REQ-20261016-dream-model-consolidation.md` umsetzen: Eine Traum-Episode überdauert die Nacht, nur ein Teil wird erinnert, und erinnerte Träume verschieben in einem späteren Tick begrenzt eine Interessens- oder Handlungsgewichtung.

Erster Auftrag nach dem erweiterten Aufgabenvertrag (Phase 1 von NOXIA-AGENT-INFRA-0001).

## Kontext

Bisher sind alle Traumstufen rein und flüchtig. Der bestehende Schlafpfad (`sleepConsolidationRows` in `personEpistemicPersistence.ts`) konsolidiert Beobachtungsspuren schlafender Personen mit Retention. Träume sollen dort andocken, statt einen eigenen Speicherweg aufzubauen.

## Abgrenzung

- Keine neue Tabelle und keine Migration in diesem Auftrag. Zunächst als reine Projektion (Zeilen, die ein späterer Persistenzschritt schreiben kann), analog zu `sleepConsolidationRows`.
- Keine neuen Stufen nach der Population-Bridge.
- Traum-Inhalte werden nie zu verifiziertem Weltwissen (`canonical: false` bleibt erhalten).

## Arbeitsweise

- Vor jedem Push `pnpm run test:dreams`, `pnpm run test:dream-recombination` und die Sleep-Tests lokal ausführen.
- Ein Commit pro fachlichem Schritt, Tests im selben Commit.
- Bei 15 Commits oder Umfangsänderung: anhalten, `status: blocked`, neu planen.
- Merge per Squash.

## Akzeptanzkriterien

- [ ] `dreamRecallRows(...)` (o. ä.) projiziert Traum-Episoden schlafender Personen in Zeilen mit `npc_id`, `dream_id`, `motifs`, `source_ids`, `recalled`, `retention`, `created_tick`; deterministisch.
- [ ] Erinnerung ist eine NPC-Eigenschaft (z. B. `dreamRecall` 0..1) und wird deterministisch über den vorhandenen Hash entschieden; mit `dreamRecall = 0` wird nie erinnert, mit 1 immer.
- [ ] Nur erinnerte Träume erzeugen eine begrenzte Gewichtsverschiebung (Obergrenze dokumentiert, z. B. ≤ 0,1) für ein Interesse oder einen Handlungsimpuls in einem späteren Tick; nicht erinnerte erzeugen keine.
- [ ] Die Wirkung klingt über die Retention ab; nach Ablauf keine Wirkung mehr.
- [ ] Keine Quelltexte in persistierten Zeilen, nur Motivschlüssel und `source_ids`.
- [ ] Feature-Flag standardmäßig aus; ohne Flag entstehen keine Zeilen.
- [ ] Nur Dateien aus `write_scope` geändert; alle betroffenen Workflows grün.

## Ergebnis / Nachweis

- Commit/PR (Squash-SHA):
- Tests: Befehl, Workflow-Run-IDs, SHA, Ergebnis, Zeitpunkt
- Migration: keine (ausgeschlossen)
- Deployment: keins
- Aufwand: Anzahl Commits, CI-Runs, Preview-Deployments – Vergleich mit #496 (51 Commits, 322 CI-Runs)
- Hinweise für den Quellbereich:

## Blocker / Entscheidung

–
