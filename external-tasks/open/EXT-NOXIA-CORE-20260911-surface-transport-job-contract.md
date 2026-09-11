---
id: EXT-NOXIA-CORE-20260911-SURFACE-TRANSPORT-JOB-CONTRACT
title: Core-Vertrag für Surface Transport – Inventar, Reservierung, Fahrzeugzuweisung und TransportJob
status: open
source: NOXIA-EARTH
target: NOXIA-CORE
created: 2026-09-11
priority: high
affects: [NOXIA, Core, Earth, Moon, Mars, Logistics, Inventory, Transport]
---

## Ausgangspunkt

Earth implementiert `EXT-NOXIA-EARTH-20260911-SURFACE-LOGISTICS` und kann die planetenspezifische Routing-/Traversal-Policy sowie Karten-/UX-Darstellung selbst liefern.

Der aktuelle Core besitzt jedoch noch keinen ausreichend allgemeinen Vertrag, mit dem die Earth-UX einen realen Transport von einem Facility-Inventar über ein Fahrzeug zu einem zweiten Facility-/Logistikknoten anlegen, reservieren, ausführen und beobachten kann.

Dieser Request soll **keine Earth-Sonderlösung** schaffen. Er ergänzt bzw. generalisiert denselben gemeinsamen Core-Bereich, der auch in `EXT-NOXIA-CORE-20260911-orbit-cargo-transfer-core.md` für orbitale Cargo-Handover benötigt wird.

## Eigentumsgrenze

`NOXIA-CORE` bleibt Source of Truth für:

- Inventar und Cargo-Bestände,
- reservierte/verfügbare Mengen,
- Fahrzeugverfügbarkeit und Fahrzeugzuweisung,
- persistierte Transportaufträge,
- Laden / Transit / Ankunft / Entladen,
- atomare Zustandsübergänge,
- Ownership-/Actor-Prüfungen,
- Tick-/Scheduler-Ausführung.

World-spezifische Domains wie Earth/Moon/Mars liefern dagegen:

- Route bzw. Route-Assessment,
- Traversal-/Straßen-/Terrain-Policy,
- Distanz,
- relative Zeit-/Energie-/Wear-Kosten,
- lokale Passierbarkeit und Darstellungsinformationen.

Core darf dafür keine Earth-spezifische Straßenlogik kanonisieren.

## Benötigter gemeinsamer Vertrag

### 1. Inventarabfrage

Ein gemeinsamer Query-Vertrag muss für einen adressierbaren Logistics-/World-Knoten mindestens liefern können:

- vorhandene Güter,
- Gesamtmenge,
- bereits reservierte Menge,
- frei verfügbare Menge,
- Einheiten/Commodity-ID aus dem bestehenden Core-Kanon,
- Zugriffs-/Ownership-Information, soweit für den Spieler relevant.

Earth soll dafür keine eigene Inventartabelle und keine Earth-API anlegen.

### 2. TransportJob

Ein Surface-Transport muss als persistiertes Core-Objekt angelegt werden können mit mindestens:

- `sourceNodeId`,
- `destinationNodeId`,
- Commodity/Gut,
- Menge,
- optional gewünschtem `vehicleId`,
- World/Location-/Domain-Bezug,
- referenzierbarem Route-/Assessment-Snapshot oder dessen kanonischem Ergebnis,
- Actor/Owner,
- Erstellungs-/Start-/Ankunftszeiten.

Die konkrete Feldbenennung bleibt Core-Entscheidung. Wichtig ist ein gemeinsamer Vertrag, der auch Moon/Mars nutzen kann.

### 3. Reservierung

Vor Start muss Core atomar verhindern:

- doppelte Reservierung derselben Ware,
- doppelte Belegung desselben Fahrzeugs,
- Überbuchung der Fahrzeugkapazität,
- Start aus einem nicht zugänglichen/inkonsistenten Inventarzustand.

Benötigt werden klare Semantiken für:

- `available`,
- `reserved`,
- `loaded/in_vehicle`,
- `delivered` bzw. Zielinventar.

