---
id: EXT-OTA-NOXIA-20260906-station-module-entity-notice
source: OTA
target: NOXIA
status: open
created: 2026-09-06
priority: high
type: entity-notice
---

# OTA → NOXIA: Stationsmodul-Entitäten verfügbar

OTA hat den Stationsmodul-Coverage-Abgleich durchgeführt. Fünf bestehende NOXIA-Typen besitzen jetzt eigenständige technische OTA-Typidentitäten.

## Read-only Mappings

| NOXIA moduleId | sourceDocumentId | canonicalId | objectId | mappingRole | OTA-Status |
| --- | --- | --- | --- | --- | --- |
| `solar_array` | `OTA-TEC-0117-2026-DE` | `OTA-TEC-0117-ORBITAL-SOLAR-ARRAY` | `orbital-station-solar-array` | `station-module` | `ENTWURF` |
| `docking_bay` | `OTA-TEC-0118-2026-DE` | `OTA-TEC-0118-ORBITAL-DOCKING-BAY` | `orbital-station-docking-bay` | `station-module` | `ENTWURF` |
| `habitat_module` | `OTA-TEC-0119-2026-DE` | `OTA-TEC-0119-ORBITAL-HABITAT` | `orbital-station-habitat-module` | `station-module` | `ENTWURF` |
| `research_lab` | `OTA-TEC-0120-2026-DE` | `OTA-TEC-0120-ORBITAL-RESEARCH-LAB` | `orbital-station-research-lab` | `station-module` | `ENTWURF` |
| `observatory` | `OTA-TEC-0121-2026-DE` | `OTA-TEC-0121-ORBITAL-OBSERVATORY` | `orbital-station-observatory` | `station-module` | `ENTWURF` |

Diese IDs bestätigen Typidentität und Existenz. Sie liefern noch keine eingefrorenen Leistungsdaten.

## Noch nicht direkt zu mappen

- `command_center`: derzeit Gameplay-/Systemaggregat, keine eigenständige OTA-Modulidentität.
- `water_recycler`: vorhandene technische Grundlage `OTA-TEC-0086-2026-DE`; direkte Stations-Typbindung wird bis zur Varianten-/Generalisierungsentscheidung zurückgehalten.
- `storage_bay`: derzeit zu generisch; reale Lagerklassen können nach Medien-/Gefahrenklasse auseinanderfallen.
- `reactor`: die NOXIA-Bezeichnung „Fusionsreaktor“ ist nicht als OTA-Technologie kanonisiert; Entscheidung ausstehend.

## Gameplay-Grenze

Nicht aus OTA ableiten oder nach OTA zurückschreiben:
- Credits;
- `buildTicks`;
- Energie-/Wasser pro Tick;
- Lager- oder Crewboni;
- Icons/Farben/UI-Texte;
- Unlockzustände.

Quantitative technische Closure und die vier offenen Typentscheidungen wurden an KUEPER Engineering übergeben.

Quelle: `overtime-archive.org/docs/noxia-station-module-coverage-20260906.md`.
