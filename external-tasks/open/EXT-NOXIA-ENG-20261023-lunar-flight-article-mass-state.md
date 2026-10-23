---
id: EXT-NOXIA-ENG-20261023-LUNAR-FLIGHT-ARTICLE-MASS-STATE
title: Engineering – konkrete Crew/Suit/Mission-Equipment-Masse für Lunar Flight Article
status: open
source: NOXIA-MOON
target: KUEPER-ENGINEERING
created: 2026-10-23
priority: high
affects: [NOXIA, Moon, Orbit, Spacecraft, Ascent, Engineering, FlightArticle]
---

## Ausgangspunkt

Der generische Lunar-Ascent-Vertrag ist abgeschlossen:

- Authority `ENG-LUNAR-ASCENT-r1`
- Frame `ENG-SCV-0002` Lunar Ascent Shuttle Mk.I
- Dry mass 6,500 kg
- Mission-payload envelope <= 2,000 kg
- reference usable ascent propellant 5,500 kg
- max liftoff mass 14,000 kg
- LLO 80–120 km

NOXIA hat dafür inzwischen konkrete persistente `spacecraft_flight_articles` und eine reale Shuttle-Instanz. Der Core verlangt bewusst reale Missionswerte und setzt keine Maximalwerte als angebliche Ist-Werte ein.

## Noch fehlender Resolver

Für eine konkrete bemannte Mission benötigt NOXIA eine autoritative Herleitung für:

```text
crew_cargo_mission_equipment_kg
actual_start_mass_kg
usable_ascent_propellant_kg
target_plane_resolved
```

Cargo-Masse kann aus dem Logistics-Cargo-Mass-Authority-Layer aufgelöst werden. Noch nicht kanonisch auflösbar ist insbesondere die Masse eines aktiven Commanders/Piloten inklusive für den Start anzurechnender Suit-/persönlicher Ausrüstung sowie obligatorischer Mission-Equipment-Anteile.

## Auftrag

Bitte eine versionierte Engineering-Regel liefern, die entweder

1. eine konkrete standardisierte Crew-/Suit-Massenannahme mit Evidenzstatus festlegt, oder
2. einen Resolver-Vertrag definiert, der die Masse aus separaten Person-/Suit-/Equipment-Daten aggregiert.

Zusätzlich bitte festlegen:

- welche Ausrüstung bereits in den 6,500 kg vehicle dry mass enthalten ist;
- welche Ausrüstung in `crew_cargo_mission_equipment_kg` gehört;
- ob für den r1-Reference-Ascent zwingend 5,500 kg usable propellant geladen sein müssen oder eine niedrigere Masse missionsabhängig über die bereits dokumentierte Rocket-Equation-Formel aufgelöst werden darf;
- welche Zielbahnparameter für `moon-llo-100` nötig sind, damit `target_plane_resolved=true` gesetzt werden darf.

## Invarianten

- NOXIA darf die 2,000-kg-Obergrenze nicht als tatsächliche Missionsmasse speichern.
- NOXIA darf keine implizite "Pilot = X kg"-Zahl erfinden.
- Fehlende Werte bleiben `NULL/unresolved` und blockieren Ascent.
- Keine ASCE-/Earth-Werte verwenden.

## NOXIA-Stand

Bereits implementiert:
- persistenter `ENG-SCV-0002` Flight Article;
- Moon Shuttle provisioning;
- Crew manifest;
- Cargo-Mass-Authority für Logistics-Güter;
- Ascent Readiness fail-closed;
- Surface-Port -> Shuttle physischer Handover;
- Ascent -> orbital presence -> `moon-h-light` Holding;
- `moon-a1` Docking -> Lunar Orbital Interface Connected Cargo.

## Acceptance Criteria

1. Konkrete Mission kann ohne erfundene Werte eine tatsächliche Startmasse bestimmen.
2. Crew/Suit/Equipment und Cargo werden nicht doppelt gezählt.
3. Propellant state ist reproduzierbar und Engineering-konform.
4. `moon-llo-100` kann deterministisch als plane-resolved oder unresolved bewertet werden.
5. NOXIA kann daraus den Flight Article vor Start atomar aktualisieren.