### 4. Fahrzeugzuweisung

Die aufrufende World-UX muss entweder:

- ein konkretes geeignetes Fahrzeug übergeben können,
- oder Core um automatische Auswahl aus einer bereits von der World-Domain als geeignet bewerteten Kandidatenmenge bitten können.

Core entscheidet Besitz, Verfügbarkeit, Kapazität und Belegung. Earth entscheidet Straßen-/Offroad-Eignung und Route.

### 5. Zustandsmaschine

Benötigt wird eine kleine gemeinsame TransportJob-State-Machine. Semantisch mindestens:

```text
planned/reserved
→ loading
→ in_transit
→ arrived
→ unloading
→ completed
```

plus definierte Fehler-/Abbruchzustände.

Die exakten State-Namen sind Core-Sache; sie müssen jedoch querybar sein, damit Earth die Phasen auf Karte und im Objektpanel darstellen kann.

### 6. Commands / Queries

Earth benötigt einen stabilen gemeinsamen Vertrag für mindestens:

- transportierbare Bestände an Quelle abfragen,
- verfügbare Fahrzeuge abfragen,
- TransportJob anlegen/reservieren,
- Transport starten,
- Jobstatus lesen,
- laufende Jobs für Location/Actor lesen,
- Transport abbrechen, sofern fachlich erlaubt.

Laden/Entladen und Inventarmutation dürfen nicht clientseitig zusammengesetzt werden, sondern müssen atomare Core-Operationen sein.

### 7. Route-Assessment-Handoff

Earth/Moon/Mars sollen dem Core ein validiertes Assessment übergeben können, ohne dass Core die World-Policy dupliziert. Benötigte semantische Informationen sind beispielsweise:

```text
routeId / routeRevision oder snapshot
world/location
distanceM
traversalMode / segment summary
eta oder relative time cost
energy cost / multiplier
wear cost / multiplier
passable
```

Absolute Fahrzeugwerte dürfen erst aus dem gemeinsamen Fahrzeug-/Engineering-Kanon kommen. World-Policy kann bis dahin relative Multiplikatoren liefern.

## Zusammenspiel mit orbitalem Request

Bitte `EXT-NOXIA-CORE-20260911-orbit-cargo-transfer-core.md` gemeinsam betrachten.

Surface- und Orbit-Transport sollen dieselben Grundprimitive für:

- Inventory,
- Reservation,
- Cargo Assignment,
- Vehicle Assignment,
- Transport Job Lifecycle

verwenden. Unterschiede gehören in Domain-/Handover-Policy, nicht in parallel erfundene Persistenzmodelle.

## Acceptance Criteria

1. Earth kann einen realen Facility → Vehicle → Facility-Transport anlegen, ohne eigene Backend-/Supabase-Logik.
2. Ware wird atomar reserviert und kann nicht doppelt verplant werden.
3. Fahrzeuge können nicht gleichzeitig inkompatibel/doppelt gebucht werden.
4. Laden, Transit, Ankunft und Entladen sind persistierte/querybare Core-Zustände.
5. Earth kann die Zustände in Karte/UX darstellen.
6. World-spezifisches Routing bleibt außerhalb des Core.
7. Derselbe Vertrag ist für Moon/Mars wiederverwendbar.
8. Der Vertrag lässt sich mit dem orbitalen Cargo-Handover ohne zweites Inventar-/Jobmodell kombinieren.

## Rückgabe an Earth

Bitte nach Umsetzung dokumentieren:

- kanonische Typen/Schemas,
- Commands/Queries/API-Pfade,
- TransportJob-State-Namen,
- Reservierungssemantik,
- Fahrzeugzuweisungsvertrag,
- Route-Assessment-Payload,
- Commit/PR,
- verbleibende Blocker.

## References

- `external-tasks/open/EXT-NOXIA-EARTH-20260911-surface-logistics.md`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-orbit-cargo-transfer-core.md`
- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/moonSurfaceLogistics.ts`
