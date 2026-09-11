---
id: EXT-NOXIA-CORE-20260911-ORBIT-CARGO-TRANSFER
title: Core – adressierbare Inventare und atomare Cargo-Handovers für Orbit/Stationen
status: open
source: NOXIA-ORBIT
target: NOXIA-CORE
created: 2026-09-11
priority: high
affects: [NOXIA, Core, Orbit, Stations, Logistics, Phobos]
---

## Ausgangspunkt

Orbit/Stations hat die fachliche Cargo-Handover-Policy abgeschlossen und Phobos als `free-port` / persistentes Depot / lokalen Markt-Knoten klassifiziert.

Kanonische Invariante:

> Docking stellt nur eine physische Verbindung her. Fracht bewegt sich ausschließlich durch einen separaten, expliziten Cargo-Transfer.

Orbit darf dafür keine eigene Inventar- oder Transit-Zustandsmaschine aufbauen.

## Benötigte Core-Fähigkeiten

Bitte die gemeinsame Core-Schicht so erweitern, dass folgende Fähigkeiten generisch verfügbar werden:

1. adressierbare Inventare für
   - Fahrzeuge / Schiffe / Transfer-Shuttles,
   - Stations-/Depotlager,
   - Surface-Port-Lager,
2. atomarer Cargo-Transfer `source inventory -> target inventory`,
3. Validierung von
   - Ressource,
   - Menge,
   - Source-Bestand,
   - Zielkapazität,
   - Ownership / Autorisierung,
   - zulässiger physischer Verbindung,
4. idempotente Transfer-Commands, damit Wiederholung keinen doppelten Warenfluss erzeugt,
5. Reservierungen für
   - Marktangebote,
   - Transportaufträge,
   - Weitertransport,
6. Unterstützung mehrstufiger Transportjobs mit getrennten
   - `legs` = Fahrzeugbewegung,
   - `handovers` = Frachtbewegung zwischen Inventaren,
7. Docking-Zustand als Voraussetzung für bestimmte Transfers, aber niemals als Transfer selbst.

## Referenzablauf

```text
Shackleton Shuttle-Port Storage
 -> Transfer Shuttle
 -> Lunar Orbital Depot
 -> Intersolar Freighter
 -> Phobos Depot
 -> Phobos Market reservation / sale
```

Benötigte Handover-Schritte:

```text
surface-port inventory -> shuttle inventory
shuttle inventory -> orbital-depot inventory
orbital-depot inventory -> freighter inventory
freighter inventory -> phobos-depot inventory
phobos-depot inventory -> market reservation
```

Jeder Pfeil ist ein eigener autorisierter Vorgang.

## API-/Command-Semantik

Die konkrete technische Form bleibt Core-owned. Aus Orbit-Sicht muss aber mindestens eine Semantik in dieser Art möglich sein:

```text
transferCargo({
  commandId,
  sourceInventoryId,
  targetInventoryId,
  resource,
  amount,
  actorId
})
```

Der Command muss atomar und idempotent sein.

Ein Transportauftrag muss anschließend Sequenzen dieser Form referenzieren können:

```text
leg -> handover -> leg -> handover -> final storage/market
```

## Nicht in Core duplizieren

- keine Orbit-spezifische zweite Transit-State-Machine,
- keine Phobos-Sondertabellen für generische Inventarfunktionen,
- keine automatische Frachtbewegung durch `dock`, `arrive` oder `travel complete`,
- keine implizite Surface-Landung intersolarer Frachter.

## Acceptance Criteria

1. Docking und Cargo-Transfer sind technisch getrennte Commands/Zustände.
2. Fracht kann zwischen zwei autorisierten Inventarknoten atomar bewegt werden.
3. Source-Bestand und Zielkapazität können nicht negativ/überlaufen.
4. Wiederholung desselben Commands erzeugt keinen Doppeltransfer.
5. Marktware auf Phobos kann aus physischem Depotbestand reserviert werden, ohne das Depotmodell zu umgehen.
6. Mehrstufige Routen können Legs und Handovers separat referenzieren.
7. Bestehende Transit-Architektur wird erweitert statt ersetzt.

## Orbit-Referenzen

- `docs/architecture/orbit-cargo-handover.md`
- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/stationProfiles.ts`
- `external-tasks/open/EXT-NOXIA-ORBIT-20260911-cargo-handover.md`
