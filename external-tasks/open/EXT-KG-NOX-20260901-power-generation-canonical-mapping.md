---
id: EXT-KG-NOX-20260901-POWER-GENERATION-MAPPING
title: NOXIA power-generation Unlock auf KG/SSF-Vertrag ausrichten
status: open
source: KG
target: NOXIA
created: 2026-09-01
priority: high
affects: [KG, SSF, NOXIA]
---

## Anlass

Die In-Game-Akademie zeigt für `UNL:NOX:power-generation` derzeit „Für diese Voraussetzung wurde noch kein SSF-Lernmodul gefunden.“ Der Resolver sucht das Unlock in den von SSF gelieferten Modulen; diese Architektur ist korrekt, aber bisher fehlt der kanonisch zugeordnete SSF-Export.

## Kanonischer Vertrag

KG: `exports/energy-power-generation-0.1.json`, commit `1c146b8d2ecaea7df96f5740b41177e8636de26b`.

Mapping:
- NOXIA-local: `UNL:NOX:power-generation`
- KnowledgeDomain: `KD:ENG-POWER-GENERATION:N2`
- LearningModule: `ENG-L1-000001`
- KXF/Consumer-ID: `LRN:SSF:ENG-POWER-GENERATION-0001`

## NOXIA-Aufgabe

1. `UNL:NOX:power-generation` als lokale Unlock-ID beibehalten; keine alternative `KD:*`- oder LearningModule-ID erzeugen.
2. Nach Bereitstellung des SSF-Moduls prüfen, dass `/api/ssf/modules` bzw. der bestehende Resolver das Unlock exakt auf `ENG-L1-000001` auflöst.
3. Die Fehleransicht darf nur noch erscheinen, wenn SSF tatsächlich kein passendes Modul liefert bzw. nicht erreichbar ist.
4. Integrationstest für Unlock → SSF-Modul ergänzen, soweit im bestehenden Testaufbau vorgesehen.
5. Request erst nach erfolgreichem End-to-End-Test nach `done/` verschieben.

Keine direkte KG-Änderung an NOXIA-Runtime-Code: NOXIA bleibt Source of Truth für Unlock-Verhalten und Spielintegration.
