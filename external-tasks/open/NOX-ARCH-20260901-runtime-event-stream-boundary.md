# NOXIA Architecture Decision Request — Runtime Event Stream Boundary

**ID:** NOX-ARCH-20260901-runtime-event-stream-boundary  
**Datum:** 2026-09-01  
**Status:** open  
**Priorität:** blocker  
**Quelle:** NOXIA replay audit / PR #53  
**Ziel:** noxiagame

## Problem

Die Migration `20260831000000_noxia_events_entity_states.sql` (zuvor `20260831_noxia_events_entity_states.sql`) behandelt `public.events` als neuen generalisierten Runtime-Event-Stream mit UUID-ID und Feldern wie `event_type`, `subject_type`, `subject_id`, `payload` usw.

Im konsolidierten historischen Baseline-Stand existiert jedoch bereits `public.events` als Legacy-Tabelle mit inkompatibler Struktur (u. a. bigint-ID und historische Felder wie `type`/`payload`). Durch `CREATE TABLE IF NOT EXISTS` entsteht bei Fresh Replay **nicht** das gewünschte neue Schema. Folge-Migrationen erwarten danach Tabellen/Felder, die nicht existieren; Production besitzt aktuell ebenfalls die Legacy-`events`, aber noch keine `entity_states`.

Das ist eine echte Namens-/Migrationskollision und darf nicht durch weitere Reihenfolge- oder `IF NOT EXISTS`-Workarounds kaschiert werden.

## Entscheidung

### 1. Legacy `public.events` bleibt bestehen

Die historische Tabelle wird **nicht** in-place auf die neue Semantik umgebaut und **nicht** gelöscht/umbenannt, solange ihre bestehenden Leser, Daten und historische Bedeutung nicht vollständig migriert und abgenommen sind.

Grund: Sie ist bereits Teil der Produktions-/Baseline-Historie. Ein Schema-Austausch unter demselben Tabellennamen wäre unnötig riskant und vermischt zwei fachlich verschiedene Eventbegriffe.

### 2. Der neue generalisierte NOXIA-Runtime-Stream erhält einen eigenen Namen

Kanonischer Tabellenname für den neuen Stream:

```text
public.simulation_events
```

`simulation_events` ist der append-only Laufzeitstrom für fachliche Zustandsänderungen der NOXIA-Simulation.

Beispiele:
- Build/Upgrade/Removal
- Entity-State-Transition
- Scanner-/Discovery-relevante kanonische Laufzeitereignisse
- technische Systemereignisse, soweit sie Teil des Simulationszustands sind

Die bestehende `public.events`-Tabelle ist **kein Alias** dafür.

### 3. `entity_states` bleibt eigenständig

`public.entity_states` wird als eigene Tabelle für aktuelle bzw. historische Entity-Zustände angelegt. Sie darf auf `simulation_events.id` referenzieren, wenn eine Event-Referenz fachlich erforderlich ist.

Sie darf nicht vom Schema der Legacy-`events` abhängen.

### 4. Runtime-Writer werden umgestellt

Alle neuen Writer/Reader aus der generalisierten Runtime-Canon-Implementierung, die derzeit `events` im neuen Sinn benutzen, werden auf `simulation_events` umgestellt.

Nicht pauschal ändern:
- historische/legacy Leser von `public.events`;
- UI-/Realtime-Code, der nachweislich den alten Eventtyp konsumiert.

Vor jeder Änderung muss klar sein, welchen der beiden Eventbegriffe der jeweilige Consumer meint.

## Semantikgrenze

```text
public.events
= Legacy-/historischer NOXIA-Eventbestand
= bestehende Semantik erhalten

public.simulation_events
= neuer kanonischer NOXIA-Runtime-Event-Stream
= append-only fachliche Laufzeitereignisse

public.entity_states
= Zustandsprojektion/-historie von Simulationsentitäten
```

Diese Trennung verhindert außerdem eine falsche Gleichsetzung mit KG-/OTA-Kanonereignissen. NOXIA Runtime Events sind zunächst **Simulationswahrheit**. Eine spätere Projektion in KG/OTA erfolgt kontrolliert über die bereits definierte Runtime-Canon-Grenze und macht nicht jedes Gameplay-Event automatisch zu historischem Kanon.

## Migrationsstrategie

1. Die kollidierende neue Migration nicht länger versuchen lassen, `public.events` neu zu definieren.
2. Eine **neue, vorwärtsgerichtete Migration** anlegen, die `public.simulation_events` und `public.entity_states` deterministisch erzeugt.
3. Bereits veröffentlichte/angewendete Migrationen nicht erneut in-place semantisch umschreiben, wenn dadurch Production- und Fresh-Replay-Historie divergieren kann.
4. Runtime-Writer atomar auf `simulation_events` umstellen.
5. Legacy-`events` unverändert erhalten.
6. Fresh Replay von Baseline bis HEAD testen.
7. Produktionskompatibilität prüfen: vorhandene `events`-Daten bleiben unverändert; neue Tabellen dürfen leer starten, sofern keine bereits erzeugten neuen Runtime-Events verlustfrei migriert werden müssen.

## Kein automatisches Backfill

Es erfolgt **kein pauschales `INSERT ... SELECT` von `events` nach `simulation_events`**. Die Schemas repräsentieren unterschiedliche Semantik. Nur eindeutig als neue Runtime-Canon-Events identifizierbare Daten dürfen später durch eine explizite, getestete Migrationsregel übernommen werden.

## Tests / Abnahme

- [ ] Fresh Replay erstellt Legacy-`events`, `simulation_events` und `entity_states` ohne Namenskonflikt.
- [ ] Production-Migration löscht oder verändert keine Legacy-Eventdaten.
- [ ] Neuer Runtime-Writer schreibt ausschließlich in `simulation_events`.
- [ ] Legacy-Consumer lesen weiterhin `events`.
- [ ] Neue Runtime-Consumer lesen `simulation_events` bzw. `entity_states`.
- [ ] Keine neue Migration erwartet `events.subject_type`, `events.event_type` o. ä.
- [ ] Build/Entity-State-Schreibpfad funktioniert end-to-end.
- [ ] Full Supabase migration replay grün.
- [ ] PR #53 erst danach erneut bewerten/mergen.

## Begründung

Eine In-place-Konvertierung von `events` wäre technisch möglich, aber sie koppelt die neue Runtime-Architektur an eine historische Tabelle mit anderer Primärschlüssel- und Feldsemantik und erhöht das Datenverlustrisiko. Ein klar benannter neuer Stream ist migrationssicherer, fachlich eindeutiger und kompatibel mit der bereits definierten Grenze **Simulation Runtime ≠ automatisch KG/OTA-Kanon**.
