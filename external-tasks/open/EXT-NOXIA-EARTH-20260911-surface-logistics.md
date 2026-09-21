---
id: EXT-NOXIA-EARTH-20260911-SURFACE-LOGISTICS
title: Earth Surface Logistics – Straßen, Offroad, Fahrzeuge, Lager und Raumhafen
status: open
source: NOXIA-CORE
target: NOXIA-EARTH
created: 2026-09-11
priority: high
affects: [NOXIA, Earth, Core, Logistics, Transport, UX]
---

## Ausgangspunkt

NOXIA führt mit dem gemeinsamen Game Core eine physische Logistikkette ein. Produktionsgebäude sollen Güter künftig nicht mehr nur abstrakt an einer Location ablegen. Der Core modelliert objektbezogene Bestände, Fahrzeugfracht, Transportaufträge, Ownership sowie persistierte Zustandsübergänge.

Dieser Request betrifft ausschließlich die **Earth-spezifische Oberflächenlogistik und deren UX**. Datenmodell, Persistenz, Supabase, atomare Commands, Ownership, Economy, Scheduler/Ticks und gemeinsame Transportzustände bleiben Eigentum von `NOXIA-CORE`.

**Earth implementiert keine eigene Backend-Logik.** Falls ein benötigter Core-Vertrag, Command oder Query fehlt, bitte diesen als konkreten Handoff/Dependency an `NOXIA-CORE` zurückmelden, statt eine lokale Ersatz-API oder Earth-spezifische Tabelle einzuführen.

## Auftrag

Für die spielbare Erde ausarbeiten und in die bestehende Earth-Karten-/Cockpit-Architektur integrieren:

### 1. Reale Straßen und Wege

- vorhandene OSM-Straßen/-Wege als bevorzugtes Surface-Routing verwenden,
- Straßentypen für Fahrzeugklassen sinnvoll klassifizieren,
- bestehende Earth-/OSM-Layer wiederverwenden,
- keine zweite unabhängige Straßen- oder Routing-Geometrie neben der vorhandenen Kartenarchitektur aufbauen.

### 2. Offroad-Fahrbarkeit

- Offroad nur dort zulassen, wo Terrain, Steigung und Boden-/Landnutzung dies plausibel erlauben,
- vorhandene Elevation-, Slope-, Relief-, Buildability- und Landuse-Daten soweit möglich wiederverwenden,
- Earth liefert dafür ausschließlich **Surface-Policy/Traversal-Costs**; Fahrzeugzustand, Auftrag und Persistenz kommen aus dem Core,
- Route soll Straße und Offroad kombinieren können, wenn dies sinnvoll und zulässig ist.

### 3. Gebäude ↔ Fahrzeug ↔ Lager

Die Earth-UX muss die gemeinsame Core-Logistik sichtbar und bedienbar machen:

```text
Gebäudeinventar
    ↕ Laden / Entladen
Fahrzeugfracht
    ↕ Transport
Lager / Fabrik / Mine / Logistik-Hub / Raumhafenlager
```

Erforderlich sind:

- Auswahl von Quelle und Ziel,
- sichtbare verfügbare Güter/Mengen,
- Auswahl eines geeigneten Fahrzeugs bzw. automatische Fahrzeugzuweisung über den Core,
- Laden, Fahrt, Entladen als verständliche Zustände,
- Route, Distanz, erwartete Fahrzeit und Kapazität in der UI,
- klare Darstellung blockierter Aufträge, z. B. kein Fahrzeug, keine Kapazität oder keine befahrbare Route.

### 4. Raumhafen als Oberflächen-Umschlagpunkt

Der planetare Raumhafen ist gemäß Core-Semantik ein **Surface Shuttle Port** und kein Terminal für intersolare Schiffe.

Earth soll ihn deshalb als Umschlagkette darstellen:

```text
Mine / Fabrik / Warenhaus
        ↓ Surface Transport
Raumhafen-Lager
        ↓ Laden
Surface Transfer Shuttle
        ↓
Orbital Interface
        ↓
Intersolar / Inter-Node Transport
```

