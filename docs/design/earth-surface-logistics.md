# Earth Surface Logistics

Status: Earth-Policy, OSM-basierter Surface-Router, Kartenintegration und
Oberflächen-/Raumhafenkette für `EXT-NOXIA-EARTH-20260911-SURFACE-LOGISTICS`.
Manuelle Transporte und automatische Regelvorschau sind UX-seitig vorhanden. Die
Massenbasis je Commodity hat KUEPER Engineering geliefert
(`EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS`, `engineering-commodities-r1.json`); offen
ist die NOXIA-seitige Zuordnung Gameplay-ID/Transportform → Massenbasis. Kanonische
Earth-Fahrzeugdaten (`VehicleFrame` + `SurfaceOperationProfile`) fehlen weiterhin.
Beides bleibt `unresolved` und wird nicht durch Defaults überbrückt.

## Zuständigkeit

Earth besitzt die planetenspezifische Interpretation von Karte und Gelände:

- OSM-Straßen/-Wege als bevorzugtes Routingnetz,
- Straßeneignung für Surface-Fahrzeugrollen,
- Offroad-Fallback,
- relative Traversal-Kosten für Zeit/Energie/Wear,
- kurze nicht kartierte Facility-Zufahrten,
- Routen- und Transportdarstellung in der Earth-UX.

Core besitzt Inventare, Reservierungen, Fahrzeugbelegung, TransportJob-Persistenz, Laden/Entladen, Scheduler/Ticks, Ownership und Economy. Der früher fehlende Vertrag aus `external-tasks/done/EXT-NOXIA-CORE-20260911-surface-transport-job-contract.md` ist inzwischen auf `main` technisch vorhanden: `lib/game/core/logistics.ts`, `app/api/game/logistics/route.ts`, der Vehicle-Instance-Core und die zugehörigen Supabase-Migrationen stellen die gemeinsame Transport-State-Machine bereit. Earth konsumiert diese Verträge und baut keine lokale Ersatzlogik.

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

Umgesetzt ist dieser Pfad in zwei Earth-Panels:

- `app/earth/EarthSurfaceLogisticsConsole.tsx` — Quelle/Ziel aus den Core-Inventaren, Gut/Menge aus dem Quell-Snapshot, Fahrzeugauswahl, Earth-Route prüfen, relative Kosten und Core-Blocker. Der Start läuft ausschließlich über den gemeinsamen Core-Pfad; die UI erfindet keine Fahrzeit und keine Buchung.
- `app/earth/EarthSurfaceMissionDraftPanel.tsx` — serverseitiger prospectiver Mission-Draft und Start.

Beide Panels diagnostizieren fehlende Voraussetzungen sichtbar als `unresolved`
(Cargo-Masse, Engineering-Profil, Fahrzeugstandort) und setzen **keine** Ersatzwerte ein.

## Gebäude ↔ Fahrzeug ↔ Lager-Kette

`lib/game/earthSurfaceHandover.ts` interpretiert die Core-Inventare als planetare
Oberflächenkette, ohne Core-Knoten umzubenennen:

```text
facility (Produktion/Verarbeitung, metadata.role = extraction|processing|production)
        ↓
depot (storage|logistics)
        ↓
spaceport_storage (depot mit metadata.role = spaceport_storage)
        ↓
surface_port (metadata.role = shuttle_port)
```

- `classifyEarthSurfaceNode` bildet `inventory_kind` + `metadata.role` auf die Kette ab; unbekannte Kinds bleiben `other`.
- `buildEarthSurfaceHandoverChain` gruppiert die tatsächlich geladenen Core-Inventare.
- `assessEarthSpaceportHandover` meldet `ready`, `storage-missing` oder `surface-port-missing` und benennt die Umschlaggrenze (`surface-port`).

`app/earth/EarthSurfaceHandoverPanel.tsx` zeigt diese Kette inklusive der Fahrzeuge,
die laut `currentNodeInventoryId` aktuell an einem Knoten stehen.

## Raumhafen

`NOX:TER:SAUERLAND-SPACEPORT` bleibt ein Surface Shuttle Port:

```text
Mine / Fabrik / Warenhaus
        ↓ Surface Vehicle
Raumhafen-Lager
        ↓ Core-Handover
Surface Transfer Shuttle
```

Das Raumhafenlager ist ein echtes Core-`depot` mit `metadata.role = spaceport_storage`,
die Shuttle-Pads sind Core-`surface_port`-Inventare mit `metadata.role = shuttle_port`
(siehe `supabase/migrations/20260911100200_facility_inventory_provisioning.sql`).
Earth endet fachlich am Surface-Port-/Shuttle-Handover. Orbitale Übergabe und
intersolarer Transit bleiben außerhalb dieses Earth-Moduls.

## Kartenintegration

`lib/game/earthTransportOverlay.ts` ist die renderer-neutrale Projektion des
Transportkontexts in zeichenbare Geometrie, `lib/store/earthTransportOverlayStore.ts`
transportiert sie zwischen den Panels. Die Earth-Karte selbst zeichnet weiterhin ihre
vorhandenen OSM-/Terrain-Layer und bekommt nur einen zusätzlichen Layer `transport`.

