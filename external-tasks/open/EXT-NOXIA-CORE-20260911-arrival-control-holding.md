---
id: EXT-NOXIA-CORE-20260911-ARRIVAL-CONTROL-HOLDING
title: Core – Arrival Control, Holding Queue und Transit→Docking-Zwischenzustand
status: open
source: NOXIA-ORBIT
target: NOXIA-CORE
created: 2026-09-11
priority: high
affects: [NOXIA, Core, Orbit, Stations, Transit, Docking, Phobos]
---

## Ausgangspunkt

Der aktuelle Transit-Core kennt für `ships.status` nur `docked | transit`. Nach Fälligkeit ruft `settleDuePlayerTransit()` direkt `noxia_complete_transit` auf; die Projektion fällt danach wieder auf `docked` zurück.

Das ist für echte Stationsankünfte fachlich zu grob: Ein Schiff kann den Phobos-/Stationsknoten erreicht haben, ohne bereits einen physischen Docking-Port zu belegen.

Orbit hat deshalb in `lib/game/arrivalControl.ts` die kanonische Zwischenkette definiert:

```text
intersolar-transit
→ arrival-rendezvous
→ holding
→ approach
→ docked
→ departing
```

## Fachliche Invarianten

1. Transit-Ende bedeutet **Ankunft am orbitalen Knoten**, nicht automatisches Docking.
2. `holding` ist ein Rendezvous-/Traffic-Control-Zustand im lokalen Bezugsraum, kein impliziter stabiler Phobos-Orbit.
3. `approach` setzt eine konkrete Portzuweisung/Reservierung voraus.
4. Erst `docked` besitzt eine physische Docking-Connection.
5. Cargo-Transfer bleibt bis `docked` gesperrt.
6. Queue-/Holding-Zustand muss Reload/Session-Wechsel überleben.
7. Arrival Control darf keine zweite, vom vorhandenen Transit- und Docking-Core getrennte Zustandsmaschine werden.

## Benötigte Core-Erweiterung

Bitte den bestehenden Transit-/Docking-Core so erweitern, dass eine fällige Stationsankunft nicht direkt als `docked` materialisiert wird.

Benötigt wird mindestens ein persistierbarer Arrival-Zustand oder eine äquivalente kanonische Projektion für:

- `arrival-rendezvous`,
- `holding`,
- `approach`,
- Zielstation,
- Holding-Zone,
- Queue-Position bzw. stabile Sortierinformation,
- Holding-Grund,
- optional Zielport/aktive Reservierung.

Die konkrete Tabelle/Feldstruktur bleibt Core-owned.

## Erwarteter Ablauf

### Transit completion

Für eine Station/Free-Port-Destination wie Phobos oder Kepler:

```text
transit due
→ location = destination node
→ phase = arrival-rendezvous
→ falls kein sofort nutzbarer/reservierbarer Port: holding
→ Portreservierung
→ approach
→ dockVessel
→ docked
```

Für Oberflächen-/Legacy-Ziele darf bestehendes Verhalten erhalten bleiben, bis deren Arrival-Semantik separat migriert wird.

### Holding Queue

Die Queue soll serverautoritativ sein. Minimale Anforderungen:

- stabile Reihenfolge (z. B. `queue_entered_at`, anschließend ID),
- keine doppelte aktive Queue-Teilnahme desselben Schiffs am selben Knoten,
- passende Holding-Zone nach Vessel-Class,
- Heavy Traffic separat behandelbar,
- bei freiem kompatiblen Port darf genau ein geeignetes Schiff zur Reservierung/`approach` weitergeschaltet werden,
- kein Client darf durch Reload seine Position verlieren oder verbessern.

## Phobos-Holding-Zonen aus Orbit

Kanonische gameplay-facing Zonen:

```text
phobos-h-light     surface-transfer-shuttle / service
phobos-h-standard  intersolar-standard
phobos-h-heavy     intersolar-heavy
```

Diese Zonen sind Verkehrs-/Rendezvous-Korridore im Phobos-/Mars-Bezugssystem und keine Aussage über drei stabile physische Umlaufbahnen um Phobos.

## Integration mit bestehender Docking-Persistenz

Bereits vorhanden:

- `docking_ports`
- `docking_reservations`
- `docking_connections`
- `reserveDockingPort`
- `dockVessel`
- `undockVessel`

Arrival Control soll diese Schicht **nutzen**, nicht duplizieren.

`approach` sollte erst möglich werden, wenn eine gültige Portreservierung bzw. äquivalente serverseitige Portzuweisung existiert.

## API-/Projection-Bedarf

Die UI benötigt mindestens eine Projektion dieser Art:

```ts
{
  shipId,
  stationSlug,
  phase: 'arrival-rendezvous' | 'holding' | 'approach' | 'docked',
  holdingZoneId?: string | null,
  holdingReason?: string | null,
  queuePosition?: number | null,
  targetPortId?: string | null,
}
```

Optional hilfreich:

- Anzahl wartender Schiffe vor dem Spieler,
- reservierter Port,
- Reservierungsablauf,
- estimated release/clearance nur wenn serverseitig belastbar.

## Acceptance Criteria

1. Ein bei Phobos fälliger Transit wird nicht mehr automatisch als physisch `docked` behandelt.
2. Schiff kann persistent `holding` sein.
3. Reload ändert Queue-Position nicht willkürlich.
4. Heavy-/Standard-/Shuttle-Klassen können getrennte Holding-Zonen nutzen.
5. `approach` verlangt konkrete Portfreigabe/Reservierung.
6. Nur `docked` erlaubt Connected-Cargo-Transfer.
7. Dock/Undock- und Cargo-Invarianten bleiben unverändert.
8. Bestehende Transit- und Docking-Core-Schichten werden erweitert, nicht parallel ersetzt.

## References

- `lib/game/arrivalControl.ts`
- `lib/game/arrivalControl.test.ts`
- `lib/game/core/transit.ts`
- `lib/game/core/commands.ts`
- `lib/game/core/dockingPersistence.ts`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-docking-persistence.md`
- `external-tasks/open/EXT-NOXIA-CORE-20260911-orbit-cargo-transfer-core.md`