Die Earth-Seite endet fachlich am Surface-Port-/Shuttle-Handover. Orbitaler und intersolarer Transit bleibt außerhalb dieses Requests.

### 5. UX für manuelle und automatische Transporte

Bitte eine kompakte, spielbare UX vorsehen:

**Manuell**

- Gebäude/Lager auswählen,
- `Transport` starten,
- Ziel wählen,
- Gut/Menge wählen,
- Fahrzeug wählen oder automatisch zuweisen,
- Route und ETA prüfen,
- Auftrag absenden.

**Automatisch**

Ein Gebäude/Lager kann eine Transportregel erhalten, zum Beispiel:

```text
Wenn Kupfererz > 20 t
→ bringe bis zu 15 t zur Raffinerie
→ bevorzugt verfügbare geeignete LKW
```

oder:

```text
Halte im Raumhafenlager mindestens 40 t Wasser vor.
```

Earth implementiert hierfür nur Bedienung, Visualisierung und Earth-spezifische Routeneignung. Regelmodell, Transportjob, Reservierung, Inventarmutation und Ausführung gehören in den Core.

### 6. Kartenintegration

Auf der Earth-Karte sollen bei aktivem Transportkontext sichtbar werden können:

- Source-/Destination-Knoten,
- berechnete Route,
- Straßen- und Offroad-Abschnitte,
- Fahrzeugposition bzw. laufender Auftrag,
- Raumhafen-/Lager-Umschlagpunkte,
- Warnungen bei unpassierbaren Abschnitten.

Die Darstellung soll die vorhandene Earth-Karte erweitern und keinen separaten Logistik-Kartenmodus erzwingen.

## Earth-spezifische Policy, die definiert werden soll

Bitte konkrete Regeln/Parameter vorschlagen für:

- nutzbare OSM highway/path-Klassen je Fahrzeugklasse,
- maximale Offroad-Steigung je Fahrzeugtyp,
- Terrain-/Landuse-Ausschlüsse,
- Geschwindigkeits-/Zeitfaktoren Straße vs. Offroad,
- minimale Anforderungen an Zufahrt zu Mine, Fabrik, Lager und Raumhafen,
- Umgang mit fehlenden OSM-Daten,
- Fallback bei kurzen nicht kartierten Zufahrten zwischen Gebäude und nächster Straße.

Diese Werte sind **Earth-Policy**, nicht globales Core-Balancing.

## Abgrenzung – ausdrücklich nicht in Earth implementieren

- neue Supabase-Tabellen für Inventare, Fahrzeugfracht oder Transportjobs,
- neue serverseitige Earth-Mutations-API,
- eigene Ownership-/Actor-Semantik,
- eigene Economy-/Ledger-Logik,
- eigener Tick-/Scheduler,
- eigene persistierte Transport-State-Machine,
- eigene Reservierungslogik für Güter oder Fahrzeuge,
- interplanetare oder orbitale Transitlogik,
- alternative Backend-Lösung, falls ein Core-Contract noch fehlt.

Fehlende Core-Funktionen bitte als Dependency/Handoff dokumentieren.

## Erwartetes Ergebnis

- Earth-spezifische Surface-Routing-/Offroad-Policy,
- Liste der benötigten OSM-/Terrain-/Layerdaten,
- Entscheidung, welche vorhandenen Earth-Layer direkt wiederverwendet werden,
- fachlich vollständige Gebäude ↔ Fahrzeug ↔ Lager-Kette,
- Raumhafen als Surface-Umschlagpunkt,
- UX für manuelle und automatische Transporte,
- Kartenintegration für Route und Transportstatus,
- Liste fehlender Core-Contracts/APIs als Rückgabe an `NOXIA-CORE`,
- keine Earth-eigene Backend-Parallelarchitektur.

## Acceptance Criteria

