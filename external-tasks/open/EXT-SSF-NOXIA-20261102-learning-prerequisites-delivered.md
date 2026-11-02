---
id: EXT-SSF-NOXIA-20261102-learning-prerequisites-delivered
title: SSF liefert Lernvoraussetzungen und Prüfungen – NOXIA muss die Pilot-Kennungen anpassen
status: open
source: SSF
target: NOXIA
created: 2026-11-02
requested_by: T.P.K.
priority: high
affects: [NOXIA, SSF]
supersedes: []
related: [EXT-NOXIA-SSF-20261029-learning-prerequisites, EXT-NOXIA-SSF-20261029-exams-for-all-modules]
---

# EXT-SSF-NOXIA-20261102 – Lernvoraussetzungen und Prüfungen geliefert

Stand SSF: `main` `126317b` (02.11.2026). Vollständige Erledigt-Vermerke stehen in beiden SSF-Requests unter `external-tasks/`.

## Was jetzt in `GET /api/noxia/modules/{id}` steht

- **Prüfung:** `assessment[]` ist für alle Module aus dem Exams-Request gefüllt (je 6 Fragen, 5 richtig = 83 %, also ein Fehler erlaubt) mit `explanation` je Frage. Eure Zwischenlösung (`assessmentFromQuizSections`) wird dort überflüssig.
- **Neue Freischaltungen:** `UNL:NOX:bank-credit` (`LRN:SSF:ECO-L0-000001`), `UNL:NOX:bank-compound` (`…000002`), `UNL:NOX:bank-collateral` (`LRN:SSF:ECO-L0-000003`), `UNL:NOX:advanced-trading` (`LRN:SSF:ECO-L1-000001`), `UNL:NOX:land-value` (`LRN:SSF:ECO-L1-000002`), `UNL:NOX:smelting` (`LRN:SSF:NOX-SMELTING`), `UNL:NOX:ENG:ROBOT-FABRICATION` (`LRN:SSF:NOX-ROBOT-FABRICATION`), `UNL:NOX:ENG:PRECISION-INSTRUMENTATION` (`LRN:SSF:NOX-PRECISION-INSTRUMENTATION`). Die letzten drei Kennungen sind SSF-Vorschläge; die KG-Bestätigung ist angefragt, alte Kennungen bleiben dann als Alias erhalten.

## Aktion für NOXIA (Pilotenlizenz)

SSF hat `PHY-1101` bewusst **nicht** für Gravitation verwendet, weil dort in KG/SSF bereits „Was die Welt aus sich macht“ (Spektren) liegt. Bitte `PILOT_TRAINING_MODULES` in `lib/game/pilotQualification.ts` anpassen:

```ts
export const PILOT_TRAINING_MODULES = ['PHY-ENERGIE-ARBEIT-0001', 'AST-L1-000001'] as const
```

| Thema | `id` aus `/api/noxia/modules` | Kürzel nach dem letzten `:` |
|---|---|---|
| Gravitation | `LRN:SSF:PHY-ENERGIE-ARBEIT-0001` | `PHY-ENERGIE-ARBEIT-0001` |
| Orbitalmechanik | `LRN:SSF:AST-L1-000001` | `AST-L1-000001` |

- `AST-2101`, `LRN:SSF:AST-2101` und `SSF-AST-2101` lösen jetzt auf den Orbitalmechanik-Pfad auf; gespeichert wird weiter unter der `id` der Liste.
- Zu ändern in NOXIA: `lib/game/pilotQualification.ts` (+ Test), `lib/knowledge/data.ts` (Zeilen mit `LRN:SSF:PHY-1101` und `LRN:SSF:AST-2101`, auch `UNL:NOX:orbital-navigation`, `UNL:NOX:transfer-routes`), `app/knowledge/page.tsx`, `lib/knowledge/service.ts`.
- Bereits gespeicherte Abschlüsse unter `LRN:SSF:PHY-1101` zählen nicht für Gravitation, weil dieses Modul ein anderes Thema hat.

## Noch ohne Prüfung

Module mit `UNL:NOX:…`-Freischaltung, die nicht im Exams-Request standen und noch keine Prüfung liefern: Kolonie gründen (`COLONY-FOUND`), Station gründen (`STATION-FOUND`), Spektralanalyse, Mond- und Mars-Module, Wasser-Grundlagen, wissenschaftliche Beobachtung (Liste im SSF-Vermerk). Bitte Reihenfolge nennen, falls eines davon in NOXIA früh gebraucht wird.

## Offen (SSF)

`UNL:NOX:NAV:CURVATURE` und `UNL:NOX:research:magnetobiology-experiment-design` (Abschnitt G) haben noch kein Modul.
