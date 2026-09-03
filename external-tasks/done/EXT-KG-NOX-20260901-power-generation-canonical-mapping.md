---
id: EXT-KG-NOX-20260901-POWER-GENERATION-MAPPING
title: NOXIA power-generation Unlock auf KG/SSF-Vertrag ausrichten
status: done
source: KG
target: NOXIA
created: 2026-09-01
closed: 2026-09-01
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

## Umsetzung (2026-09-01)

Das kanonische SSF-Modul ist im Live-Feed bereitgestellt:

- Feed `https://solarsciencefoundation.vercel.app/api/noxia/modules` (79 Module) enthält genau **ein** Modul mit `unlocks: ["UNL:NOX:power-generation"]`:
  - `id`: `LRN:SSF:ENG-POWER-GENERATION-0001` (KXF/Consumer-ID)
  - `legacyId`: `ENG-L1-000001` (kanonisches LearningModule)
  - `pathId`: `PATH:SSF:NOX-POWER-GENERATION-0001`
  - `domain`: `KD`, Source-Entities inkl. `KD:ENG-POWER-GENERATION:N2`
- Detail-Endpoint für die KXF-ID liefert das vollständige Modul (27 Sections).

NOXIA-Änderungen (Arbeitsbaum, nicht gemergt):

1. `lib/ssfKnowledge.ts`
   - `SsfKnowledgeModule.legacyId` ergänzt und in `normalizeModule()` null-sicher normalisiert.
   - `resolveModuleForUnlock(modules, unlockId)` als geteilter, testbarer Unlock-Resolver (sucht in `module.unlocks[]`, toleriert `{ key, condition }`-Einträge).
   - `unlockLabel()`: typsicher statt `any` (kein Verhaltensunterschied).
2. `app/academy/learn/page.tsx`
   - Nutzt jetzt den geteilten `resolveModuleForUnlock()` statt Inline-Suche. Verhalten unverändert; Fehleransicht erscheint weiterhin nur bei fehlendem Match bzw. nicht erreichbarem SSF.
3. `lib/knowledge/ssfPaths.ts`
   - `MODULE_TO_PATH` um `ENG-L1-000001` und `LRN:SSF:ENG-POWER-GENERATION-0001` → `PATH:SSF:NOX-POWER-GENERATION-0001` ergänzt (Deep-Links aus SchoolOverlay/SsfStatusCard).
4. `lib/ssfKnowledge.test.ts` (neu)
   - Integrationstest Unlock → SSF-Modul im bestehenden Testaufbau (node:assert, tsc-kompiliert wie `lib/game/*.test.ts`): kanonisches Mapping, `{ key, condition }`-Form, Fehleransicht-Vorbedingung (kein Match → `null`), keine Fehlauflösung anderer Unlocks, Registry bleibt NOXIA-lokal (`UNL:NOX:*`).
5. `.github/workflows/ssf-knowledge-domain.yml` (neu)
   - Domain-CI nach Muster `scanner-domain.yml`: kompiliert und führt `lib/ssfKnowledge.test.ts` aus, verifiziert den Build.

## Verifikation

- Domain-Test: `tsc`-Kompilierung + `node` → „alle Assertions bestanden“.
- End-to-End gegen den Live-SSF-Feed mit dem kompilierten Resolver: `UNL:NOX:power-generation` → `LRN:SSF:ENG-POWER-GENERATION-0001` / `legacyId: ENG-L1-000001`, eindeutig (genau 1 Match). **E2E PASS.**
- ESLint auf allen geänderten Dateien sauber.
- `next build`: Kompilierung erfolgreich; der Type-Check bricht weiterhin an zwei **vorbestehenden**, taskfremden Fehlern ab (`lib/world/spatial/elevationSource.ts` fehlender `GeoPoint`-Re-Export, `lib/game/buildings/technicalProvenance.test.ts` importiert nicht installiertes `vitest`). Beide bestehen identisch auf HEAD und gehören anderen Feature-Strängen (earth elevation, OTA provenance); kein Fehler in den von diesem Task geänderten Dateien.