1. reale OSM-Straßen/-Wege werden als bevorzugtes Routingnetz genutzt,
2. Offroad-Fahrbarkeit berücksichtigt mindestens Terrain/Steigung und geeignete Earth-Daten,
3. Facility → Vehicle → Facility ist inklusive Laden/Entladen und sichtbaren Zuständen vollständig beschrieben,
4. Lager sind echte Umschlagknoten der gemeinsamen Core-Logistik,
5. Raumhafen ist als Surface-Shuttle-Umschlagpunkt mit Lager-Handover abgebildet,
6. manuelle Transporte sind in der Earth-UX vollständig bedienbar,
7. automatische Transportregeln sind UX-seitig vorgesehen,
8. Earth erzeugt keine eigenen Supabase-Tabellen, Scheduler oder Mutations-APIs für diese Funktion,
9. fehlende Core-Verträge werden als Handoff dokumentiert statt lokal dupliziert,
10. Lösung bleibt über gemeinsame Core-Schnittstellen mit Moon/Mars kompatibel.

## Fortschritt 2026-09-13

### Umgesetzt auf `main`

**PR #106 – Earth Surface Policy**

- `lib/game/earthSurfaceLogistics.ts`,
- OSM-Road-Klassifikation für bestehende `highway`-/`surface`-/`access`-Properties,
- `paved-road`, `service-road`, `track`, `offroad`, `unresolved`,
- gemeinsame Rollen `cargo-rover` und `heavy-hauler`,
- relative Speed-/Energy-/Wear-Kosten,
- Offroad-Ground-/Landuse-Klassifikation,
- Steigungsprüfung gegen Engineering/Core-Mobility-Envelope,
- kurzer Last-Mile-Fallback ohne erfundene Straßen.

**PR #116 – realer OSM-Surface-Router**

- `lib/game/earthSurfaceRouting.ts`,
- ephemerer Graph direkt aus der vorhandenen OSM-Geometrie,
- kein zweites persistiertes Straßennetz,
- Snap auf Straßensegmente,
- Einbahnstraßen/Kreisverkehre,
- Dijkstra-Gewichtung nach Earth-Route-Class,
- kurze validierte Offroad-Zufahrten,
- Route als Segmentfolge + direkt zeichnbare Polyline,
- Distanz und relative Zeit-/Energy-/Wear-Kosten,
- eigener Earth-Routing-CI, der zusätzlich die gemeinsame Transport-Suite prüft.

**PR #117 – Core-live Earth Logistikcockpit**

- `app/earth/EarthSurfaceLogisticsConsole.tsx`,
- Einbindung in `app/earth/page.tsx`,
- liest ausschließlich `/api/game/logistics` und `/api/game/vehicles`,
- zeigt zugängliche Inventare, Fahrzeuge und persistierte TransportJobs,
- unterscheidet räumlich gebundene `tile_entity`-Inventare vom aggregierten Standortbestand,
- bindet physische Inventarknoten über `subject_type=tile_entity` / `subject_id=tile_entities.id` an Earth-Weltobjekte,
- kann zwischen vorhandenen räumlichen Knoten die Earth-OSM-Route prüfen,
- zeigt Distanz, Segmentklassen sowie relative Energy-/Wear-Faktoren,
- behandelt aggregierten `location_resources`-Bestand ausdrücklich **nicht** als physische Route-Quelle.

**Gemeinsamer Core-/Vehicle-Stand**

Inzwischen auf `main` vorhanden:

- gemeinsame Inventare und Reservierungen,
- persistente TransportJobs,
- Vehicle Instances und Fahrzeug-Inventare,
- Loading / Transit / Arrival / Unloading,
- Handover-/Multi-Leg-Grundlagen,
- physische Facility-Inventare und Facility-Output,
- gemeinsamer Surface-Mission-Planer (`surface-vehicle-route-v1`) für ETA, Cargo-Massenprüfung, absolutes Energiebudget und Wear-Settlement.

Der frühere Surface-Mission-Blocker aus PR #115 ist damit **erledigt**.

**PR #133 – gemeinsame Cargo-Mass- und Surface-Profile-Verträge**

