---
id: EXT-NOXIA-ORBIT-20260911-CARGO-HANDOVER
title: Orbit/Stations – Cargo-Handover, Phobos-Markt und Shuttle-Schnittstelle
status: open
source: NOXIA-CORE
target: NOXIA-ORBIT
created: 2026-09-11
priority: high
affects: [NOXIA, Orbit, Stations, Phobos, Core, Logistics]
---

## Ausgangspunkt

Surface Logistics endet nicht am Raumhafen. NOXIA trennt bereits `surface-transfer-shuttle` von `intersolar`, und `phobos` ist als orbitaler Logistikknoten modelliert. Für eine echte Exportkette muss nun die Übergabe von Oberflächenfracht an Orbit/Stationen fachlich definiert werden.

Der Core besitzt Transit, Ownership und künftig die gemeinsamen Inventar-/Transportjob-Commands. Dieser Request betrifft die **Orbit-/Stations-Policy und UX**, nicht ein zweites Backend.

## Auftrag

Bitte ausarbeiten:

1. Oberflächenlager/Raumhafen -> Transfer-Shuttle -> Orbitalinterface als klaren Cargo-Handover,
2. Inventarknoten für Orbitalinterface, Station/Depot und angedocktes Schiff,
3. Umladen zwischen Shuttle, Depot und intersolarem Frachter,
4. Phobos als Markt-/Depot-/Free-Port-Endpunkt für Metall und andere Waren,
5. Docking und Cargo-Handover getrennt halten: ein Schiff kann angedockt sein, ohne dass Fracht automatisch übertragen wird,
6. UX für Laden/Entladen/Weiterleiten und automatische Transportketten,
7. Anforderungen an Transit-Route/Legs für spätere mehrstufige Transportaufträge.

## Referenzkette

```text
Moon Mine
 -> Surface Hauler
 -> Shackleton Shuttle-Port Storage
 -> Transfer Shuttle
 -> Lunar Orbital Interface / Depot
 -> Intersolar Freighter
 -> Phobos
 -> Phobos Depot / Market
```

## Abgrenzung

Nicht implementieren:

- neue globale Inventar-/Transportjob-Schemata,
- eigene Transit-Zustandsmaschine,
- neue Schiffsklassen oder Engineering-IDs ohne zuständige Engineering-Closure,
- Oberflächenrouting für Earth/Moon/Mars.

## Erwartetes Ergebnis

- fachliche Cargo-Handover-Regeln für Orbit/Stations,
- benötigte Inventory-/Transfer-Rollen als Input für Core,
- Phobos-Verkaufs-/Depotablauf,
- klare Grenze Shuttle vs. intersolares Schiff,
- UX-Vorschlag für Cargo-Transfer und mehrstufige Exportaufträge,
- Response an `NOXIA-CORE`.

## Acceptance Criteria

1. Fracht kann ohne magische Teleportation Oberfläche -> Orbit -> Frachter -> Phobos gelangen,
2. Docking, Besitz und Frachttransfer bleiben getrennte Zustände,
3. Phobos kann als realer Handels-/Umschlagknoten funktionieren,
4. bestehende `Transit`-Architektur wird wiederverwendet,
5. keine parallele Backend-Domain entsteht.

## References

- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/core/`
- `external-tasks/open/EXT-OTA-NOXIA-20260906-transfer-logistics-network.md`
