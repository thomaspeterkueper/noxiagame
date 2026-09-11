# Earth Surface Logistics

Status: Earth-Policy und erster OSM-basierter Surface-Router für `EXT-NOXIA-EARTH-20260911-SURFACE-LOGISTICS`.

## Zuständigkeit

Earth besitzt die planetenspezifische Interpretation von Karte und Gelände:

- OSM-Straßen/-Wege als bevorzugtes Routingnetz,
- Straßeneignung für Surface-Fahrzeugrollen,
- Offroad-Fallback,
- relative Traversal-Kosten für Zeit/Energie/Wear,
- kurze nicht kartierte Facility-Zufahrten,
- Routen- und Transportdarstellung in der Earth-UX.

Core besitzt Inventare, Reservierungen, Fahrzeugbelegung, TransportJob-Persistenz, Laden/Entladen, Scheduler/Ticks, Ownership und Economy. Der früher fehlende Vertrag aus `external-tasks/open/EXT-NOXIA-CORE-20260911-surface-transport-job-contract.md` ist inzwischen auf `main` technisch vorhanden: `lib/game/core/logistics.ts`, `app/api/game/logistics/route.ts`, der Vehicle-Instance-Core und die zugehörigen Supabase-Migrationen stellen die gemeinsame Transport-State-Machine bereit. Earth konsumiert diese Verträge und baut keine lokale Ersatzlogik.

## Bestehende Daten werden wiederverwendet

Es wird keine zweite Straßen- oder Terrain-Geometrie eingeführt.

### Straßen / OSM

`lib/world/spatial/overpassEarthFeatureSource.ts` liefert die bestehenden `road`-Features aus `way[highway]` und übernimmt die OSM-Tags vollständig in `properties`. Damit stehen unter anderem `highway`, `surface`, `access`, `vehicle`, `motor_vehicle` und `oneway` zur Verfügung, sofern OSM sie enthält.

Die aktuelle Earth-Karte bleibt Quelle der Geometrie. `lib/game/earthSurfaceLogistics.ts` klassifiziert die Tags; `lib/game/earthSurfaceRouting.ts` baut daraus nur für die aktuelle Routenberechnung einen ephemeren Graphen. Dieser Graph wird nicht persistiert und ist keine zweite Straßenquelle.

### Terrain / Offroad

Bestehende Earth-Daten bleiben maßgeblich:

- Elevation/DEM,
- Slope,
- Buildability,
- Water,
- Landuse/OSM,
- vorhandene lokale metrische Earth-Frames.

Fehlende Daten werden nicht synthetisiert. Ein unaufgelöster Abschnitt bleibt `unresolved`.

## Fahrzeugrollen und gemeinsame Vehicle-Domain

Earth verwendet die gemeinsamen Surface-Rollen `cargo-rover` und `heavy-hauler`. Die Rollen sind Gameplay-/Logistikrollen, keine Behauptung identischer Fahrzeuge auf Earth und Moon.

Die gemeinsame Vehicle-Domain in `lib/game/vehicles/types.ts` liefert inzwischen unter anderem:

- `surfaceMobility.safeLongitudinalSlopeDeg`,
- `surfaceMobility.referenceSpeedKph`,
- Cargo-Kapazität,
- Operational Status,
- Location/Ownership über den Core-Instance-Layer.

Damit kann Earth aus seiner relativen Routing-Policy zusammen mit dem konkreten Fahrzeug eine absolute ETA ableiten, ohne Fahrzeugphysik lokal zu erfinden.

## OSM-Straßenklassen

| Earth route class | OSM-Grundlage | Cargo Rover | Heavy Hauler | Bedeutung |
| --- | --- | --- | --- | --- |
| `paved-road` | normale `highway`-Klassen, sofern nicht explizit unbefestigt | bevorzugt | bevorzugt | Standardroute |
| `service-road` | `highway=service`, befestigt/ohne gegenteilige Surface-Info | bevorzugt | erlaubt | Facility-/Industriezufahrt |
| `track` | `highway=track` oder explizit unbefestigte Straße | erlaubt | erlaubt | langsamer/teurer |
| `offroad` | kein Straßenstück; Terrain-Assessment | erlaubt, wenn Terrain passt | erlaubt, wenn Terrain passt | Fallback, nicht Standard |
| `unresolved` | Daten unvollständig/unklare Klasse | ungeklärt | ungeklärt | keine erfundene Befahrbarkeit |

Explizite `access=no`, `access=private`, `motor_vehicle=no/private` bzw. `vehicle=no` werden nicht stillschweigend umgangen. Fuß-/Rad-/Reitwege, Treppen und reine Fußgängerflächen werden nicht als Fahrzeugstraßen verwendet.

## Relative Traversal-Kosten

| Klasse | Speed | Energy | Wear | nutzbarer Anteil der gelieferten Fahrzeug-Steigungsgrenze |
| --- | ---: | ---: | ---: | ---: |
| paved road | 1.00 | 1.00 | 1.00 | 1.00 |
| service road | 0.82 | 1.12 | 1.15 | 0.92 |
| track | 0.62 | 1.35 | 1.55 | 0.78 |
| offroad | 0.42 | 1.75 | 2.20 | 0.62 |