- `lib/game/core/logisticsCargoMass.ts` löst Core-Logistikmengen nur mit **autoritativer** Massenbasis in den vorhandenen `VehicleCargoLoad`-Vertrag auf,
- autoritative `kg`/`t` können direkt aufgelöst werden,
- Stück-/Gebinde-/Gameplay-Einheiten benötigen einen autoritativen `massPerUnitKg`-Wert,
- `legacy-default`, unbekannte Einheiten und `game-unit` bleiben ausdrücklich `unresolved`,
- insbesondere wird der historische Datenbank-Default `resources.unit = 't'` **nicht** als physikalische Wahrheit behandelt; er wurde historisch auch auf nicht-massenartige Ressourcen wie `energy` angewandt,
- `lib/game/vehicles/surfaceProfileResolution.ts` löst einen persistierten `frameId` ausschließlich auf den exakten `VehicleFrame + SurfaceOperationProfile` auf,
- kein Rollen-, Namens- oder Ähnlichkeits-Fallback auf Test- oder Ersatzfahrzeuge,
- fehlende Engineering-Daten bleiben explizit `unresolved`,
- beide Resolver besitzen Regressionstests und einen gemeinsamen CI-Check.

Damit fehlt für diese beiden Punkte nicht mehr der gemeinsame Vertrag, sondern die jeweilige **autoritative Fach-/Integrationsdatenbasis**.

### Noch offene externe Datenabhängigkeiten

1. **Cargo-Massenbasis konkreter Commodities**

   KUEPER Engineering hat die Massenbasis unter der stabilen Task-ID
   `EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS` mit `engineering-commodities-r1.json`
   geliefert (siehe Kommentar in `lib/game/core/logisticsCargoMassAuthority.ts`);
   die ID wird in `CARGO_MASS_UNRESOLVED`-Antworten weiterhin an den Client gemeldet.
   Eine Handoff-Datei dazu liegt nicht in `external-tasks/open/` dieses Repositories
   (Stand 2026-09-21).

   Die gelieferte Basis bildet Engineering-Commodities bewusst **nicht** auf
   NOXIA-Gameplay-IDs und nicht auf die historische Einheit `t` ab. Offen ist
   deshalb der NOXIA-seitige Schritt: eine explizite, belastbare Zuordnung in
   `LOGISTICS_CARGO_MASS_AUTHORITIES`.

   NOXIA wird dafür keine Dichte, Verpackungsmasse oder kg-pro-`game-unit` erfinden. Abstrakte Ressourcen wie `energy`, `metal` oder `components` müssen bei Bedarf zunächst auf eine konkrete physische Transportform abgebildet werden.

2. **Kanonische Earth-Fahrzeugdaten**

   Benötigt werden die produktiven Earth-Werte für `VehicleFrame` und
   `SurfaceOperationProfile` für mindestens `cargo-rover` und `heavy-hauler`;
   NOXIA übernimmt keine bisherigen Testwerte als Produktivwerte.

   Die früher hier genannte Handoff-Datei
   `external-tasks/open/EXT-NOXIA-ENG-20260913-earth-surface-logistics-vehicles.md`
   ist in `external-tasks/open/` dieses Repositories nicht vorhanden (Stand
   2026-09-21) — der Handoff ist damit nicht belegbar und ggf. neu anzulegen. Im
   Code sichtbar ist das Mond-Gegenstück `EXT-NOXIA-ENG-20260911-LUNAR-SURFACE-LOGISTICS`
   (`app/api/game/moon/surface-transport/readiness/route.ts`).

### Parallel laufend – nicht duplizieren

PR #119 (`feat: show live surface vehicle progress`) ist beim letzten Abgleich weiterhin offen und übernimmt die read-only Visualisierung persistierter Surface-Fahrten aus `transport_jobs.started_at` / `arrives_at`.

Earth baut deshalb keinen zweiten Progress-/Tick-/Positionsmechanismus. Nach Merge dieses PRs kann dessen normierter Fortschritt später auf die persistierte bzw. im RouteSnapshot verfügbare Earth-Polyline projiziert werden.

