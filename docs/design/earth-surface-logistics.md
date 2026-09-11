# Earth Surface Logistics

Status: erste Earth-Policy für `EXT-NOXIA-EARTH-20260911-SURFACE-LOGISTICS`.

## Zuständigkeit

Earth besitzt ausschließlich die planetenspezifische Interpretation von Karte und Gelände:

- OSM-Straßen/-Wege als bevorzugtes Routingnetz,
- Straßeneignung für Surface-Fahrzeugrollen,
- Offroad-Fallback,
- relative Traversal-Kosten für Zeit/Energie/Wear,
- kurze nicht kartierte Facility-Zufahrten,
- Karten-/UX-Darstellung.

Nicht Earth-owned sind Inventar, Reservierungen, Fahrzeugbelegung, TransportJob-Persistenz, Laden/Entladen, Scheduler/Ticks, Ownership oder Economy. Dafür ist der offene Core-Handoff
`external-tasks/open/EXT-NOXIA-CORE-20260911-surface-transport-job-contract.md`
maßgeblich.

## Bestehende Daten werden wiederverwendet

Es wird keine zweite Straßen- oder Terrain-Geometrie eingeführt.

### Straßen / OSM

`lib/world/spatial/overpassEarthFeatureSource.ts` liefert die bestehenden `road`-Features aus `way[highway]` und übernimmt die OSM-Tags vollständig in `properties`. Damit stehen unter anderem `highway`, `surface`, `access`, `vehicle` und `motor_vehicle` zur Verfügung, sofern OSM sie enthält.

Die aktuelle Earth-Karte bleibt Quelle der Geometrie. `lib/game/earthSurfaceLogistics.ts` klassifiziert nur die Tags.

### Terrain / Offroad

Bestehende Earth-Daten bleiben maßgeblich:

- Elevation/DEM,
- Slope,
- Buildability,
- Water,
- Landuse/OSM,
- vorhandene lokale metrische Earth-Frames.

Fehlende Daten werden nicht synthetisiert. Ein unaufgelöster Abschnitt bleibt `unresolved`.

## Fahrzeugrollen

Earth verwendet vorerst dieselben funktionalen Rollen wie die gemeinsame Surface-Logistics-Familie:

- `cargo-rover`
- `heavy-hauler`

Das bedeutet **nicht**, dass die Moon-Fahrzeuge technisch unverändert auf der Erde eingesetzt werden. Die Rollen sind Gameplay-/Logistikrollen. Masse, Nutzlast, Fahrwerk, absolute Geschwindigkeit, Energiebedarf und physische Steigungsgrenzen kommen aus Engineering/Core.

## OSM-Straßenklassen

Die erste Policy unterscheidet:

| Earth route class | OSM-Grundlage | Cargo Rover | Heavy Hauler | Bedeutung |
| --- | --- | --- | --- | --- |
| `paved-road` | normale `highway`-Klassen, sofern nicht explizit unbefestigt | bevorzugt | bevorzugt | Standardroute |
| `service-road` | `highway=service`, befestigt/ohne gegenteilige Surface-Info | bevorzugt | erlaubt | Facility-/Industriezufahrt |
| `track` | `highway=track` oder explizit unbefestigte Straße | erlaubt | erlaubt | langsamer/teurer |
| `offroad` | kein Straßenstück; Terrain-Assessment | erlaubt, wenn Terrain passt | erlaubt, wenn Terrain passt | Fallback, nicht Standard |
| `unresolved` | Daten unvollständig/unklare Klasse | ungeklärt | ungeklärt | keine erfundene Befahrbarkeit |

Explizite `access=no`, `access=private`, `motor_vehicle=no/private` bzw. `vehicle=no` werden nicht stillschweigend umgangen. Fuß-/Rad-/Reitwege, Treppen und reine Fußgängerflächen werden nicht als Fahrzeugstraßen verwendet.

## Relative Traversal-Kosten

Die Earth-Policy liefert nur dimensionslose Multiplikatoren relativ zu einer geeigneten befestigten Straße. Sie sind Routing-/Gameplay-Gewichte, keine technischen Messwerte.

| Klasse | Speed | Energy | Wear | nutzbarer Anteil der gelieferten Fahrzeug-Steigungsgrenze |
| --- | ---: | ---: | ---: | ---: |
| paved road | 1.00 | 1.00 | 1.00 | 1.00 |
| service road | 0.82 | 1.12 | 1.15 | 0.92 |
| track | 0.62 | 1.35 | 1.55 | 0.78 |
| offroad | 0.42 | 1.75 | 2.20 | 0.62 |

