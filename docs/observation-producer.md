# NOXIA Game-Observation-Producer v0.1

Stand: 21.08.2026  
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
| `lib/game/observation/types.ts` | Protokoll-Typen, Gate-Konfiguration, Kosten-/Prioritäts-Mapping |
| `lib/game/observation/fingerprint.ts` | Stabile Fingerprints (2× FNV-1a-32, ES2017, deterministisch) |
| `lib/game/observation/sink.ts` | Lokaler Sink: Aufnahme, Aggregation, Gate, Persistenz (toJSON/fromJSON) |
| `lib/game/observation/producer.ts` | TaskCandidate → KUEPER-Outbox-Envelope, Datei-Writer, Assertion-Brücke |
| `lib/game/observation/observationProducer.test.ts` | Deterministische Tests (Node, keine Abhängigkeiten) |

## Ablauf

1. **Aufnahme** — `producer.ingest(observation, nowMs)` aggregiert über den
   Fingerprint der zugrunde liegenden Bedingung (`kind + system + summary`).
   Welt und Agent gehen nicht in den Fingerprint ein; Vorkommen derselben
   Bedingung in mehreren Welten zählen zusammen.
2. **Gate** (v0.1) — nur `BUG` und `DEAD_END` steigen nach EINEM
   hoch-konfidenten (≥ 0.9), reproduzierbaren Auftreten automatisch auf.
   `PROPOSAL` wird immer geparkt; `BALANCE_ANOMALY`, `UX_FRICTION` etc. werden
   nur aggregiert (spätere Versionen). Cooldown (6 h) je Fingerprint und eine
   Obergrenze von 5 Kandidaten je Welt begrenzen die Emissionen.
3. **Emission** — bestandene Kandidaten werden als KUEPER-Outbox-Routing-
   Envelope lokal unter `.kueper/outbox/<target>-<type>-<candidate_id>.json`
   abgelegt. Kern-Routingfelder plus Provenienz (world_id, agent_id,
   reproduction, expected/actual, confidence, evidence_refs) bleiben erhalten.

## Nutzung

Deterministische Game-Assertion (Fehlschlag → BUG-Request, Erfolg → nichts):

```ts
import { ObservationProducer, recordAssertion } from '@/lib/game/observation/producer'

const producer = new ObservationProducer() // Standard: Datei-Writer in .kueper/outbox

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

Tester-Zyklus (Persistenz über Zyklen, Writer injizierbar):

```ts
const sink = LocalObservationSink.fromJSON(savedState) // pur, kein IO
const producer = new ObservationProducer({ sink, writer: fileWriter })
const result = producer.ingest(observation, Date.now()) // decision + envelope?
```

## Grenzen (absichtlich)

- Kein GitHub-, kein Supabase-Schreiben aus Gameplay-Code; Routing bleibt
  Aufgabe der Ecosystem-Schleife.
- Kein Auto-Merge, keine Balance-/Canon-/Design-Erfindung aus einer einzelnen
  Beobachtung; PROPOSAL wird nie autonom umgesetzt.
- Der Sink ist pur und deterministisch (Zeit als Parameter, keine Zufallszahlen).
- `producer.ts` importiert `node:fs` — nur serverseitig verwenden.

## Tests

```sh
node lib/game/observation/observationProducer.test.ts
```

Beweist u. a.: Duplikate kollabieren zu einem Kandidaten/Request;
niedrig-konfidente und nicht reproduzierbare Observations emittieren nichts;
PROPOSAL/BALANCE/UX erzeugen keine Tasks; Cooldown und Welt-Obergrenze greifen.

## Spätere Versionen (nicht in v0.1)

Aggregation mehrerer Tester-Persönlichkeiten und langlebiger Welten, bevor
Balance-, AI-Verhaltens- oder Science-Gap-Kandidaten aufsteigen; Validierung
der Ziel-Ownership gegen das Ecosystem-Registry.
