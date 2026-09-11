---
id: EXT-NOXIA-CORE-20260911-DOCKING-PERSISTENCE
title: Core – Persistente Docking-Ports, Reservierung und Dock/Undock-Commands
status: open
source: NOXIA-ORBIT
target: NOXIA-CORE
created: 2026-09-11
priority: high
affects: [NOXIA, Core, Orbit, Stations, Ships, Docking]
---

## Ausgangspunkt

Orbit/Stations hat mit `lib/game/docking.ts` die kanonische Docking-Semantik definiert. Sie ist bewusst zustandslos/pure und trennt physische Docking-Verbindungen strikt von Cargo-Transfer.

Benötigt wird nun die gemeinsame Core-Persistenz und Command-Schicht. Orbit darf dafür keine eigene Backend-Domain aufbauen.

## Invarianten

1. Docking bewegt niemals automatisch Fracht.
2. Ein Port hat genau einen Zustand: `available | reserved | occupied | offline`.
3. Ein belegter Port referenziert höchstens ein Fahrzeug.
4. Eine Reservierung ist fahrzeuggebunden.
5. Ein Fahrzeug darf nicht gleichzeitig an zwei Ports als `docked` geführt werden.
6. Port- und Fahrzeugklasse müssen kompatibel sein.
7. Cargo-Transfer darf eine bestehende `docked`-Verbindung als physische Voraussetzung prüfen, bleibt aber ein separater Command.

## Benötigte Core-Fähigkeiten

Bitte eine persistente Repräsentation und atomare/idempotente Commands bereitstellen für:

- Ports einer Station / eines Depots,
- Portklasse (`shuttle | standard | heavy | service`),
- Portstatus,
- Reservierung für ein Schiff,
- aktive Docking-Verbindung,
- `reserveDockingPort`,
- `dockVessel`,
- `undockVessel`,
- optional `cancelDockingReservation`,
- Bereinigung abgelaufener Reservierungen.

## Erwartete Command-Prüfungen

### reserveDockingPort

- Station/Port existiert,
- Port ist verfügbar,
- Schiff befindet sich am passenden orbitalen Knoten bzw. in zulässiger Anflugphase,
- Schiffsklasse passt zum Port,
- keine konkurrierende Reservierung.

### dockVessel

- Port verfügbar oder für genau dieses Schiff reserviert,
- Schiff/Port kompatibel,
- Schiff ist nicht bereits anderweitig gedockt,
- atomarer Übergang auf `occupied` + aktive Docking-Verbindung.

### undockVessel

- Schiff belegt genau diesen Port,
- kein aktiver Vorgang blockiert das Abdocken, sofern Core solche Locks führt,
- atomare Freigabe von Verbindung und Port.

## API-/Datenmodell-Grenze

Orbit gibt keine konkrete Tabelle vor. Wichtig ist nur, dass UI/API eine kanonische Projektion bekommen können:

```ts
{
  stationSlug,
  ports: [
    {
      id,
      label,
      portClass,
      status,
      occupiedByVesselId?,
      reservedForVesselId?
    }
  ],
  connections: [
    {
      id,
      portId,
      vesselId,
      status
    }
  ]
}
```

## Integration mit Cargo

Der parallel offene Cargo-Core-Request darf für `vehicle ↔ station/depot` Transfers prüfen:

```text
active docking connection.status == docked
```

Diese Prüfung autorisiert nur den physischen Transferpfad. Ownership, Kapazität, Menge und eigentliche Inventaränderung bleiben Cargo-Verantwortung.

## Acceptance Criteria

1. Dockingzustand überlebt Reload/Session-Wechsel.
2. Zwei Schiffe können nicht denselben Port gleichzeitig belegen.
3. Ein Schiff kann nicht gleichzeitig an mehreren Ports gedockt sein.
4. Heavy-Frachter können nicht an inkompatiblen Ports anlegen.
5. Dock/Undock verändert keine Cargo-Mengen.
6. Cargo kann eine aktive Docking-Verbindung als separate Voraussetzung abfragen.
7. Implementierung nutzt den gemeinsamen Core und keine parallele Orbit-Zustandsmaschine.

## Core-Implementierungsstand — 2026-09-11

Die geforderte Docking-Persistenz ist im Repository bereits vollständig vorhanden. Der Request bleibt `open`, weil die maßgeblichen Docking-/Itinerary-Migrationen beim letzten Hosted-Check noch **nicht** in Production ausgerollt waren.

### Persistenz und Commands

`supabase/migrations/20260911070500_docking_and_multileg_logistics_core.sql` liefert:

- `docking_ports`,
- `docking_reservations`,
- `docking_connections`,
- `docking_commands`,
- eindeutige aktive Port-Reservierung,
- eindeutige aktive Schiff-Reservierung,
- eindeutige aktive Port-Belegung,
- eindeutige aktive Schiff-Belegung,
- Port-/Vessel-Class-Kompatibilität,
- Ablaufbereinigung von Reservierungen,
- `noxia_reserve_docking_port`,
- `noxia_dock_vessel`,
- `noxia_undock_vessel`,
- `noxia_cancel_docking_reservation`,
- `noxia_transfer_connected_cargo` als explizit getrennten Cargo-Command mit Docking-Voraussetzung.

Die Seed-Topologie enthält bereits persistente Ports für Phobos und Kepler/Prometheus.

### Application/API-Fassade

- `lib/game/core/dockingPersistence.ts`
- `app/api/game/docking/route.ts`

Die kanonische Projektion wird aus persistierten Ports, aktiven Reservierungen und aktiven Connections berechnet:

```text
available | reserved | occupied | offline
```

API-Aktionen:

```text
reserve
 dock
undock
cancel-reservation
```

Dock/Undock verändert dabei keine Cargo-Mengen.

### Integration mit Cargo und Multileg

`noxia_transfer_connected_cargo` verlangt eine aktive `docked`-Connection und einen cargo-fähigen Port, ruft anschließend aber den bestehenden atomaren `noxia_transfer_cargo` auf. Docking autorisiert damit lediglich die physische Verbindung; die Warenbewegung bleibt Logistics Core.

Zusätzlich vorhanden:

- `transport_job_legs`
- `transport_job_handovers`
- `supabase/migrations/20260911071200_atomic_transport_itinerary_definition.sql`

Damit bleiben Fahrzeugbewegung und Waren-Handover getrennt modelliert.

### Security-Hardening vor Hosted-Rollout

Neu:

- `supabase/migrations/20260911113700_docking_itinerary_security_hardening.sql`
- Commit `30a50c5bb7b109ec004531c7875eb48d17c8ac83`

Die serverseitigen Docking-/Itinerary-RPCs benötigen keine `SECURITY DEFINER`-Rechte, da die Application-Fassade sie ausschließlich über `service_role` aufruft. Das Hardening stellt sie auf `SECURITY INVOKER` um und sperrt auch die Helper-Funktionen explizit für `PUBLIC`, `anon` und `authenticated`; `service_role` erhält die benötigten Execute-Rechte explizit.

### Hosted-Status

Beim letzten Production-Abgleich endete die Supabase-Migrationshistorie bei:

```text
20260911101048 facility_inventory_provisioning_manual_core_rollout
```

Nicht in Hosted Production vorhanden waren insbesondere:

```text
20260911070500_docking_and_multileg_logistics_core.sql
20260911071200_atomic_transport_itinerary_definition.sql
20260911113700_docking_itinerary_security_hardening.sql
```

Daher ist die Docking-API zwar im deployten Code vorhanden, kann auf Production noch nicht als vollständig funktionsfähig abgenommen werden. Production wird nicht als Ersatz für eine Preview-Validierung verändert.

### Acceptance-Status

1. **erfüllt im Repo** — persistente Connections/Reservations überleben Reload/Session-Wechsel.
2. **erfüllt im Repo** — Partial Unique Index verhindert doppelte aktive Portbelegung.
3. **erfüllt im Repo** — Partial Unique Index verhindert mehrfaches aktives Docking eines Schiffs.
4. **erfüllt im Repo** — Vessel-/Port-Class-Kompatibilität wird vor Reserve/Dock geprüft.
5. **erfüllt im Repo** — Docking-Commands verändern keine Cargo-Mengen.
6. **erfüllt im Repo** — `noxia_transfer_connected_cargo` prüft aktive Docking-Verbindung separat.
7. **erfüllt im Repo** — gemeinsame Core-Persistenz/Fassade, keine Orbit-Parallellogik.

### Noch offen bis `done`

1. Migration `20260911070500` auf disposable Preview validieren.
2. Migration `20260911071200` in derselben Reihenfolge validieren.
3. Security-Hardening `20260911113700` anwenden.
4. Concurrency-/Idempotency-Tests für Reserve/Dock/Undock ausführen.
5. Cargo-Handover über aktive Connection testen und sicherstellen, dass Dock/Undock selbst Cargo unverändert lässt.
6. Danach kontrollierter Production-Rollout.
7. Live-Projektion für Phobos und Kepler prüfen und erst dann Request nach `external-tasks/done/` verschieben.

## References

- `lib/game/docking.ts`
- `lib/game/docking.test.ts`
- `lib/game/stationProfiles.ts`
- `lib/game/core/dockingPersistence.ts`
- `app/api/game/docking/route.ts`
- `docs/architecture/orbit-cargo-handover.md`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-orbit-cargo-transfer-core.md`
