---
id: EXT-NOXIA-CORE-20260911-SURFACE-TRANSPORT-JOB-CONTRACT
title: Core-Vertrag für Surface Transport – Inventar, Reservierung, Fahrzeugzuweisung und TransportJob
status: done
source: NOXIA-EARTH
target: NOXIA-CORE
created: 2026-09-11
completed: 2026-09-11
priority: high
affects: [NOXIA, Core, Earth, Moon, Mars, Logistics, Inventory, Transport]
---

## Auftrag

Earth benötigt einen gemeinsamen, weltkörperunabhängigen Core-Vertrag, um reale Facility → Vehicle → Facility-Transporte anzulegen, zu reservieren, auszuführen und zu beobachten. Earth/Moon/Mars liefern Routing-/Traversal-Policy und lokale Geometrie; Core bleibt Source of Truth für Inventar, Reservierungen, Fahrzeuge, TransportJobs, Ownership und persistierte Zustandsübergänge.

Der Request durfte ausdrücklich **keine Earth-Sonderlösung** schaffen und sollte dieselben Grundprimitive verwenden, die auch Orbit-Cargo benötigt.

## Kanonischer Core-Vertrag

### Inventar

Der gemeinsame Logistics Core liefert adressierbare Inventare mit:

- Commodity/Resource,
- physischem Gesamtbestand,
- reservierter Menge,
- frei verfügbarer Menge,
- Ownership-/Access-Information,
- räumlicher Bindung über Location bzw. physisches Subject.

Geeignete physische World-Facilities werden über die kanonische Bindung adressiert:

```text
storage_kind = native
subject_type = tile_entity
subject_id = tile_entities.id
```

### TransportJob

Persistierte Transportaufträge enthalten Quelle, Ziel, Commodity, Menge, Fahrzeugzuweisung, Actor/Owner, World-/Location-Kontext, Route-/Assessment-Snapshot sowie Erstellungs-, Start- und Ankunftszeiten.

### Reservierung und Fahrzeugzuweisung

Core verhindert atomar:

- doppelte Warenreservierung,
- Überbuchung verfügbarer Mengen,
- doppelte aktive Fahrzeugzuweisung,
- Überschreitung der Fahrzeugkapazität,
- Start aus nicht zugänglichen oder inkonsistenten Inventaren.

World-Domains bewerten Route und Traversal-Eignung. Core entscheidet Besitz, Zugriff, Verfügbarkeit, Kapazität und Belegung.

### Persistierter Lifecycle

Die Transport-State-Machine bildet die beobachtbaren Phasen ab:

```text
planned / reserved
→ loading
→ in_transit
→ arrived
→ unloading
→ completed
```

Abbruch-/Fehlerzustände bleiben ebenfalls persistiert. Loading und Unloading werden nicht clientseitig übersprungen.

### Route-Assessment-Handoff

World-Domains können ein validiertes Assessment an Core übergeben, u. a. mit:

```text
routeId / routeRevision oder Snapshot
world / location
distanceM
traversalMode / segment summary
eta / relative time cost
energy cost / multiplier
wear cost / multiplier
passable
```

Core dupliziert keine Earth-/Moon-/Mars-spezifische Straßen-, Terrain- oder Traversal-Logik.

## Implementierung

Der gemeinsame Vertrag ist auf `main` umgesetzt über insbesondere:

- `lib/game/core/logistics.ts`
- `app/api/game/logistics/route.ts`
- `lib/game/core/vehicleInstances.ts`
- `app/api/game/vehicles/route.ts`
- persistierte Vehicle-Cargo-Inventare
- atomare Reservations-/TransportJob-Commands
- Loading-/Unloading-Kommandos
- ETA-basierte Transit-Abwicklung
- gemeinsame Handover-/Multi-Leg-Grundlagen
- `lib/game/earthSurfaceRouting.ts` als Earth-spezifische Routing-/Traversal-Schicht

Damit verwenden Surface und Orbit dieselben Inventory-/Reservation-/Transport-Grundprimitive; Unterschiede bleiben Domain- bzw. Handover-Policy.

## Facility-Inventar-Provisionierung

Der letzte Core-Blocker war die body-agnostische Provisionierung physischer Facility-Inventare. Sie ist in

`supabase/migrations/20260911100200_facility_inventory_provisioning.sql`

implementiert, ursprünglicher Implementierungscommit:

`9e1cbbd8e2c2b74e75b181e7fa208d6137fd3cf5`.

Die Migration ergänzt:

- `facility_inventory_policies` als gemeinsamen Policy-Katalog,
- `noxia_ensure_facility_inventory(tile_entity_id)` als idempotenten Helper,
- einen `AFTER INSERT`-Hook auf `tile_entities`, sodass World-Entity und Inventar im selben PostgreSQL-Transaktionskontext materialisiert werden,
- einen idempotenten Backfill existierender geeigneter Facilities,
- gemeinsame Policy-Klassen `facility`, `depot` und `surface_port`,
- private Defaults für player-owned Inventare und Policy-basierte Public-Rechte für nicht-player-owned Infrastruktur.

Energieerzeuger werden nicht automatisch zu Cargo-Lagern. Kapazitäten bleiben bewusst `NULL`, solange Engineering/Balancing keinen kanonischen Wert vorgibt; es wurden keine Tonnagen aus Beschreibungstexten abgeleitet.

## Preview- und Production-Rollout

Die Facility-Provisionierung wurde nach disposable-preview-Validierung auf Production ausgerollt. Production führt den Rollout unter Migration-History-Version

`20260911101048 / facility_inventory_provisioning_manual_core_rollout`.

Der Repo-History-Bridge-Commit `544fed37849d40f956c380b580a05735c192f136` dokumentiert die Zuordnung zur kanonischen Fresh-Rebuild-Migration `20260911100200_facility_inventory_provisioning.sql`; `20260911101048_remote_history_bridge.sql` bleibt absichtlich ein No-op.

Live-Verifikation nach Rollout:

- `facility_inventory_policies` vorhanden,
- `noxia_ensure_facility_inventory(uuid)` vorhanden,
- 19 aktive Facility-Inventory-Policies,
- Earth: 4 `depot`, 3 `facility`, 3 `surface_port`,
- Mars: 1 `depot`, 3 `facility`, 1 `surface_port`,
- Moon: 1 `depot`, 10 `facility`, 1 `surface_port`,
- Phobos: 1 `depot`, 1 `surface_port`.

Die zuvor vorhandenen Moon-Bindungen wurden dabei nicht überschrieben; der vorab geprüfte Backfill hatte 0 Inventory-Kind-Konflikte.

## Acceptance Criteria – Abschluss

1. **Erfüllt:** Earth kann Facility → Vehicle → Facility über den gemeinsamen Logistics Core abbilden, ohne eigenes Backend-/Supabase-Modell.
2. **Erfüllt:** Warenreservierungen sind atomar und verhindern Doppelverplanung.
3. **Erfüllt:** Fahrzeugbelegung/Kapazität werden Core-seitig validiert.
4. **Erfüllt:** Loading, Transit, Arrival und Unloading sind persistierte/querybare Zustände.
5. **Erfüllt:** Earth kann die Core-Zustände in Karte/Cockpit projizieren.
6. **Erfüllt:** World-spezifisches Routing bleibt außerhalb des Core.
7. **Erfüllt:** derselbe Vertrag ist für Moon/Mars wiederverwendbar.
8. **Erfüllt:** Orbit-Handover baut auf denselben Inventory-/Reservation-/Transport-Primitiven auf; Docking/Cargo-spezifische Folgearbeiten bleiben eigene Core-Requests.
9. **Erfüllt:** geeignete Earth-Facilities besitzen nun dieselbe kanonische räumliche `tile_entity`-Inventarbindung wie andere World-Domains.

## Rückgabe an Earth

Earth kann jetzt den gemeinsamen Core als Source of Truth verwenden. Für UI und Routing gelten weiterhin die World-spezifischen Earth-Schichten; Inventar, Reservierungen, Fahrzeugzustände und TransportJob-Lifecycle kommen aus Core.

Der Surface-Transport-Core ist damit abgeschlossen. Offene Orbit-Markt-/Custody- und Docking-Persistence-Themen werden in ihren separaten Requests weitergeführt und sind kein Blocker mehr für diesen Contract.

## References

- `external-tasks/open/EXT-NOXIA-EARTH-20260911-surface-logistics.md`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-orbit-cargo-transfer-core.md`
- `lib/game/core/logistics.ts`
- `lib/game/core/vehicleInstances.ts`
- `app/api/game/logistics/route.ts`
- `app/api/game/vehicles/route.ts`
- `lib/game/logisticsNodes.ts`
- `lib/game/transportDomains.ts`
- `lib/game/moonSurfaceLogistics.ts`
- `supabase/migrations/20260911100200_facility_inventory_provisioning.sql`
- `supabase/migrations/20260911101048_remote_history_bridge.sql`