- Panels veröffentlichen ihren Beitrag (`nodes`, `planned`, `live`, `warnings`), die Karte mischt sie über `mergeEarthTransportOverlay`.
- Geplante Earth-Routen erscheinen mit ihrer Route-Class (durchgezogen für `paved-road`/`service-road`, gestrichelt für `track`/`offroad`); eine nicht freigegebene Route wird nicht gezeichnet, sondern als Warnung gemeldet.
- Persistierte Fahrten (`route_snapshot.geometry` + `earthSpatialOrigin`) werden mit `routeClass: null` gezeichnet: der gemeinsame Snapshot speichert bewusst keine Segmentklassen, Earth erfindet sie nicht.
- Der Fahrzeugpunkt kommt aus `deriveSurfaceMissionProgress` + `pointAlongSurfaceRoute`; das Panel veröffentlicht ihn nur in ≈5-%-Schritten, damit die Karte nicht sekündlich neu rendert.
- Fehlende Geometrie oder ein fehlender Bezugsursprung erzeugen eine Warnung im Kartenlayer statt einer Ersatzroute.

## Automatische Regeln

`lib/game/earthTransportRulePreview.ts` wertet eine Regelabsicht gegen den
**beobachteten** Core-Bestand und die Earth-Route aus (`surplus-transfer`,
`minimum-stock`): greift die Regel, welche Menge würde bewegt, ist die Route
freigegeben, welche Blocker bestehen. Es wird nichts gespeichert, nichts reserviert
und nichts ausgeführt.

Das persistente Regelmodell, seine Reservierung und seine Ausführung bleiben
Core-owned und fehlen als Contract `core-transport-rule-v1`; die Rückgabe an
NOXIA-CORE liegt in `.kueper/outbox/20260921-earth-surface-logistics-core-contracts.md`.
Earth führt keine eigene Regel-State-Machine und keinen eigenen Scheduler ein.

## Layerdaten

### Direkt wiederverwendete Earth-Layer

| Layer | Quelle | Verwendung für Surface-Logistik |
| --- | --- | --- |
| `infrastructure` (OSM-Straßen) | `/api/earth/region` (Overpass, read-only) | bevorzugtes Routingnetz, Route-Class-Klassifikation, Einbahnstraßen |
| `landuse` / OSM-Areal | dieselbe Antwort | Offroad-Bodenklassen (`open`, `vegetated`, `soft-ground`, blockierte Areale) |
| `water` | dieselbe Antwort | Offroad blockiert, keine erfundene Furt |
| `relief` (DEM/Hillshade) | `/api/earth/buildability` | Steigungsprüfung gegen die Fahrzeug-Steigungsgrenze |
| `slope` | `/api/earth/buildability` | Offroad-Eignung, Steigungsgrenze |
| `buildability` | `/api/earth/buildability` | blockiert bebaute/unzulässige Flächen für Offroad |
| `noxia` / `sites` | `/api/game/build/spatial`, `/api/earth/spaceport-candidates` | Facility-Footprints als Routenendpunkte, Raumhafenflächen |

Es wird **keine** zweite Straßen-, Terrain- oder Layerquelle eingeführt. Der OSM-Graph
existiert nur für die Dauer einer Routenberechnung.

### Daten, die für die Surface-Logistik zusätzlich nötig wären

- Fahrzeug-Steigungsgrenze und Referenzgeschwindigkeit je Frame (`SurfaceOperationProfile`) — Engineering; für Earth liegt dazu in `external-tasks/open/` dieses Repositories keine Handoff-Datei (Stand 2026-09-21),
- Zuordnung Gameplay-ID/Transportform → autoritative Masse je Commodity — die Massenbasis selbst liefert Engineering (`EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS`), die Zuordnung ist NOXIA-seitig offen,
- Verkehrsregeln jenseits von `oneway`/`access` (z. B. Gewichtsbeschränkungen) — derzeit nicht modelliert und **nicht** angenommen,
- saisonale/zeitliche Befahrbarkeit — nicht modelliert.

Diese Lücken bleiben `unresolved`; sie werden nicht durch Defaults überbrückt.

## References

- `external-tasks/open/EXT-NOXIA-EARTH-20260911-surface-logistics.md`
- `external-tasks/done/EXT-NOXIA-CORE-20260911-surface-transport-job-contract.md`
- `lib/game/core/logistics.ts`
- `app/api/game/logistics/route.ts`
- `app/api/game/vehicles/route.ts`
- `lib/game/vehicles/types.ts`
- `lib/game/earthSurfaceLogistics.ts`
- `lib/game/earthSurfaceRouting.ts`
- `lib/game/earthSurfaceHandover.ts`
- `lib/game/earthTransportOverlay.ts`
- `lib/game/earthTransportRulePreview.ts`
- `lib/store/earthTransportOverlayStore.ts`
- `app/earth/EarthSurfaceHandoverPanel.tsx`
- `app/earth/EarthSurfaceLogisticsConsole.tsx`
- `app/earth/EarthSurfaceLiveMap.tsx`
- `lib/world/spatial/overpassEarthFeatureSource.ts`
- `.kueper/outbox/20260921-earth-surface-logistics-core-contracts.md`
