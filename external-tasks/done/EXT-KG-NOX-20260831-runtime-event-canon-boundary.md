---
id: EXT-KG-NOX-20260831-RUNTIME-EVENT-CANON-BOUNDARY
title: NOXIA Runtime-Events klar von KG-kanonischen EVT/STA-Identitäten trennen
status: done
source: KG
target: NOXIA
created: 2026-08-31
completed: 2026-08-31
requested_by: knowledge-graph-curation
priority: high
affects: [KG, NOXIA]
implementation_commit: 03b1f218915087d59d6bf88d689206060ed68d08
---

## Ergebnis

Die NOXIA-Event-/State-Architektur bleibt als authoritative Runtime-/Audit-/Event-Sourcing-Schicht erhalten. Die Grenze zum KUEPER Knowledge Graph ist nun migrationssicher explizit modelliert.

Umgesetzt mit `supabase/migrations/20260831195000_runtime_canon_projection_boundary.sql`:

- `public.events.id` ist ausdrücklich NOXIA-Runtime-UUID und keine `EVT:*`-Identität.
- `public.entity_states.id` ist ausdrücklich NOXIA-Runtime-UUID und keine `STA:*`-Identität.
- `events` erhält nullable `canonical_entity_id` und `canonical_event_id`.
- `entity_states` erhält nullable `canonical_entity_id` und `canonical_state_id`.
- Canonical IDs werden als opaque `text` gespeichert und ausschließlich als KG-owned Projection Targets dokumentiert.
- Runtime-only UI-/Tick-/Gameplay-Events benötigen weiterhin keine KG-ID.
- Bestehende Trigger, Event-Sourcing-Funktionalität und UUID-Primärschlüssel bleiben unverändert.
- Kommentare der Event-/State-Funktionen stellen klar, dass NOXIA keine KG-`EVT:*`-/`STA:*`-Identitäten erzeugt.
- Für `canonical_state_id` ist die Subject-Konsistenz mit `DESCRIBES_STATE_OF` dokumentiert.
- Cross-System-Relationen und Promotion/Acceptance bleiben KG-owned; NOXIA konsumiert die KG Relation Registry und den Runtime-Projection-Vertrag und erfindet keine parallelen globalen Relationstypen.

## Governance-Grenze

NOXIA bleibt Source of Truth für seine Runtime-Simulation und deren Spielzustände. KG bleibt Source of Truth für systemübergreifende kanonische Identitäten, Promotionen und Cross-System-Mappings. Ein gesetztes `canonical_*`-Feld ist daher eine Projektion auf eine bereits extern zugewiesene KG-Identität, keine lokale Kanonisierung.

## Abnahme

Alle geforderten Punkte sind im NOXIA-eigenen Zuständigkeitsbereich umgesetzt. Die Migration bereitet den optionalen Mappingpfad vor, ohne KG-Inhalte oder KG-Relationen in NOXIA zu duplizieren.