### Nächster Earth-Integrationspfad

Sobald konkrete Cargo- und Fahrzeugdaten autoritativ auflösbar sind, soll das bestehende Cockpit den bereits vorhandenen gemeinsamen Pfad schließen:

```text
physische Earth-Facility-Inventare
→ Quelle / Ziel
→ Gut / Menge
→ resolveLogisticsCargoMass
→ Fahrzeug
→ resolveSurfaceVehicleProfile
→ OSM-/Offroad-Route
→ gemeinsamer Surface-Mission-Plan
→ Core TransportJob
→ Loading
→ Fahrt / Arrival
→ Unloading
→ Route und Status in vorhandener Earth-Karte
```

Bis dahin darf die Earth-UX die fehlenden Voraussetzungen sichtbar als `unresolved`/blockiert diagnostizieren, aber keine Ersatzwerte einsetzen.

Anschließend folgen automatische Transportregeln. Persistenz, Reservierung und Ausführung dieser Regeln bleiben Core-owned.

Der Request bleibt daher `open`; die bereits abgeschlossenen Earth- und Core-Bausteine werden nicht neu implementiert.

## Fortschritt 2026-09-21

### Umgesetzt auf dem Task-/PR-Branch

**Kartenintegration für Route und Transportstatus**

- `lib/game/earthTransportOverlay.ts` projiziert den Transportkontext renderer-neutral in zeichenbare Geometrie (Knoten, geplante und laufende Routen, Fahrzeugpunkt, Warnungen),
- `lib/store/earthTransportOverlayStore.ts` teilt diese Projektion zwischen den Earth-Panels; es ist **keine** zweite Datenquelle für Inventare, Fahrzeuge, Jobs oder Routen,
- `app/earth/EarthRegionPreview.tsx` zeichnet einen zusätzlichen Layer `transport` auf der bestehenden OSM-/Terrain-Karte: Route-Class-Styling, Knotenmarker (`facility`, `depot`, `spaceport-storage`, `surface-port`), Fahrzeugpunkt und ein Warnbanner,
- `app/earth/EarthSurfaceLiveMap.tsx` veröffentlicht laufende Core-Fahrten aus der persistierten `route_snapshot.geometry` + `earthSpatialOrigin`; der Fortschritt wird in ≈5-%-Schritten veröffentlicht, damit die Karte nicht sekündlich neu rendert,
- `app/earth/EarthSurfaceLogisticsConsole.tsx` veröffentlicht die aktuell vorbereitete Route in denselben Layer,
- persistierte Fahrten werden bewusst mit `routeClass: null` gezeichnet: der gemeinsame Snapshot speichert keine Segmentklassen, Earth erfindet sie nicht,
- fehlende Geometrie/fehlender Bezugsursprung erzeugen eine sichtbare Warnung statt einer Ersatzroute.

**Gebäude ↔ Fahrzeug ↔ Lager-Kette und Raumhafen-Umschlag**

- `lib/game/earthSurfaceHandover.ts` klassifiziert die Core-Inventare (`inventory_kind` + `metadata.role`) als planetare Oberflächenkette und bewertet den Raumhafen (`ready` / `storage-missing` / `surface-port-missing`),
- `app/earth/EarthSurfaceHandoverPanel.tsx` zeigt die Kette inklusive der Fahrzeuge, die laut `currentNodeInventoryId` vor Ort stehen, den Umschlagknoten und die Shuttle-Grenze,
- das Raumhafenlager ist ein echtes Core-`depot` mit `metadata.role = spaceport_storage`, die Pads sind `surface_port` mit `metadata.role = shuttle_port`; es entstehen keine neuen Tabellen.

**Automatische Transportregeln (UX-Vorschau)**

