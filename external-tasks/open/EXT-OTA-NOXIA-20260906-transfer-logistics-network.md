---
id: EXT-OTA-NOXIA-20260906-TRANSFER-LOGISTICS-NETWORK
title: Transferlogistik als mehrstufiges Netz mit Orbital-Shuttles und Hubs abbilden
status: open
source: OTA
target: NOXIA
created: 2026-09-06
priority: high
affects: [NOXIA, OTA, KG, KUEPER Engineering]
---

## Neue OTA-Systementität

- `sourceDocumentId`: `OTA-TEC-0122-2026-DE`
- `canonicalId`: `OTA-TEC-0122-TRANSFER-NETWORK`
- `objectId`: `solar-transfer-logistics-network`
- `mappingRole`: `reference`
- Status: `ENTWURF`

`OTA-TEC-0122` beschreibt die technische Transferlogistik als Graph aus Oberflächenzugang, Orbital-Legs, optionalen Hubs/Depots und interplanetaren Korridoren.

## Warum das für NOXIA nötig ist

Die heutige Schiffslogik kann direkte Flüge zwischen `earth`, `moon`, `mars`, `phobos` und `prometheus` abbilden. Diese Slugs aggregieren aber teilweise technisch verschiedene Ebenen wie Oberfläche, lokalen Orbit und Hub. Für die weitere Entwicklung soll NOXIA komplette Transportketten darstellen können, ohne die heutige einfache Bedienung aufzugeben.

Beispiele:

```text
Earth Surface -> LEO / Orbital Prime -> LLO / Tycho -> Moon Surface
Earth Surface -> LEO -> Gateway -> LLO -> Moon Surface
Earth Surface -> LEO -> interplanetary transfer -> Mars Orbit -> Mars Surface
Earth-side Hub -> Mars Orbit -> Phobos -> Mars Orbit/Surface
LEO -> Prometheus L5
```

Zwischenstationen sind optional. Gateway, L5, Tycho oder Phobos dürfen nicht automatisch Pflichtknoten werden.

## Bereits vorhandene OTA-Typen

- `OTA-TEC-0083` Starport-Launcher — Earth Surface ↔ LEO
- `OTA-TEC-0082` CYGNUS — cislunarer Transfer
- `OTA-TEC-0084` PELICAN — LLO ↔ Moon Surface
- `OTA-TEC-0016` KITE — Mars Orbit ↔ Mars Surface
- `OTA-TEC-0087` Gateway EML-2 — cislunarer Hub
- `OTA-TEC-0092` Pioneer-Kombifahrzeug — frühe integrierte Übergangsarchitektur
- `OTA-TEC-0112`–`0116` — NOXIA-Schiffsrahmen, deren physische Langstreckenrollen noch Engineering Closure benötigen

## Offene Fahrzeug-/Hubklassen

KUEPER Engineering prüft über `EXT-OTA-ENG-20260906-transfer-logistics-network-closure.md`, ob eigenständige Typen nötig sind für:

- Orbital Shuttle / Crew Transfer Vehicle
- Orbital Cargo Tug
- Depot Tender / Tanker
- Hub-to-Hub Shuttle
- Mars Orbital Transfer Vehicle
- Interplanetary Passenger/Cargo Transfer Vehicle
- Rescue / Safe-Haven Transfer Vehicle

NOXIA soll diese IDs **noch nicht selbst erfinden**.

## Gewünschte NOXIA-Architektur

Bitte die Runtime so vorbereiten, dass ein Spielerauftrag und die technische Route getrennte Ebenen sein können.

Vorgeschlagene Struktur:

```text
TransportOrder
  origin
  destination
  cargo/passengers
  routeId

TechnicalRoute
  nodes[]
  legs[]

TransferLeg
  fromNode
  toNode
  vehicleTypeRef
  role
  optionalHub
  cargoClassCompatibility
  crewCapable
  refuelRequirement
```

Ein Spieler kann weiterhin z. B. `earth -> mars` auswählen. Die technische Route darf intern aus mehreren Legs bestehen.

## Wichtige Trennung

Die bestehenden NOXIA-Werte in `lib/game/ships.ts` und `lib/game/orbits.ts` bleiben Gameplay/Simulationstuning:

- `baseSpeed`
- Credits-Kosten
- Slotzahlen
- `FLIGHT_ENERGY`
- `SEC_PER_UNIT`
- `MIN_SECONDS` / `MAX_SECONDS`
- die vereinfachten Bahnradien/-perioden

Sie dürfen nicht als OTA- oder Engineering-Kanon interpretiert werden.

## Abnahme

Erledigt, wenn NOXIA:

1. `OTA-TEC-0122` als read-only Systemreferenz kennt,
2. Nodes und Legs technisch getrennt modellieren kann,
3. Oberfläche/Orbit/Hub nicht mehr zwingend als eine einzige technische Ortsidentität behandeln muss,
4. Direkt- und Hubrouten parallel unterstützt,
5. auf spätere Engineering-Ergebnisse für neue Shuttle-/Tug-/Hubtypen vorbereitet ist,
6. die bestehende einfache Spielerroute weiterhin als Aggregation anbieten kann.