Die physische `safeLongitudinalSlopeDeg` kommt aus der gemeinsamen Vehicle-Domain. Earth wendet nur die Route-Class-/Terrain-Faktoren an.

Offroad wird zusätzlich nach Boden/Landnutzung gewichtet:

- `open`: Basis-Offroadkosten,
- `vegetated`: langsamer, energie- und verschleißintensiver,
- `soft-ground`: stärkere Penalty,
- `water`, `built`, `protected`: blockiert,
- `unresolved`: nicht als befahrbar angenommen.

## Kurze nicht kartierte Facility-Zufahrt

OSM bildet nicht jede private/innerbetriebliche Zufahrt bis an einen NOXIA-Footprint ab. Deshalb gibt es einen engen Last-Mile-Fallback, aber keine erfundene Straße:

- Cargo Rover: höchstens 75 m,
- Heavy Hauler: höchstens 50 m,
- nur bei bereits positivem Offroad-Assessment,
- längere Lücken bleiben `unresolved`.

## Routing

`lib/game/earthSurfaceRouting.ts` implementiert den renderer-neutralen Router auf der bereits geladenen OSM-Geometrie:

1. nur als befahrbar klassifizierte `road`-Line-Features werden aufgenommen,
2. gemeinsame OSM-Koordinaten bilden Graphknoten,
3. `oneway` und Kreisverkehr-Richtung werden berücksichtigt,
4. Quelle und Ziel werden auf das nächste Straßensegment projiziert,
5. kurze Facility-Lücken werden nur mit positivem Offroad-Assessment verbunden,
6. Dijkstra gewichtet Straßen nach der relativen Zeit-Penalty ihrer Earth-Route-Class,
7. die Ausgabe enthält Segmentfolge, OSM-Feature-ID, Route-Class, Distanz und relative Speed-/Energy-/Wear-Faktoren,
8. zusätzlich wird eine direkt zeichnbare Polyline ausgegeben.

Damit kann eine Route aus `paved-road`, `service-road`, `track` und kurzen `offroad`-Access-Segmenten bestehen. Beliebiges kilometerweites Cross-Country-Pathfinding wird weiterhin nicht durch Luftlinien ersetzt.

## Core-Handoff für spielbare Transporte

Der gemeinsame Core kann inzwischen:

- zugängliche Inventare und Inventar-Snapshots liefern,
- persistente TransportJobs anlegen,
- Ware reservieren,
- ein Fahrzeuginventar/Fahrzeugrolle binden,
- `reserved → loading → in_transit → arrived → unloading → completed` persistieren,
- Jobs starten, abbrechen und automatisch nach ETA weiterführen,
- konkrete Fehler wie fehlende Kapazität, falsche Fahrzeug-Location, belegtes Fahrzeug oder unpassierbare Route melden.

Für `domain='surface'` erwartet Core im `routeSnapshot` insbesondere ein positives `passable` und zum Start eine gültige `etaSeconds`. Earth muss deshalb seine Route in genau diesen gemeinsamen Snapshot projizieren.

## Facility → Vehicle → Facility

```text
Facility-/Lagerinventar (Core)
        ↓ reservieren/laden
Surface Vehicle (Core state)
        ↓ Earth route / traversal assessment
Ziel-Facility-/Lagerinventar (Core)
        ↓ entladen
Zielbestand (Core)
```

Nächster Earth-UX-Schritt:

- Quelle/Ziel aus den Core-Inventaren auswählen,
- Gut/Menge aus dem Quell-Snapshot wählen,
- verfügbare Surface-Fahrzeuge aus `/api/game/vehicles` anbieten,
- OSM-/Offroad-Route berechnen und auf der bestehenden Earth-Karte zeichnen,
- aus `referenceSpeedKph` + Earth-Routenfaktoren ETA berechnen,
- `routeSnapshot` erzeugen,
- den gemeinsamen `/api/game/logistics`-TransportJob anlegen/starten,
- laufenden Status und Core-Blocker anzeigen.

## Raumhafen

`NOX:TER:SAUERLAND-SPACEPORT` bleibt ein Surface Shuttle Port:

```text
Mine / Fabrik / Warenhaus
        ↓ Surface Vehicle
Raumhafen-Lager
        ↓ Core-Handover
Surface Transfer Shuttle
```

Earth endet fachlich am Surface-Port-/Shuttle-Handover. Orbitale Übergabe und intersolarer Transit bleiben außerhalb dieses Earth-Moduls.

## Automatische Regeln

Die Earth-UX darf Regeln konfigurieren und visualisieren, z. B. Mindestbestand oder Schwellwerttransport. Ein gemeinsames persistentes Regelmodell und dessen Ausführung gehören weiterhin in Core; Earth führt keine eigene Regel-State-Machine ein.

## References

- `external-tasks/open/EXT-NOXIA-EARTH-20260911-surface-logistics.md`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-surface-transport-job-contract.md`
- `lib/game/core/logistics.ts`
- `app/api/game/logistics/route.ts`
- `app/api/game/vehicles/route.ts`
- `lib/game/vehicles/types.ts`
- `lib/game/earthSurfaceLogistics.ts`
- `lib/game/earthSurfaceRouting.ts`
- `lib/world/spatial/overpassEarthFeatureSource.ts`
