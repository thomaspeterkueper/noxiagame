---
id: EXT-OTA-NOXIA-20260906-ship-frame-entity-notice
source: OTA
target: NOXIA
status: open
created: 2026-09-06
priority: high
type: entity-notice
---

# OTA → NOXIA: Schiffsrahmen-Entitäten verfügbar

OTA hat im Rahmen von `EXT-NOX-OTA-20260831-ship-object-dossiers` die fünf bestehenden NOXIA-Schiffsrahmen als eigenständige technische Typidentitäten angelegt.

## Read-only Mappings

| NOXIA frameId | sourceDocumentId | canonicalId | objectId | mappingRole | OTA-Status |
| --- | --- | --- | --- | --- | --- |
| `mk1` | `OTA-TEC-0112-2026-DE` | `OTA-TEC-0112-NOX-SHIP-MK1` | `noxia-ship-frame-mk1` | `ship-frame` | `ENTWURF` |
| `fast` | `OTA-TEC-0113-2026-DE` | `OTA-TEC-0113-NOX-SHIP-FAST` | `noxia-ship-frame-fast` | `ship-frame` | `ENTWURF` |
| `heavy` | `OTA-TEC-0114-2026-DE` | `OTA-TEC-0114-NOX-SHIP-HEAVY` | `noxia-ship-frame-heavy` | `ship-frame` | `ENTWURF` |
| `scout` | `OTA-TEC-0115-2026-DE` | `OTA-TEC-0115-NOX-SHIP-SCOUT` | `noxia-ship-frame-scout` | `ship-frame` | `ENTWURF` |
| `pioneer` | `OTA-TEC-0116-2026-DE` | `OTA-TEC-0116-NOX-SHIP-PIONEER-CONSTRUCTOR` | `noxia-ship-frame-pioneer-constructor` | `ship-frame` | `ENTWURF` |

## Integrationsregel

Diese Notice bestätigt die **Existenz und Identität** der fünf technischen Rahmentypen. Sie kanonisiert keine NOXIA-Spielwerte.

Insbesondere bleiben ausschließlich NOXIA-eigen:

- Slots;
- `baseSpeed`;
- Kosten;
- Unlockstatus;
- Gameplay-Flugzeiten;
- `ShipInstance`-/`ModuleInstance`-UUIDs;
- aktuelle Gameplay-Massen und Kapazitäten.

OTA-`objectId`/`canonicalId` dürfen nur auf der Typ-/Bauplanebene verwendet werden. Lebende NOXIA-Instanzen behalten ihre eigene Runtime-Identität.

## Namensabgrenzung

NOXIA `pioneer` / `OTA-TEC-0116` ist der **Pionier-Konstrukteur**. Er ist nicht identisch mit `OTA-TEC-0092-2026-DE`, dem cislunaren Frühphase-Kombifahrzeug der „Pioneer-Klasse“.

## Modulstatus

OTA hat die Schiffsmodule zunächst klassifiziert:

- vorerst NOXIA-/Interface-Abstraktion: `cargo`, `tank`, `scanner`, `drive_booster`;
- technisch eigenständige Kandidaten mit Engineering-Bedarf: `habitat_pod`, `deep_scanner`, `survey_drone`, `construction_rig`, `colony_pod`.

Dafür existieren noch keine freigegebenen neuen OTA-`canonicalId`s. Ein Engineering-Closure wurde an KUEPER Engineering übergeben. NOXIA soll bis zur Rückgabe keine technischen Parameter aus diesen Kandidaten als OTA-Kanon behandeln.

## Quelle

OTA Coverage Matrix: `docs/noxia-ship-object-coverage-20260906.md`.
