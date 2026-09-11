---
id: EXT-NOXIA-MOON-20260911-SURFACE-LOGISTICS
title: Moon Surface Logistics – Shackleton, Minen, Rover und Exportkette
status: done
source: NOXIA-CORE
target: NOXIA-MOON
created: 2026-09-11
completed: 2026-09-11
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

## Ergebnis NOXIA-MOON

Die Moon-Domain-Policy ist ausgearbeitet und im Repository verankert:

- `docs/design/moon-surface-logistics.md`
- `lib/game/moonSurfaceLogistics.ts`
- `lib/game/moonSurfaceLogistics.test.ts`

Festgelegt wurden:

- physische Oberflächenkette Mine -> Minenpuffer -> Fahrzeug -> Verarbeitung/Hub -> Shuttle-Port-Lager,
- klare Grenze zwischen Surface Logistics und separatem Transfer-Shuttle zum Lunar Orbital Interface,
- Rollen `cargo-rover` und `heavy-hauler` ohne erfundene Engineering-IDs,
- Route-Klassen `offroad`, `prepared-track`, `hardened-road`,
- renderer-unabhängige Ableitung von Distanz, Anstieg, Abstieg sowie mittlerer/maximaler Längsneigung aus einem Terrain-Höhenprofil,
- Route-Bewertung gegen eine von Engineering/Core gelieferte Fahrzeug-Mobilitätshülle,
- provisorische **dimensionlose** Gameplay-Koeffizienten für relative Geschwindigkeit/Energie; keine erfundenen technischen kWh-, Nutzlast- oder Maximalsteigungswerte,
- UX-Policy für wiederholbare automatische Transportbeziehungen statt manueller Einzel-Roverfahrten,
- Progression von frühem Offroad-Betrieb bis zu dedizierten Schwerlastkorridoren.

## Cross-Repository-Abhängigkeit

Die technische Auslegung der Fahrzeuge und Infrastruktur gehört zu KUEPER Engineering und wurde deshalb dort als Request auf `main` angelegt:

`external-tasks/open/EXT-NOXIA-ENG-20260911-lunar-surface-logistics-vehicles.md`

ID: `EXT-NOXIA-ENG-20260911-LUNAR-SURFACE-LOGISTICS`

Engineering soll insbesondere Nutzlast-/Fahrwerks-/Traktions-/Steigungs-/Energiekennfelder sowie Anforderungen für Offroad, vorbereitete Trasse und befestigte Schwerlastroute liefern. NOXIA übernimmt daraus später Gameplay-Eingangsgrößen, ohne Engineering-Source-of-Truth zu duplizieren.

## Abgrenzung

Nicht implementiert wurden entsprechend dem Auftrag:

- eigene Inventar-/Cargo-/Transportjob-Tabellen,
- eigene Backend-Commands,
- eigene Tick-Engine,
- interplanetare Schiffslogik,
- neue globale Koordinatenarchitektur.

Die gemeinsame Spatial- und Core-Schicht bleibt verbindlich.

## Acceptance Criteria

- [x] Metall kann fachlich als physische Kette von Mine bis Kolonielager/Shuttle-Port modelliert werden.
- [x] Terrain und Steigung sind explizite Eingaben der Routenbewertung.
- [x] Es entsteht keine zweite Spatial- oder Backend-Architektur.
- [x] Automatische/repetitive Transportrouten sind als UX- und Domain-Policy vorgesehen.
- [x] Die Schnittstelle bleibt auf andere Oberflächenkörper übertragbar; Moon-spezifische Koeffizienten werden nicht als Marswerte verallgemeinert.

## References

- `lib/game/spatial/`
- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/moonSurfaceLogistics.ts`
- `docs/design/moon-surface-logistics.md`
- `external-tasks/open/EXT-OTA-NOXIA-20260906-transfer-logistics-network.md`
