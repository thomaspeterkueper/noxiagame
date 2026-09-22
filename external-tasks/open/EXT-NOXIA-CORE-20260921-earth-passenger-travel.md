---
id: EXT-NOXIA-CORE-20260921-EARTH-PASSENGER-TRAVEL
title: Earth Passenger Travel – terrestrische Fernreise zu Weltankern
status: open
source: NOXIA-EARTH
target: NOXIA-CORE
created: 2026-09-21
priority: high
affects: [NOXIA, Earth, Core, Travel, Passenger, Landmarks, WorldObject, ArrivalNode, Immersive, UX]
---

## Ausgangspunkt

NOXIA besitzt bereits zwei getrennte, kanonische Transportpfade:

1. orbitale/interplanetare Reise über `LandingOverlay` / `gameStore.travel()` mit Schiff, Energie, Reichweite und Orbitalzeit;
2. Earth-Surface-Logistik über physische Facility-Inventare, persistierte Vehicle Instances, OSM-Routing und Core-`transport_jobs`.

Zusätzlich existieren auf `/earth` kanonische Real-World-Landmarks und Cross-Universe-Weltanker. Ein Landmark kann bereits einen realen regionalen Earth-Ausschnitt öffnen. Das ist bewusst nur Navigation/Fokus und noch keine simulierte Personenreise.

Die bestehende Surface-Logistik darf nicht für Landmark-Besuche missbraucht werden: Ein Landmark ist weder automatisch ein Frachtinventar noch ein `tile_entity`-Depot. Ebenso darf die interplanetare `travel()`-Authority nicht für terrestrische Fernreisen verwendet werden.

Der Passenger-Vertrag soll zugleich die spätere immersive Nutzung vorbereiten: Eine Reise endet fachlich nicht nur an einer Koordinate, sondern an einer referenzierbaren Weltobjekt-/Arrival-Node-Identität. Erst nach bestätigter Ankunft darf ein lokaler, site- oder interior-basierter Immersive Space übernommen werden.

## Auftrag an NOXIA Core

Bitte einen gemeinsamen Vertrag für **terrestrische Personen-/Besuchsreisen auf einem Himmelskörper** definieren. Er soll zunächst Earth bedienen, aber so geschnitten sein, dass Moon/Mars später denselben Core-Lifecycle nutzen können.

### 1. Reise-Intent

Der Client soll nur Intent senden, mindestens:

- Actor / Spieler,
- Quell-World-Point oder kanonischer Startknoten,
- Ziel als stabile WorldObject-/Landmark-/Facility-Referenz,
- gewünschte Mobilitätsklasse (`road`, `rail`, `air`, später `mixed`),
- optionale Präferenzen wie Kosten/Zeit/Komfort, falls Core dafür später Werte besitzt.

Eine Zielkoordinate darf nur abgeleitete Routinginformation sein. Sie darf die Objektidentität nicht ersetzen.

Keine Client-ETA, keine Client-Kosten und keine Client-Routenphysik dürfen autoritativ sein.

### 2. Persistenter Reise-Lifecycle

Benötigt wird ein eigener Passenger-Travel-Lifecycle oder eine sauber generalisierte gemeinsame Journey-Abstraktion. Minimalzustände:

```text
planned -> boarding -> in_transit -> arrived
                     -> cancelled / failed
```

Die bestehende Cargo-`transport_jobs`-State-Machine darf nur wiederverwendet werden, wenn Semantik, Reservierungen und Handover wirklich passen. Bitte keinen Cargo-Job mit Dummy-Fracht erzeugen.

### 3. World-owned Routing

Core besitzt Journey/Persistenz/Actor/Status. Die Welt liefert Route und Traversal-Assessment:

- Earth: reale Straßen/Schienen/Luftkorridore bzw. Transit-Hubs;
- Moon/Mars später: Surface-Routen und Habitat-/Port-Verbindungen.