Die physische `safeLongitudinalSlopeDeg` wird dem Earth-Assessment von Engineering/Core übergeben. Earth multipliziert sie nur mit dem Route-Class-Faktor. Damit erfindet Earth keine Fahrzeuggrenze.

Offroad wird zusätzlich nach Boden/Landnutzung gewichtet:

- `open`: Basis-Offroadkosten,
- `vegetated`: langsamer, energie- und verschleißintensiver,
- `soft-ground`: nochmals stärkere Penalty,
- `water`, `built`, `protected`: blockiert,
- `unresolved`: nicht als befahrbar angenommen.

## Kurze nicht kartierte Facility-Zufahrt

OSM bildet nicht jede private/innerbetriebliche Zufahrt bis an einen NOXIA-Footprint ab. Deshalb gibt es einen engen Last-Mile-Fallback, **aber keine erfundene Straße**:

- Cargo Rover: höchstens 75 m,
- Heavy Hauler: höchstens 50 m,
- nur wenn das Offroad-Terrain für das Fahrzeug bereits als passierbar bewertet wurde,
- längere Lücken bleiben `unresolved` und benötigen beobachtete/gebaute Zufahrt oder bessere Daten.

Diese Werte sind Earth-Gameplay-Policy und können nach Playtests angepasst werden.

## Routing-Prinzip

Ein späterer Earth-Router soll vorhandene Segmentgeometrie gewichten, nicht neu erfinden:

1. befahrbare Straße bevorzugen,
2. geeignete Service-Straße/Track zulassen,
3. kurze Offroad-Verbindungen oder echte Offroad-Segmente nur mit Terrain-Assessment,
4. blockierte oder unaufgelöste Abschnitte nicht automatisch überbrücken,
5. Route als Segmentfolge mit `routeClass`, Distanz und relativen Kosten an UI/Core-Handoff geben.

Straße + Offroad dürfen in derselben Route vorkommen.

## Facility → Vehicle → Facility

Die fachliche Kette bleibt:

```text
Facility-/Lagerinventar (Core)
        ↓ reservieren/laden
Surface Vehicle (Core state)
        ↓ Earth route / traversal assessment
Ziel-Facility-/Lagerinventar (Core)
        ↓ entladen
Zielbestand (Core)
```

Earth muss dafür später in der UI zeigen:

- Quelle und Ziel,
- Gut/Menge,
- geeignete/verfügbare Fahrzeuge aus Core,
- Route mit Straßen-/Track-/Offroad-Segmenten,
- Distanz,
- ETA sobald absolute Fahrzeuggeschwindigkeit verfügbar ist,
- relative Energie-/Wear-Auswirkung,
- Transportzustand aus Core,
- konkrete Blocker.

## Raumhafen

`NOX:TER:SAUERLAND-SPACEPORT` bleibt ein Surface Shuttle Port. Der Earth-Anteil endet bei:

```text
Mine / Fabrik / Warenhaus
        ↓ Surface Vehicle
Raumhafen-Lager
        ↓ Core-Handover
Surface Transfer Shuttle
```

Orbitale Übergabe und intersolarer Transit werden nicht in Earth Surface Logistics implementiert.

## Automatische Regeln

Die Earth-UX darf später Regeln konfigurieren und visualisieren, z. B. Mindestbestand oder Schwellwerttransport. Regelmodell, Reservierung und Ausführung gehören jedoch in Core. Solange der Core-Vertrag fehlt, wird in Earth keine lokale Ersatz-State-Machine angelegt.

## Aktueller Implementierungsstand

Implementiert in `lib/game/earthSurfaceLogistics.ts`:

- OSM-Road-Klassifikation,
- Fahrzeugrollen-Suitability,
- Straßen-/Track-Kosten,
- Offroad-Landuse-/Ground-Klassifikation,
- Steigungsprüfung gegen gelieferten Fahrzeug-Envelope,
- relative Speed-/Energy-/Wear-Multiplikatoren,
- kurzer Last-Mile-Fallback,
- renderer-neutrale Labels/Assessment-Typen.

Noch blockiert durch Core:

- reales Inventar lesen/reservieren,
- Fahrzeugverfügbarkeit/-zuweisung,
- TransportJob anlegen,
- Laden/Transit/Entladen persistieren,
- laufende Jobs queryen,
- automatische Regeln ausführen.

## References

- `external-tasks/open/EXT-NOXIA-EARTH-20260911-surface-logistics.md`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-surface-transport-job-contract.md`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-orbit-cargo-transfer-core.md`
- `lib/game/earthSurfaceLogistics.ts`
- `lib/game/moonSurfaceLogistics.ts`
- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/world/spatial/overpassEarthFeatureSource.ts`
