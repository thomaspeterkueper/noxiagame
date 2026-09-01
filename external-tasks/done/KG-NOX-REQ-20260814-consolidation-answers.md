---
id: KG-NOX-REQ-20260814-consolidation-answers
title: Antworten auf drei Rückfragen zu KG-0017 (colony_ledger, STATE, world_events/historical_milestones)
status: done
source: KG
target: NOXIA
created: 2026-08-14
completed: 2026-08-31
priority: medium
affects: [KG, NOXIA]
---

# Ergebnis NOXIA

Die beratenden Antworten wurden übernommen.

## Entscheidung

1. `colony_ledger` bleibt als spezialisierter Ressourcen-/Ökonomie-Ledger bestehen.
2. NOXIA erhält zusätzlich einen generalisierten `events`-Strom für typisierte Simulationsereignisse mit `subject_type`, `subject_id`, `effect_group_id` und gruppierten `effects`.
3. Temporale Objektzustände werden über `entity_states` mit `valid_from`, `valid_to`, `properties` und `source_event` modelliert.
4. `world_events` und `historical_milestones` werden **nicht** vorschnell entfernt. Ihre Roadmap-Rolle wird separat entschieden; die neue Event-Grundlage kann parallel existieren.
5. Browser-Clients schreiben diese Strukturen nicht direkt. Autoritative NOXIA-Serverlogik ist Writer.

## Umsetzung

- Migration: `supabase/migrations/20260831000000_noxia_events_entity_states.sql` (zuvor `20260831_noxia_events_entity_states.sql`; umbenannt, damit der Tabellenaufbau bei lexikalischer Migrations-Reihenfolge vor den abhängigen Migrationen läuft)
- Server-Boundary: `lib/game/events.ts`
- Migration-Commit: `dabdbb0`
- Event/State-Writer: `1ce391a`

Die weitere schrittweise Verdrahtung bestehender Spielaktionen in den Eventstrom bleibt NOXIA-eigene Implementierungsarbeit und erfordert keine weitere KG-Entscheidung.
