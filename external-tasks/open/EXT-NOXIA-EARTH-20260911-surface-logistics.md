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

## Fortschritt 2026-09-11

### Umgesetzt auf `main`

**PR #106 – Earth Surface Policy**

- `lib/game/earthSurfaceLogistics.ts`
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
- behandelt aggregierten `location_resources`-Bestand ausdrücklich **nicht** als physische Route-Quelle,
- vollständiger Next/Vercel-Preview war READY.

### Core-Vertrag inzwischen weitgehend vorhanden

Der ursprüngliche Handoff `EXT-NOXIA-CORE-20260911-SURFACE-TRANSPORT-JOB-CONTRACT` ist inzwischen größtenteils umgesetzt:

- gemeinsame Inventare,
- Reservierungen,
- persistente TransportJobs,
- Vehicle Instances und Fahrzeug-Inventare,
- Loading / Transit / Arrival / Unloading,
- gemeinsame APIs,
- Handover-/Multi-Leg-Grundlagen.

PR #113 (`Core: physical facility output inventories`) ist inzwischen gemerged und führt die physische Facility-Produktion in native Facility-Inventare ein. Der produktive Cutover ist aktuell jedoch bewusst zunächst auf Moon/Shackleton beschränkt.

### Verbleibende Abhängigkeiten vor vollständig spielbarem Earth-Transport

1. **Earth-Facility-Inventare im Core**

   Geeignete Earth-`tile_entities` (Mine, Fabrik, Depot/Warenhaus, Surface Shuttle Port usw.) müssen über denselben gemeinsamen Core-Mechanismus native, räumlich gebundene Inventare erhalten. Dieser Restpunkt ist im bestehenden Core-Handoff dokumentiert; Earth erzeugt dafür keine eigene Tabelle oder Provisionierung.

2. **Gemeinsamer Surface-Mission-Slice**

   PR #115 (`feat: add playable surface vehicle mission slice`) ist zum letzten Abgleich weiterhin offen. Er besitzt die gemeinsame Verantwortung für:

   - ETA aus Vehicle-Referenzgeschwindigkeit × World-Routenfaktor,
   - Cargo-Massenprüfung,
   - absolutes Energiebudget,
   - Wear-Settlement,
   - `surface-vehicle-route-v1` RouteSnapshot für den Core-TransportJob.

   Earth dupliziert diese Logik nicht. Sobald #115 auf `main` verfügbar ist, kann das bestehende Earth-Cockpit den validierten OSM-Route-Plan zusammen mit dem gewählten Fahrzeug in den gemeinsamen Mission-/TransportJob-Flow übergeben.

### Danach verbleibender Earth-Scope

```text
physische Earth-Facility-Inventare
→ Quelle/Ziel/Gut/Menge im bestehenden Cockpit
→ geeignetes Fahrzeug
→ OSM-/Offroad-Route
→ gemeinsamer Surface-Mission-Plan (ETA/Energie/Wear)
→ Core TransportJob
→ Loading / Fahrt / Arrival / Unloading sichtbar
→ Route/Status direkt in vorhandener Earth-Karte darstellen
```

Anschließend folgen automatische Transportregeln. Persistenz und Ausführung dieser Regeln bleiben Core-owned.

Der Request bleibt daher `open`; die bereits abgeschlossenen Earth-Bausteine werden nicht neu implementiert.

## References

- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/earthSurfaceLogistics.ts`
- `lib/game/earthSurfaceRouting.ts`
- `app/earth/EarthSurfaceLogisticsConsole.tsx`
- `docs/design/earth-surface-logistics.md`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-surface-transport-job-contract.md`
- `lib/game/core/logistics.ts`
- `lib/game/core/vehicleInstances.ts`
- `app/api/game/logistics/route.ts`
- `app/api/game/vehicles/route.ts`
- `lib/game/spatial/`
- `external-tasks/open/EXT-OTA-NOXIA-20260906-transfer-logistics-network.md`
- Earth map/buildability implementation in the current `main` branch
