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

## References

- `lib/game/docking.ts`
- `lib/game/docking.test.ts`
- `lib/game/stationProfiles.ts`
- `docs/architecture/orbit-cargo-handover.md`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-orbit-cargo-transfer-core.md`
