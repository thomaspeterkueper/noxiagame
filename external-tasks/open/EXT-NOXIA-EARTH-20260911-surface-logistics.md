---
id: EXT-NOXIA-EARTH-20260911-SURFACE-LOGISTICS
title: Earth Surface Logistics – Straßen, Fahrzeuge und Umschlagpunkte
status: open
source: NOXIA-CORE
target: NOXIA-EARTH
created: 2026-09-11
priority: high
affects: [NOXIA, Earth, Core, Logistics]
---

## Ausgangspunkt

NOXIA führt mit dem gemeinsamen Game Core eine physische Logistikkette ein. Produktionsgebäude sollen Güter künftig nicht mehr nur abstrakt in `location_resources` ablegen. Der Core modelliert objektbezogene Bestände, Fahrzeugfracht und Transportaufträge.

Dieser Request betrifft ausschließlich die **Earth-spezifische Oberflächenlogistik**. Datenmodell, Persistenz, atomare Commands und gemeinsame Transportzustände bleiben Eigentum von `NOXIA-CORE`.

## Auftrag

Bitte für die spielbare Erde ausarbeiten, wie Surface Logistics auf der bestehenden realen Karte funktioniert:

1. reale Straßen/Wege aus der vorhandenen OSM-/Earth-Kartenarchitektur als bevorzugte Fahrzeugrouten,
2. Offroad-Verbindungen nur dort, wo Terrain/Steigung/Boden dies erlauben,
3. logistische Knoten an Mine/Industrie/Warenhaus/Logistik-Hub/Raumhafen,
4. klare Übergabe zwischen Gebäudeinventar und Fahrzeugfracht,
5. sinnvolle Fahrzeit-/Distanz-/Geländefaktoren als Earth-Policy, nicht als eigenes Backend,
6. UX-Vorschlag für manuelle und automatische Transportaufträge,
7. vorhandene Straßen- und Buildability-Layer wiederverwenden; keine parallele Routing-Geometrie erfinden.

## Beispielkette

```text
Mine -> Minenpuffer -> LKW/Rover -> Warenhaus / Fabrik
Mine -> LKW/Rover -> Raumhafenlager -> Surface-Transfer
```

## Abgrenzung

Nicht in diesem Chat implementieren:

- neue Supabase-Tabellen für Inventare/Fahrzeugfracht/Transportjobs,
- neue globale Ownership- oder Actor-Semantik,
- eigene Tick-/Scheduler-Logik,
- eigene serverseitige Mutations-API,
- interplanetare Transitlogik.

Diese Punkte werden vom Core bereitgestellt.

## Erwartetes Ergebnis

- Earth-spezifische Policy/Requirements für Surface Logistics,
- Liste der benötigten Knoten-/Routeneigenschaften,
- Entscheidung, welche vorhandenen Earth-Layer direkt nutzbar sind,
- UX-Skizze für Route/Transportauftrag,
- Hinweise auf fehlende Earth-Daten oder APIs,
- Rückgabe als Response/Handoff an `NOXIA-CORE`.

## Acceptance Criteria

1. keine Duplikation des gemeinsamen Core-Datenmodells,
2. reale Straßen und Terrain werden genutzt,
3. Facility -> Vehicle -> Facility ist fachlich vollständig beschrieben,
4. Raumhafen ist als Oberflächen-Umschlagpunkt abbildbar,
5. Lösung bleibt mit Moon/Mars über gemeinsame Core-Schnittstellen kompatibel.

## References

- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/spatial/`
- `external-tasks/open/EXT-OTA-NOXIA-20260906-transfer-logistics-network.md`
- Earth map/buildability implementation in the current `main` branch