- `lib/game/earthTransportRulePreview.ts` wertet `surplus-transfer` / `minimum-stock` gegen den beobachteten Core-Bestand und die Earth-Route aus,
- das Panel zeigt Auslöser, Menge je Lauf, Routenstatus und Blocker — ohne Persistenz, Reservierung oder Ausführung,
- der fehlende Contract wird als `core-transport-rule-v1` benannt und an NOXIA-CORE gemeldet.

**Core-Rückgabe**

- `.kueper/outbox/20260921-earth-surface-logistics-core-contracts.md` listet die fehlenden Core-Verträge/APIs (`core-transport-rule-v1`, Frachtmasse je Commodity, kanonische Earth-Fahrzeugdaten) und die stabilen Schnittstellen, die Earth heute liest,
- `docs/design/earth-surface-logistics.md` beschreibt jetzt zusätzlich Layerdaten, Layer-Wiederverwendung, Kartenintegration, Kette und Regelvorschau.

**Keine Earth-Parallelarchitektur**

Es entstehen keine neuen Supabase-Tabellen, Scheduler, Mutations-APIs oder ein zweiter Fortschrittsmechanismus. Earth liest weiterhin nur `/api/game/build/spatial`, `/api/game/logistics`, `/api/game/vehicles` und die read-only OSM-/Terrain-Endpunkte.

### Weiterhin offen

1. **Frachtmasse je Commodity** — `logisticsCargoMassAuthority` ist leer, damit blockiert `surface-transport/cargo-readiness` jeden manuellen Transport mit `CARGO_MASS_UNRESOLVED`. Die Engineering-Basis ist geliefert (`EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS`, `engineering-commodities-r1.json`); offen ist der NOXIA-seitige Schritt, die Gameplay-ID-/Mengenbasis-Zuordnung in `LOGISTICS_CARGO_MASS_AUTHORITIES` (siehe „Noch offene externe Datenabhängigkeiten“).
2. **Kanonische Earth-Fahrzeugdaten** — ohne autoritative `VehicleFrame`-/`SurfaceOperationProfile`-Daten bleiben ETA, Energie und Wear `unresolved`; ein belegbarer Engineering-Handoff für Earth fehlt (siehe „Noch offene externe Datenabhängigkeiten“).
3. **Ausführung automatischer Regeln** — wartet auf `core-transport-rule-v1` in Core.

## References

- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/earthSurfaceLogistics.ts`
- `lib/game/earthSurfaceRouting.ts`
- `lib/game/earthSurfaceHandover.ts`
- `lib/game/earthTransportOverlay.ts`
- `lib/game/earthTransportRulePreview.ts`
- `lib/store/earthTransportOverlayStore.ts`
- `app/earth/EarthSurfaceLogisticsConsole.tsx`
- `app/earth/EarthSurfaceHandoverPanel.tsx`
- `app/earth/EarthSurfaceLiveMap.tsx`
- `docs/design/earth-surface-logistics.md`
- `.kueper/outbox/20260921-earth-surface-logistics-core-contracts.md`
- `lib/game/core/logistics.ts`
- `lib/game/core/logisticsCargoMass.ts`
- `lib/game/core/vehicleInstances.ts`
- `lib/game/vehicles/types.ts`
- `lib/game/vehicles/surfaceMission.ts`
- `lib/game/vehicles/surfaceProfileResolution.ts`
- `app/api/game/logistics/route.ts`
- `app/api/game/vehicles/route.ts`
- `lib/game/spatial/`
- `external-tasks/open/EXT-OTA-NOXIA-20260906-transfer-logistics-network.md`
- KUEPER Engineering: Massenbasis je Commodity unter der Task-ID `EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS` (geliefert als `engineering-commodities-r1.json`)
- KUEPER Engineering: produktive Earth-`VehicleFrame`-/`SurfaceOperationProfile`-Daten für `cargo-rover` und `heavy-hauler` (Handoff derzeit nicht als Datei in `external-tasks/open/` vorhanden)
- Mond-Gegenstück im Code: `EXT-NOXIA-ENG-20260911-LUNAR-SURFACE-LOGISTICS`
- Earth map/buildability implementation in the current `main` branch
