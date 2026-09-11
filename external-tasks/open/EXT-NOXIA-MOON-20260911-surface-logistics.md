---
id: EXT-NOXIA-MOON-20260911-SURFACE-LOGISTICS
title: Moon Surface Logistics – Shackleton, Minen, Rover und Exportkette
status: open
source: NOXIA-CORE
target: NOXIA-MOON
created: 2026-09-11
priority: high
affects: [NOXIA, Moon, Core, Logistics]
---

## Ausgangspunkt

Der aktuelle Shackleton-Playtest zeigt den konkreten Bedarf: Eine Mine erzeugt Metall, aber zwischen Minenbestand, Kolonielager, Fahrzeug und Export fehlt die physische Transportkette.

Der gemeinsame Core wird objektbezogene Inventare, Fahrzeugfracht und Transportaufträge bereitstellen. Dieser Request definiert ausschließlich die **mondspezifische Oberflächen-Policy**.

## Auftrag

Bitte für Shackleton/Mond ausarbeiten:

1. typische Logistikkette Mine -> Puffer -> Rover/Hauler -> Warenhaus/Logistik-Hub/Raumhafen,
2. Fahrbarkeit aus bestehendem LOLA-/Terrain-/Slope-System ableiten,
3. Unterschied zwischen befestigten Fahrwegen, vorbereiteten Trassen und Offroad-Fahrt,
4. welche Knoten an Mine, Lager, Schmelze/Fabrik und Shuttle-Port benötigt werden,
5. sinnvolle Moon-spezifische Faktoren für Geschwindigkeit, Steigung, Energie und Lade-/Entladezeiten,
6. UX für automatische Transportaufträge, damit der Spieler nicht jede einzelne Roverfahrt manuell ausführen muss,
7. Exportkette bis zum Shuttle-Port klar von Orbit/Inter-Node-Transit trennen.

## Referenzkette

```text
Mine
 -> lokaler Minenpuffer
 -> Cargo Rover / Heavy Hauler
 -> Warenhaus oder Logistik-Hub
 -> Raumhafen-/Shuttle-Lager
 -> Transfer-Shuttle
 -> Lunar Orbital Interface
```

## Abgrenzung

Nicht implementieren:

- eigene Inventar-/Cargo-/Transportjob-Tabellen,
- eigene Backend-Commands,
- eigene Tick-Engine,
- interplanetare Schiffslogik,
- neue globale Koordinatenarchitektur.

Die gemeinsame Spatial- und Core-Schicht ist verbindlich.

## Erwartetes Ergebnis

- Moon-Policy für Surface Logistics,
- benötigte Rover-/Hauler-Rollen als Gameplay-Anforderungen, noch keine eigenmächtigen kanonischen Engineering-IDs,
- Routing-Regeln auf LOLA-/Slope-Basis,
- Knoten-/Umschlaganforderungen,
- UX-Vorschlag für Transportaufträge und Lageranzeige,
- Response an `NOXIA-CORE`.

## Acceptance Criteria

1. Metall aus einer Mine kann fachlich bis in ein Kolonielager und bis zum Shuttle-Port gelangen,
2. Terrain und Steigung beeinflussen die Route,
3. keine zweite Spatial- oder Backend-Architektur entsteht,
4. automatische Routen sind möglich,
5. dieselbe Core-Schnittstelle bleibt später für Mars nutzbar.

## References

- `lib/game/spatial/`
- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `external-tasks/open/EXT-OTA-NOXIA-20260906-transfer-logistics-network.md`
- current Shackleton/Moon map and terrain implementation
