---
id: EXT-NOXIA-CORE-20260921-EARTH-PASSENGER-TRAVEL
title: Earth Passenger Travel – terrestrische Fernreise zu Weltankern
status: open
source: NOXIA-EARTH
target: NOXIA-CORE
created: 2026-09-21
priority: high
affects: [NOXIA, Earth, Core, Travel, Passenger, Landmarks, UX]
---

## Ausgangspunkt

NOXIA besitzt bereits zwei getrennte, kanonische Transportpfade:

1. orbitale/interplanetare Reise über `LandingOverlay` / `gameStore.travel()` mit Schiff, Energie, Reichweite und Orbitalzeit;
2. Earth-Surface-Logistik über physische Facility-Inventare, persistierte Vehicle Instances, OSM-Routing und Core-`transport_jobs`.

Zusätzlich existieren auf `/earth` kanonische Real-World-Landmarks und Cross-Universe-Weltanker. Ein Landmark kann bereits einen realen regionalen Earth-Ausschnitt öffnen. Das ist bewusst nur Navigation/Fokus und noch keine simulierte Personenreise.

Die bestehende Surface-Logistik darf nicht für Landmark-Besuche missbraucht werden: Ein Landmark ist weder automatisch ein Frachtinventar noch ein `tile_entity`-Depot. Ebenso darf die interplanetare `travel()`-Authority nicht für terrestrische Fernreisen verwendet werden.

## Auftrag an NOXIA Core

Bitte einen gemeinsamen Vertrag für **terrestrische Personen-/Besuchsreisen auf einem Himmelskörper** definieren. Er soll zunächst Earth bedienen, aber so geschnitten sein, dass Moon/Mars später denselben Core-Lifecycle nutzen können.

### 1. Reise-Intent

Der Client soll nur Intent senden, mindestens:

- Actor / Spieler,
- Quell-World-Point oder kanonischer Startknoten,
- Ziel als kanonischer World-Point bzw. Landmark-/Facility-Referenz,
- gewünschte Mobilitätsklasse (`road`, `rail`, `air`, später `mixed`),
- optionale Präferenzen wie Kosten/Zeit/Komfort, falls Core dafür später Werte besitzt.

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

### 5. Landmark-Semantik

Ein Landmark ist ein **Zielanker**, aber nicht automatisch ein logistischer Knoten.

Core soll daher Zielreferenzen akzeptieren, die eine stabile Objekt-/Landmark-ID plus aufgelösten World-Point besitzen, ohne dafür ein Inventory zu verlangen.

Wichtig:

- Landmark-Viewpoints aus der UI sind derzeit nur Navigationskoordinaten und nicht automatisch Persistenzautorität.
- Vor produktivem Reise-Start muss Core/Earth den Zielpunkt auf einen kanonisch akzeptierten Ankunftspunkt auflösen.
- Bei realen Institutionen kann das z. B. ein Eingangs-/Transit-Hub sein; bei großflächigen historischen Orten ein definierter Besucher-/Regionsanker.

### 6. Zeit, Kosten und Fahrzeuge

Keine erfundenen Werte.

Core soll die Felder und Provenienz aufnehmen können; konkrete Werte kommen aus Engineering/World/Transit-Daten:

- Fahrzeug/Verkehrsmittel bzw. Serviceklasse,
- Geschwindigkeit/Fahrplanmodell,
- Energie,
- Ticket-/Nutzungskosten,
- Kapazität,
- Störungen/Verfügbarkeit.

Bis solche Daten autoritativ vorliegen, muss der Journey-Draft fail-closed oder als rein planender/ungefähren Modus markiert bleiben.

### 7. API-Vertrag

Gewünscht ist mindestens:

- `POST .../journey/draft` – server-autoritatives Routing/ETA/Readiness ohne Mutation,
- `POST .../journey/start` – idempotenter Start mit `commandId`,
- `GET .../journey` – aktive/letzte Reise des Spielers,
- optional cancel/replan als klar getrennte Commands.

Die API soll sich an den bereits robusten Earth-Surface-Mission-Draft-/Start-Mustern orientieren: Intent rein, vollständige Revalidierung vor Mutation, idempotenter Command.

## Acceptance Criteria

1. Landmark-/Facility-Ziele können ohne Inventory-Zwang als Personenreiseziel modelliert werden.
2. Cargo-Transport und Passenger-Travel bleiben semantisch getrennt.
3. Orbital/interplanetare `travel()`-Logik wird nicht für Earth-Fernreise missbraucht.
4. World-Domain bleibt Eigentümer von Route/Passierbarkeit; Core bleibt Eigentümer von Journey-State/Persistenz.
5. Multi-Leg-Reisen sind im Datenmodell vorgesehen.
6. Draft und Start sind server-autoritativ; Clientwerte sind nicht vertrauenswürdig.
7. `commandId`/Idempotenz ist vorgesehen.
8. Zielpunkt-Provenienz ist nachvollziehbar; UI-Viewpoints werden nicht automatisch kanonische Reiseziele.
9. Der Vertrag ist später für Moon/Mars erweiterbar.
10. Keine Dummy-Fracht, keine künstlichen Inventarknoten und keine zweite Earth-eigene Persistenz entstehen.

## Aktuelle Earth-Seite

Bereits vorhanden und nicht neu bauen:

- `lib/world/spatial/earthLandmarks.ts`
- `app/earth/EarthLandmarkMap.tsx`
- `app/earth/EarthLandmarkRegionFocus.tsx`
- `/api/earth/region?lat=...&lon=...`
- Earth-Surface-Cargo-Logistik einschließlich autoritativem Draft/Start
- orbitale/interplanetare `LandingOverlay`-/`travel()`-Authority

## Rückgabe

Bitte nach Umsetzung den kanonischen Journey-Typ, API-Vertrag, Persistenzzustand, Idempotenzregel und die erwartete World-Routing-Schnittstelle dokumentieren. Danach kann Earth die Landmark-UI von `regional focus` auf `Reise planen` erweitern, ohne bestehende Transportpfade zu duplizieren.
