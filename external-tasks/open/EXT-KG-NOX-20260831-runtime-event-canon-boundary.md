---
id: EXT-KG-NOX-20260831-RUNTIME-EVENT-CANON-BOUNDARY
title: NOXIA Runtime-Events klar von KG-kanonischen EVT/STA-Identitäten trennen
status: open
source: KG
target: NOXIA
created: 2026-08-31
requested_by: knowledge-graph-curation
priority: high
affects: [KG, NOXIA]
---

## Anlass

NOXIA hat mit `supabase/migrations/20260831_noxia_events_entity_states.sql` und `20260831164500_wire_builds_entities_to_event_stream.sql` eine sinnvolle authoritative Simulationsspur aus lokalen UUID-Events und temporalen State-Zeilen aufgebaut.

Der Commit `dabdbb032b4ac8ef119e3182796303af80895bf2` bezeichnet diese Ebene jedoch als `canonical events and entity state history`. Das kollidiert terminologisch mit der kanonischen Weltsemantik des KUEPER Knowledge Graph.

KG-0009 definiert kanonische Weltidentitäten:

- `EVT:<LAYER>:<slug>` für Event
- `STA:<OBJECT-ID>:<STATE-SLUG>` für State
- `KNO:*` für KnowledgeAssertion
- `ARCST:*` für StoryArc
- `SCN:*` für Scene

KG-0019 präzisiert nun verbindlich:

```text
Canonical Event/State != Runtime Event/State
```

Lokale UUIDs, `event_type`-Strings und Simulations-State-Zeilen sind NOXIA-eigene Runtime-Projektionen. Sie werden nur durch explizite KG-Promotion und KG-ID-Zuweisung kanonisch.

## Anforderung

Bitte die bestehende NOXIA-Event-/State-Architektur nicht verwerfen. Sie ist als Runtime-/Audit-/Event-Sourcing-Schicht richtig.

Erforderlich ist ausschließlich die Governance- und Mapping-Klarstellung:

1. Bezeichnungen und Kommentare, die lokale UUID-Events pauschal als `canonical` bezeichnen, auf präzise Begriffe wie `authoritative simulation event`, `runtime event`, `runtime entity state`, `event projection` oder `state projection` umstellen.
2. Dokumentieren, dass `public.events.id` und `public.entity_states.id` NOXIA-Runtime-UUIDs sind und keine `EVT:*`-/`STA:*`-IDs ersetzen.
3. Einen migrationssicheren optionalen Mappingpfad vorsehen, sobald tatsächlich KG-kanonische Weltobjekte/-ereignisse angebunden werden. Geeignete Varianten sind nullable Felder oder Mappingtabellen für z. B.:
   - `canonical_entity_id`
   - `canonical_event_id`
   - `canonical_state_id`
4. KG-IDs nur als opaque strings speichern und niemals in NOXIA selbst erfinden.
5. Kurzlebige Spiel-/UI-/Tick-Ereignisse bleiben ausdrücklich Runtime-only und benötigen keine KG-ID.
6. Bestehende Event-Sourcing-Funktionalität, Trigger und UUID-Primärschlüssel dürfen erhalten bleiben.

## Referenzen

- KG: `docs/KG-0009-NARRATIVE-WORLD-MODEL.md`
- KG: `docs/KG-0019-RUNTIME-EVENT-PROJECTIONS.md`
- KG: `exports/entity-types-0.1.json` ab v0.1.3
- KXF: `exports/kxf-0.6.json` ab v0.6.9
- NOXIA: `supabase/migrations/20260831_noxia_events_entity_states.sql`
- NOXIA: `supabase/migrations/20260831164500_wire_builds_entities_to_event_stream.sql`

## Abnahme

Erledigt, wenn:

1. Runtime- und Canon-Semantik terminologisch getrennt sind,
2. lokale UUIDs nicht als KG-kanonische IDs dargestellt werden,
3. ein expliziter optionaler KG-Mappingpfad dokumentiert oder vorbereitet ist,
4. NOXIA weiterhin alleinige Source of Truth für seine Runtime-Simulation bleibt,
5. KG alleinige Source of Truth für systemübergreifende `EVT:*`-/`STA:*`-/`KNO:*`-/`ARCST:*`-/`SCN:*`-Identitäten bleibt.