Earth darf weiterhin OSM und eigene Surface-Policy besitzen. Core soll nur einen validierten Route-/Leg-Snapshot übernehmen.

### 4. Multi-Leg-Fernreise

Für weite Earth-Ziele muss der Vertrag mehrere Legs unterstützen, z. B.:

```text
SSF Sundern
-> Straße/Bahn zum Fernverkehrsknoten
-> Hochgeschwindigkeitsbahn oder Flug
-> lokaler Anschluss
-> ESA/ESOC Darmstadt
```

oder später:

```text
Alexandria
-> Airport/Rail Hub
-> Langstrecke
-> Regionalanschluss
-> Dvārakā
```

Ein Leg braucht mindestens Modus, Start, Ziel, Distanz/ETA, Status und einen world-owned Route-Snapshot/Provider-Verweis.

### 5. Landmark-, WorldObject- und Arrival-Node-Semantik

Ein Landmark ist ein **Zielanker**, aber nicht automatisch ein logistischer Knoten.

Core soll daher Zielreferenzen akzeptieren, die eine stabile Objekt-/Landmark-ID besitzen, ohne dafür ein Inventory zu verlangen. Der aktuelle Earth-seitige Intent-Vertrag ist bewusst minimal:

```ts
{
  worldObject: {
    kind: 'earth-landmark',
    id: 'earth-de-darmstadt-esoc'
  },
  arrival: {
    mode: 'resolve-canonical-arrival-node',
    nodeId: null,
    authority: 'server-required'
  }
}
```

Wichtig:

- Landmark-Viewpoints aus der UI sind derzeit nur Navigationskoordinaten und nicht automatisch Persistenzautorität.
- Vor produktivem Reise-Start muss Core/Earth das Ziel auf einen kanonisch akzeptierten `arrivalNode` auflösen.
- Der `arrivalNode` ist ein Zugangspunkt, nicht zwingend der Mittelpunkt des WorldObjects.
- Bei realen Institutionen kann das z. B. ein Eingangs-/Transit-Hub sein; bei großflächigen historischen Orten ein definierter Besucher-/Regionsanker.
- Ein WorldObject kann mehrere Arrival Nodes besitzen, etwa Bahnhof, Straßenankunft, Hafen, Besucherzentrum oder Haupteingang.
- Routing wählt einen Arrival Node; die WorldObject-Identität bleibt davon unabhängig stabil.

### 6. Immersive-Space-Handoff

Der Journey-Vertrag soll bereits einen **optionalen Handoff nach erfolgreicher Ankunft** vorsehen, ohne heute Innenräume oder Szenen zu erfinden.

Semantik:

```text
Journey target WorldObject
        ↓
server resolves Arrival Node
        ↓
Journey completes: arrived
        ↓
World validates local/immersive context
        ↓
regional-space | site-space | interior-space
```

Der Earth-seitige Intent setzt deshalb aktuell ausdrücklich:

```ts
immersiveHandoff: {
  mode: 'after-arrival',
  spaceId: null,
  authority: 'world-object-required'
}
```

Regeln:

- `spaceId` darf nicht vom Landmark-Map-Client erfunden werden.
- Der Journey-State muss `arrived` sein, bevor ein Arrival-Handoff den Actor in einen Immersive Space überführt.
- Ein Ziel darf auch ohne Immersive Space vollständig bereisbar sein.
- Ein späterer Immersive Space kann eine regionale Szene, eine archäologische Site-Zone, ein Campus, ein Gebäude oder ein Interior sein.
- Derselbe WorldObject-/Arrival-Node-Vertrag soll für Spieler und NPCs verwendbar sein.
- Das Handoff darf Ereignisse auslösen (`arrived_at`, `entered_site`, `entered_interior`), ohne den Journey-State mit der lokalen Szenensimulation zu vermischen.

Damit kann NOXIA später z. B. `Alexandria -> Arrival Node -> lokaler Stadt-/Museumsraum` oder `Senckenberg -> Eingang -> Archiv-/Interior-Kontext` abbilden, ohne die Travel-Architektur neu zu schneiden.

