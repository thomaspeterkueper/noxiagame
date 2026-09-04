# NOXIA Architecture Decision Request — Runtime Event Stream Boundary

**ID:** NOX-ARCH-20260901-runtime-event-stream-boundary  
**Datum:** 2026-09-01  
**Status:** done  
**Abgeschlossen:** 2026-09-04  
**Priorität:** blocker  
**Quelle:** NOXIA replay audit / PR #53  
**Ziel:** noxiagame

## Ergebnis

Die Runtime-Event-Grenze ist umgesetzt. Legacy `public.events` bleibt in seiner historischen Semantik bestehen. Der generalisierte NOXIA-Laufzeitstrom liegt in `public.simulation_events`; `public.entity_states` bleibt eigenständig und referenziert bei Bedarf `simulation_events(id)`.

Die eigentliche Implementierung wurde mit PR #55 (`fix(db): restore migration replay and separate runtime simulation events`) gemergt. Der TypeScript-Writer sowie die autoritativen Build-/Entity-Writer verwenden `simulation_events`; die KG-Projektionsfelder liegen ausschließlich auf `simulation_events`/`entity_states`. PR #53 wurde anschließend freigegeben und gemergt.

Bei der erneuten Abnahme am 2026-09-04 wurden zusätzlich zwei doppelte lokale Supabase-Migrationsversionen gefunden. Die redundanten generischen No-op-Bridges `20260825153850_remote_history_bridge.sql` und `20260825205323_remote_history_bridge.sql` wurden entfernt; die jeweils spezifischen History-Alignment-Marker derselben Remote-Version bleiben erhalten. Dadurch gibt es für diese Produktionsversionen wieder genau eine lokale Migrationsidentität.

## Entscheidung

### 1. Legacy `public.events` bleibt bestehen

Die historische Tabelle wird nicht in-place auf die neue Semantik umgebaut und nicht gelöscht oder umbenannt. Bestehende Legacy-Leser und historische Daten bleiben davon unberührt.

### 2. Neuer Runtime-Stream

Kanonischer Tabellenname:

```text
public.simulation_events
```

`simulation_events` ist der append-only Laufzeitstrom für fachliche Zustandsänderungen der NOXIA-Simulation, darunter Build/Upgrade/Removal, Entity-State-Transitionen und weitere kanonische Simulationsereignisse.

### 3. `entity_states`

`public.entity_states` bleibt die eigenständige Zustandsprojektion/-historie von Simulationsentitäten. `source_event` referenziert den neuen Runtime-Stream und hängt nicht vom Legacy-`events`-Schema ab.

### 4. Governance-Grenze

```text
public.events
= Legacy-/historischer NOXIA-Eventbestand

public.simulation_events
= kanonischer NOXIA-Runtime-Event-Stream

public.entity_states
= Zustandsprojektion/-historie von Simulationsentitäten
```

NOXIA Runtime Events sind Simulationswahrheit. Sie werden nicht automatisch zu KG-/OTA-Kanon. Cross-System-Kanonisierung bleibt eine kontrollierte Projektion über die dafür definierte Grenze.

## Migrationsstrategie

- Legacy-`events` bleibt unverändert.
- Die neue Runtime-Struktur wird vorwärtsgerichtet und idempotent bereitgestellt.
- Bereits angewendete Produktionsmigrationen werden nicht semantisch umgeschrieben.
- Es gibt kein pauschales Backfill von `events` nach `simulation_events`.
- Neue Runtime-Writer verwenden `simulation_events`.
- Historische Legacy-Consumer dürfen weiterhin `events` lesen.

## Tests / Abnahme

- [x] Legacy-`events`, `simulation_events` und `entity_states` sind semantisch getrennt.
- [x] Production-Migration löscht oder verändert keine Legacy-Eventdaten.
- [x] Neuer Runtime-Writer schreibt in `simulation_events`.
- [x] Legacy-Consumer werden nicht pauschal auf den neuen Stream umgestellt.
- [x] Neue Runtime-Consumer verwenden `simulation_events` bzw. `entity_states`.
- [x] `entity_states.source_event` referenziert `simulation_events(id)`.
- [x] Build-/Entity-State-Schreibpfad wurde mit PR #55 auf den neuen Stream verdrahtet.
- [x] Forward-Compat-Migration `20260901123000_runtime_simulation_events_forward_compat.sql` ist im aktuellen Migrationsbestand vorhanden.
- [x] PR #53 wurde nach der Runtime-/Replay-Korrektur erneut bewertet und gemergt.
- [x] Bei der Abschlussprüfung gefundene doppelte lokale Migrationsversionen `20260825153850` und `20260825205323` wurden bereinigt.

## Implementierungsreferenzen

- PR #55: `fix(db): restore migration replay and separate runtime simulation events`
- Merge-Commit PR #55: `385110f707219c8019350f608bf4cd22f03b40b8`
- PR #53: Tharsis Hub Engineering Release, anschließend gemergt
- Abschlusskorrektur 2026-09-04:
  - `e874dc596aabd70f3da4f2d8951e8d7c0af67b0`
  - `ce9bc02dd20803f4f6c5bea773f230b91a99ba46`

## Begründung

Die Trennung vermeidet die riskante In-place-Konvertierung einer historischen Tabelle mit anderer Primärschlüssel- und Feldsemantik. Ein eigener, eindeutig benannter Runtime-Stream ist migrationssicherer und hält die Grenze **NOXIA Simulation Runtime ≠ automatisch KG/OTA-Kanon** explizit.