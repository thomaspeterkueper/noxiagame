# NOXIA Game-Observation-Producer v0.1

Stand: 24.08.2026  
Protokoll: `kueper-ecosystem/docs/architecture/GAME_OBSERVATION_TASK_PROTOCOL.md`

## Zweck

NOXIA wirkt als evidenzproduzierender Sensor für das KUEPER Ecosystem.
Runtime-Gameplay und autonome Tester (NOXIA_TESTER_INTELLIGENT_01) können
reproduzierbare Spiel-Anomalien gebündelt in Cross-Project-Requests überführen —
**ohne** dass Game-Events direkt Repositories verändern.

Grenze:

```text
Game Action -> Observation -> Evidence -> TaskCandidate -> Gate -> Ecosystem Request
```

Eine Game Action erzeugt NIE direkt einen Implementierungs-Task.

## Module

| Modul | Aufgabe |
|---|---|
| `lib/game/observation/types.ts` | Protokoll-Typen, Finding-Lifecycle, Kosten-/Prioritäts-Mapping |
| `lib/game/observation/fingerprint.ts` | Stabile Fingerprints (2× FNV-1a-32, ES2017, deterministisch) |
| `lib/game/observation/sink.ts` | Lokaler Sink: Aufnahme, Aggregation, Gate, Lifecycle, Persistenz |
| `lib/game/observation/producer.ts` | TaskCandidate → KUEPER-Outbox-Envelope, Datei-Writer, Assertion-Brücke |
| `lib/game/observation/observationProducer.test.ts` | Deterministische Regressionstests |

## Ablauf

1. **Aufnahme** — `producer.ingest(observation, nowMs)` aggregiert über den
   Fingerprint der zugrunde liegenden Bedingung (`kind + system + summary`).
   Welt und Agent gehen nicht in den Fingerprint ein; Vorkommen derselben
   Bedingung in mehreren Welten zählen zusammen.
2. **Gate** (v0.1) — nur `BUG` und `DEAD_END` steigen nach EINEM
   hoch-konfidenten (≥ 0.9), reproduzierbaren Auftreten automatisch auf.
   `PROPOSAL` wird immer geparkt; `BALANCE_ANOMALY`, `UX_FRICTION` etc. werden
   nur aggregiert.
3. **Finding-Lifecycle** — ein initial emittierter Befund wird `OPEN`.
   Weitere Vorkommen desselben Fingerprints aktualisieren nur
   `occurrences`/Evidence und erzeugen **keinen weiteren Request**, unabhängig
   davon, wie viel Zeit vergangen ist. Nur ein explizit `RESOLVED` gesetzter
   Befund darf bei späterem Wiederauftreten als `REGRESSION` erneut emittieren.
4. **Emission** — bestandene Kandidaten werden als KUEPER-Outbox-Routing-
   Envelope lokal unter `.kueper/outbox/<target>-<type>-<candidate_id>.json`
   abgelegt. Neben Provenienz bleiben auch `cost_policy`, `estimated_effort`
   und `finding_event` über die Router-Grenze erhalten. `observation.target`
   wird vor der Dateiablage gegen das Ecosystem-Registry-Muster
   (`^[A-Z][A-Z0-9-]*$`) validiert; ungültige Werte fallen auf das
   Default-Target zurück, sodass ein Dateiname das Outbox-Verzeichnis nie
   verlassen kann.
5. **Boundedness** — maximal fünf unterschiedliche Emissionen je Welt; der
   Lifecycle verhindert zusätzlich Request-Stürme für einen bereits offenen Befund.
6. **Write-Boundary** — der Emissions-Zustand wird erst NACH erfolgreichem
   Envelope-Write committet. Wirft der Writer (Disk full, EACCES), bleibt der
   Befund unverändert und damit erneut emittierbar; `ingest` wirft nie in
   Gameplay-Code, sondern liefert `outbox_write_failed`.

Lifecycle:

```text
UNEMITTED -> OPEN -> RESOLVED -> REGRESSION/OPEN
               ^                    |
               |-- weitere Evidenz -|
```

Der Übergang nach `RESOLVED` ist explizit (`sink.markResolved(...)`). Zeitablauf
allein schließt oder reaktiviert kein Finding.

## Nutzung

Deterministische Game-Assertion (Fehlschlag → BUG-Request, Erfolg → nichts):

```ts
import { ObservationProducer, recordAssertion } from '@/lib/game/observation/producer'

// Ohne expliziten `writer` fällt der Producer auf die Standard-Schreibgrenze
// `.kueper/outbox/` zurück — ein approved Kandidat erzeugt immer eine Envelope.
const producer = new ObservationProducer()

recordAssertion(producer, {
  world_id: 'noxia-test-001',
  agent_id: 'NOXIA_TESTER_INTELLIGENT_01',
  system: 'build',
  summary: 'Habitat requires exactly 1 entrance',
  check: () => countEntrances(habitat) === 1,
  expected: 'one entrance',
  actual: () => `${countEntrances(habitat)} entrances`,
}, Date.now())
```

Tester-Zyklus mit persistiertem Lifecycle:

```ts
const sink = LocalObservationSink.fromJSON(savedState)
const producer = new ObservationProducer({ sink, writer: fileWriter })
const result = producer.ingest(observation, Date.now())

// Nach nachgewiesener Behebung:
sink.markResolved(result.decision.fingerprint, Date.now())
```

## Grenzen

- Kein GitHub-, kein Supabase-Schreiben aus Gameplay-Code; Routing bleibt
  Aufgabe der Ecosystem-Schleife.
- Kein Auto-Merge, keine Balance-/Canon-/Design-Erfindung aus einer einzelnen
  Beobachtung; PROPOSAL wird nie autonom umgesetzt.
- Der Sink ist pur und deterministisch; Zeit wird als Parameter übergeben.
- `producer.ts` importiert `node:fs` und ist nur serverseitig zu verwenden.
- Ziel-Targets sind Caller-Eingabe, aber keine Pfade: nur Registry-Kennungen
  `^[A-Z][A-Z0-9-]*$` erreichen den Outbox-Dateinamen, alles andere fällt auf
  das Default-Target zurück.
- Writer-Fehler committen keinen Emissions-Zustand und werfen nicht aus
  `ingest`; ein Befund bleibt nach fehlgeschlagenem Write erneut emittierbar.

## Tests

```sh
node lib/game/observation/observationProducer.test.ts
```

Die Regressionstests belegen insbesondere:

- ein offenes Finding emittiert auch nach 30 Tagen nicht erneut;
- `RESOLVED -> Wiederauftreten` wird als `REGRESSION` emittiert;
- OPEN/RESOLVED überleben Snapshot/Restore;
- `estimated_effort`, `cost_policy`, `finding_event` und Provenienz bleiben im Envelope;
- niedrige Konfidenz, PROPOSAL und UX/BALANCE erzeugen keine autonomen Tasks;
- Welt-Obergrenze und stabile Fingerprints bleiben erhalten;
- ein ungültiges `target` (Pfad-Traversal) fällt auf das Default-Target zurück
  und kann den Outbox-Ordner nicht verlassen;
- ein Writer-Fehler committet keinen Emissions-Zustand; Retry und Regression
  bleiben emittierbar.

## Spätere Versionen

Aggregation mehrerer Tester-Persönlichkeiten und langlebiger Welten, bevor
Balance-, AI-Verhaltens- oder Science-Gap-Kandidaten aufsteigen; Validierung
der Ziel-Ownership gegen das Ecosystem-Registry.