### 7. Zeit, Kosten und Fahrzeuge

Keine erfundenen Werte.

Core soll die Felder und Provenienz aufnehmen können; konkrete Werte kommen aus Engineering/World/Transit-Daten:

- Fahrzeug/Verkehrsmittel bzw. Serviceklasse,
- Geschwindigkeit/Fahrplanmodell,
- Energie,
- Ticket-/Nutzungskosten,
- Kapazität,
- Störungen/Verfügbarkeit.

Bis solche Daten autoritativ vorliegen, muss der Journey-Draft fail-closed oder als rein planender/ungefähren Modus markiert bleiben.

### 8. API-Vertrag

Gewünscht ist mindestens:

- `POST .../journey/draft` – server-autoritatives Routing/ETA/Readiness ohne Mutation,
- `POST .../journey/start` – idempotenter Start mit `commandId`,
- `GET .../journey` – aktive/letzte Reise des Spielers,
- optional cancel/replan als klar getrennte Commands,
- nach `arrived` eine getrennte World-Abfrage/Transition zur Auflösung eines optionalen Immersive Space.

Die API soll sich an den bereits robusten Earth-Surface-Mission-Draft-/Start-Mustern orientieren: Intent rein, vollständige Revalidierung vor Mutation, idempotenter Command.

## Acceptance Criteria

1. Landmark-/Facility-Ziele können ohne Inventory-Zwang als Personenreiseziel modelliert werden.
2. Journey-Ziele besitzen eine stabile WorldObject-/Objektreferenz; Koordinaten ersetzen diese Identität nicht.
3. Ein kanonischer Arrival Node wird server-/world-autoritativ aufgelöst und besitzt nachvollziehbare Provenienz.
4. Cargo-Transport und Passenger-Travel bleiben semantisch getrennt.
5. Orbital/interplanetare `travel()`-Logik wird nicht für Earth-Fernreise missbraucht.
6. World-Domain bleibt Eigentümer von Route/Passierbarkeit; Core bleibt Eigentümer von Journey-State/Persistenz.
7. Multi-Leg-Reisen sind im Datenmodell vorgesehen.
8. Draft und Start sind server-autoritativ; Clientwerte sind nicht vertrauenswürdig.
9. `commandId`/Idempotenz ist vorgesehen.
10. Ein optionaler Immersive-Handoff ist erst nach `arrived` zulässig und benötigt eine world-/WorldObject-autoritativ aufgelöste Space-Referenz.
11. Ein Ziel ohne Immersive Space bleibt ein gültiges Reiseziel.
12. Der Vertrag ist später für Moon/Mars sowie Spieler/NPCs erweiterbar.
13. Keine Dummy-Fracht, keine künstlichen Inventarknoten und keine zweite Earth-eigene Persistenz entstehen.

## Aktuelle Earth-Seite

Bereits vorhanden und nicht neu bauen:

- `lib/world/spatial/earthLandmarks.ts`
- `lib/world/spatial/earthLandmarkJourney.ts`
- `app/earth/EarthLandmarkMap.tsx`
- `app/earth/EarthLandmarkRegionFocus.tsx`
- `/api/earth/region?lat=...&lon=...`
- Earth-Surface-Cargo-Logistik einschließlich autoritativem Draft/Start
- orbitale/interplanetare `LandingOverlay`-/`travel()`-Authority

## Rückgabe

Bitte nach Umsetzung den kanonischen Journey-Typ, WorldObject-Zieltyp, Arrival-Node-Vertrag, API-Vertrag, Persistenzzustand, Idempotenzregel, erwartete World-Routing-Schnittstelle und den optionalen post-arrival Immersive-Handoff dokumentieren. Danach kann Earth die Landmark-UI von `regional focus` auf `Reise planen` und später auf `Ort betreten` erweitern, ohne bestehende Transportpfade zu duplizieren.
