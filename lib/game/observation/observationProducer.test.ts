// lib/game/observation/observationProducer.test.ts
// Erstellt:     21.08.2026
// Version:      0.1.0
//
// Deterministischer Test für den NOXIA Game-Observation-Producer v0.1.
// Kein Framework, keine Abhängigkeiten — Ausführung direkt mit Node (Type
// Stripping):
//
//     node lib/game/observation/observationProducer.test.ts
//
// Beweist die geforderten Eigenschaften:
//   1. Duplikate kollabieren zu EINEM Kandidaten/EINEM Request
//   2. Niedrig-konfidente / nicht reproduzierbare Observations emittieren
//      KEINEN Implementierungs-Request
//   3. PROPOSAL/BALANCE/etc. erzeugen in v0.1 keine Tasks
//   4. Cooldown, Welt-Obergrenze, Provenienz, Fingerprint-Stabilität
// ─────────────────────────────────────────────────────────────────────────────

import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { observationFingerprint } from './fingerprint.ts'
import { LocalObservationSink, NOXIA_TESTER_INTELLIGENT_01 } from './sink.ts'
import {
  createFileOutboxWriter,
  envelopeFilename,
  ObservationProducer,
  recordAssertion,
  type OutboxWriter,
} from './producer.ts'
import type { Observation, OutboxEnvelope } from './types.ts'

// ── Deterministische Zeitbasis ───────────────────────────────────────────────
const T0 = Date.parse('2026-08-21T12:00:00.000Z')
const COOLDOWN_MS = 6 * 60 * 60 * 1000
const AGENT = NOXIA_TESTER_INTELLIGENT_01

let fails = 0
function pruefe(ok: boolean, was: string) {
  if (!ok) {
    fails++
    console.log(`\n✘ FAIL: ${was}`)
  }
}

// ── In-Memory-Writer (zählt Writes statt Dateisystem) ────────────────────────
class MemoryWriter implements OutboxWriter {
  writes: Array<{ filename: string; content: string }> = []
  write(filename: string, content: string): void {
    this.writes.push({ filename, content })
  }
  envelopes(): OutboxEnvelope[] {
    return this.writes.map((w) => JSON.parse(w.content) as OutboxEnvelope)
  }
}

function deadEndObs(world: string, summary: string, confidence = 0.96): Observation {
  return {
    world_id: world,
    agent_id: AGENT,
    kind: 'DEAD_END',
    system: 'materials',
    summary,
    evidence: [{ ref: `world:${world}:state:12`, kind: 'state' }],
    reproduction: ['tick colony to level 3', 'open build menu', 'search for NdFeB source'],
    expected: 'at least one valid acquisition path',
    actual: 'none',
    confidence,
  }
}

function bugObs(world: string, summary: string, opts: { confidence?: number; reproduction?: string[] } = {}): Observation {
  return {
    world_id: world,
    agent_id: AGENT,
    kind: 'BUG',
    system: 'trade',
    summary,
    evidence: [{ ref: `log:${world}:trade:12`, kind: 'log' }],
    reproduction: opts.reproduction ?? ['buy 10 water', 'sell 10 water'],
    expected: 'orders match market prices',
    actual: 'order price diverges from market',
    confidence: opts.confidence ?? 0.95,
  }
}

// ── 1. Duplikate kollabieren zu EINEM Kandidaten/EINEM Request ───────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })

  const r1 = producer.ingest(deadEndObs('noxia-test-001', 'NdFeB acquisition path missing'), T0)
  const r2 = producer.ingest(deadEndObs('noxia-test-001', 'NdFeB acquisition path missing'), T0 + 1000)
  const r3 = producer.ingest(deadEndObs('noxia-test-001', 'NDFEB  acquisition  path missing'), T0 + 2000)

  pruefe(r1.decision.status === 'approved', `1. erstes Auftreten approved (war: ${r1.decision.status})`)
  pruefe(r2.decision.status === 'suppressed' && r2.decision.reason === 'cooldown_active', `1. Duplikat #2 im Cooldown (war: ${r2.decision.status}/${r2.decision.reason})`)
  pruefe(r3.decision.status === 'suppressed', `1. Duplikat #3 im Cooldown (war: ${r3.decision.status})`)
  pruefe(r1.decision.fingerprint === r2.decision.fingerprint && r2.decision.fingerprint === r3.decision.fingerprint, '1. identischer Fingerprint trotz Schreibweise')
  pruefe(producer.sink.candidateList().length === 1, `1. genau EIN Kandidat (war: ${producer.sink.candidateList().length})`)
  pruefe(writer.writes.length === 1, `1. genau EIN Request geschrieben (war: ${writer.writes.length})`)
  const agg = producer.sink.aggregate(r1.decision.fingerprint)
  pruefe(agg?.occurrences === 3, `1. Vorkommen aggregiert auf 3 (war: ${agg?.occurrences})`)
  pruefe(agg?.emissions === 1, `1. Emissionen bleiben 1 (war: ${agg?.emissions})`)
  // Der Envelope ist ein Snapshot zum Emissionszeitpunkt (occurrences=1);
  // spätere Duplikate aggregieren im Aggregat, ohne neu zu schreiben.
  pruefe(writer.envelopes()[0].occurrences === 1, '1. Envelope-Snapshot trägt occurrences=1')
}

// ── 2. Weltübergreifende Aggregation derselben Bedingung ─────────────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const a = producer.ingest(deadEndObs('noxia-test-001', 'Habitat power loop missing'), T0)
  const b = producer.ingest(deadEndObs('noxia-test-002', 'Habitat power loop missing'), T0 + 1000)

  pruefe(a.decision.fingerprint === b.decision.fingerprint, '2. gleicher Fingerprint über Welten')
  pruefe(a.decision.status === 'approved' && b.decision.status === 'suppressed', '2. zweite Welt aggregiert statt emittiert')
  const agg = producer.sink.aggregate(a.decision.fingerprint)
  pruefe(agg?.worlds.length === 2 && agg?.agents.length === 1, `2. Welten [${agg?.worlds.join(',')}] / Agenten [${agg?.agents.join(',')}] aggregiert`)
  pruefe(writer.writes.length === 1, '2. EIN Request für zwei Welten')
  pruefe(writer.envelopes()[0].world_id === 'noxia-test-001', '2. Provenienz der auslösenden Welt bleibt erhalten')
}

// ── 3. Niedrige Konfidenz emittiert NICHT ────────────────────────────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const r = producer.ingest(deadEndObs('noxia-test-001', 'Low-confidence dead end', 0.5), T0)

  pruefe(r.decision.status === 'aggregating' && r.decision.reason === 'confidence_below_threshold', `3. niedrige Konfidenz nur aggregiert (war: ${r.decision.status}/${r.decision.reason})`)
  pruefe(producer.sink.candidateList().length === 0, '3. kein Kandidat')
  pruefe(writer.writes.length === 0, '3. KEIN Request emittiert')
}

// ── 4. Nicht reproduzierbar emittiert NICHT ──────────────────────────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const r = producer.ingest(bugObs('noxia-test-001', 'Price divergence without repro', { confidence: 0.99, reproduction: [] }), T0)

  pruefe(r.decision.status === 'aggregating' && r.decision.reason === 'not_reproducible', `4. ohne Reproduktion nur aggregiert (war: ${r.decision.status}/${r.decision.reason})`)
  pruefe(writer.writes.length === 0, '4. KEIN Request emittiert')
}

// ── 5. PROPOSAL geparkt, BALANCE/UX in v0.1 nur aggregiert ───────────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const base = {
    world_id: 'noxia-test-001',
    agent_id: AGENT,
    system: 'balance',
    evidence: [{ ref: 'world:noxia-test-001:opinion', kind: 'data' }],
    reproduction: ['observe market for 10 ticks'],
    expected: 'x',
    actual: 'y',
    confidence: 0.99,
  }
  const p = producer.ingest({ ...base, kind: 'PROPOSAL', summary: 'Add luxury goods to Mars' }, T0)
  const b = producer.ingest({ ...base, kind: 'BALANCE_ANOMALY', summary: 'Water price seems high' }, T0 + 1)
  const u = producer.ingest({ ...base, kind: 'UX_FRICTION', summary: 'Build menu feels slow' }, T0 + 2)

  pruefe(p.decision.status === 'parked' && p.decision.reason === 'kind_parked_proposal', `5. PROPOSAL geparkt (war: ${p.decision.status}/${p.decision.reason})`)
  pruefe(b.decision.status === 'aggregating' && b.decision.reason === 'kind_not_auto_promotable_v0_1', `5. BALANCE_ANOMALY nur aggregiert (war: ${b.decision.status})`)
  pruefe(u.decision.status === 'aggregating', `5. UX_FRICTION nur aggregiert (war: ${u.decision.status})`)
  pruefe(writer.writes.length === 0, '5. KEIN Request aus Proposal/Balance/UX')
}

// ── 6. Cooldown: erneute Emission erst nach Ablauf, gleicher Kandidat ────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const obs = deadEndObs('noxia-test-001', 'Bank loan dead end')

  const r1 = producer.ingest(obs, T0)
  const r2 = producer.ingest(obs, T0 + COOLDOWN_MS - 1)          // 1 ms vor Ablauf
  const r3 = producer.ingest(obs, T0 + COOLDOWN_MS + 1000)       // nach Ablauf

  pruefe(r1.decision.status === 'approved', '6. Erst-Emission')
  pruefe(r2.decision.status === 'suppressed', '6. 1 ms vor Cooldown-Ablauf unterdrückt')
  pruefe(r3.decision.status === 'approved', `6. nach Cooldown erneut approved (war: ${r3.decision.status}/${r3.decision.reason})`)
  pruefe(writer.writes.length === 2, `6. zwei Writes (war: ${writer.writes.length})`)
  pruefe(writer.writes[0].filename === writer.writes[1].filename, '6. gleicher Dateiname = gleicher Kandidat')
  pruefe(writer.envelopes()[1].occurrences === 3, '6. zweiter Envelope trägt occurrences=3')
  pruefe(producer.sink.candidateList().length === 2, '6. zwei Kandidaten-Ereignisse, EIN Fingerprint')
}

// ── 7. Welt-Obergrenze: maximal 5 Kandidaten je Welt ─────────────────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  for (let i = 0; i < 5; i++) {
    producer.ingest(bugObs('noxia-test-001', `Distinct reproducible bug ${i + 1}`), T0 + i * 1000)
  }
  const sixth = producer.ingest(bugObs('noxia-test-001', 'Distinct reproducible bug 6'), T0 + 6000)

  pruefe(writer.writes.length === 5, `7. genau 5 Requests (war: ${writer.writes.length})`)
  pruefe(sixth.decision.status === 'suppressed' && sixth.decision.reason === 'world_emission_cap', `7. 6. Kandidat durch Welt-Cap unterdrückt (war: ${sixth.decision.status}/${sixth.decision.reason})`)
  const dup = producer.ingest(bugObs('noxia-test-001', 'Distinct reproducible bug 1'), T0 + 7000)
  pruefe(dup.decision.status === 'suppressed' && dup.decision.reason === 'cooldown_active', '7. Duplikat bleibt im Cooldown')
}

// ── 8. Envelope-Provenienz vollständig ───────────────────────────────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const obs = deadEndObs('noxia-test-007', 'Glass factory input missing')
  obs.target = 'NOXIA'
  const r = producer.ingest(obs, T0)
  const env = writer.envelopes()[0]

  pruefe(r.decision.status === 'approved', '8. approved')
  pruefe(env.target === 'NOXIA', `8. target NOXIA (war: ${env.target})`)
  pruefe(env.type === 'DEAD_END' && env.priority === 'high', `8. DEAD_END → high (war: ${env.type}/${env.priority})`)
  pruefe(env.cost_policy === 'immediate', `8. cost_policy immediate (war: ${env.cost_policy})`)
  pruefe(env.candidate_id === r.decision.fingerprint, '8. candidate_id = Fingerprint')
  pruefe(env.world_id === 'noxia-test-007' && env.agent_id === AGENT, `8. world/agent erhalten (${env.world_id}/${env.agent_id})`)
  pruefe(env.reproduction.length === 3 && env.reproduction[0] === 'tick colony to level 3', '8. reproduction erhalten')
  pruefe(env.expected === 'at least one valid acquisition path' && env.actual === 'none', '8. expected/actual erhalten')
  pruefe(env.confidence === 0.96 && env.occurrences === 1, `8. confidence/occurrences (${env.confidence}/${env.occurrences})`)
  pruefe(env.evidence_refs.length === 1 && env.evidence_refs[0] === 'world:noxia-test-007:state:12', '8. evidence_refs erhalten')
  pruefe(env.protocol === 'GAME_OBSERVATION_TASK_PROTOCOL' && env.protocol_version === 'v0.1', '8. Protokoll-Kennung')
  pruefe(env.depth === 1 && env.parent_task === '', `8. depth 1 / parent_task leer (${env.depth}/${env.parent_task})`)
  pruefe(writer.writes[0].filename === `NOXIA-DEAD_END-${r.decision.fingerprint}.json`, '8. stabiler Dateiname')
}

// ── 9. Fingerprint-Stabilität ────────────────────────────────────────────────
{
  const f1 = observationFingerprint({ kind: 'BUG', system: 'trade', summary: 'Price divergence' })
  const f2 = observationFingerprint({ kind: 'bug', system: ' TRADE ', summary: '  PRICE   DIVERGENCE ' })
  const f3 = observationFingerprint({ kind: 'BUG', system: 'trade', summary: 'Different condition' })
  const f4 = observationFingerprint({ kind: 'DEAD_END', system: 'trade', summary: 'Price divergence' })

  pruefe(f1 === f2, '9. Normalisierung ändert den Fingerprint nicht')
  pruefe(f1 !== f3 && f1 !== f4, '9. andere Bedingung/Kind → anderer Fingerprint')
  pruefe(/^[0-9a-f]{16}$/.test(f1), `9. 16 Hex-Zeichen (war: ${f1})`)
  pruefe(f1.length === 16, '9. Länge 16')
}

// ── 10. recordAssertion: Fehlschlag → BUG, Erfolg → nichts ───────────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })

  const ok = recordAssertion(
    producer,
    {
      world_id: 'noxia-test-001',
      agent_id: AGENT,
      system: 'build',
      summary: 'Habitat requires exactly 1 entrance',
      check: () => 1 + 1 === 2,
      expected: 'true',
      actual: 'false',
    },
    T0,
  )
  pruefe(ok === true, '10. bestandene Assertion liefert true')
  pruefe(producer.sink.aggregateList().length === 0 && writer.writes.length === 0, '10. bestandene Assertion erzeugt KEINE Observation/KEINEN Request')

  const fail = recordAssertion(
    producer,
    {
      world_id: 'noxia-test-001',
      agent_id: AGENT,
      system: 'build',
      summary: 'Habitat requires exactly 1 entrance',
      check: () => 1 + 1 === 3,
      expected: 'one entrance',
      actual: 'two entrances',
    },
    T0 + 1000,
  )
  pruefe(fail === false, '10. fehlgeschlagene Assertion liefert false')
  pruefe(writer.writes.length === 1, `10. Fehlschlag emittiert EINEN BUG-Request (war: ${writer.writes.length})`)
  const env = writer.envelopes()[0]
  pruefe(env.type === 'BUG' && env.reproduction.length === 4, '10. BUG-Envelope mit Reproduktionsschritten')
}

// ── 11. Persistenz-Roundtrip erhält Dedup-Zustand ────────────────────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  producer.ingest(deadEndObs('noxia-test-001', 'Shipyard recipe missing'), T0)

  const restored = new ObservationProducer({
    writer,
    sink: LocalObservationSink.fromJSON(producer.sink.toJSON()),
  })
  const again = restored.ingest(deadEndObs('noxia-test-001', 'Shipyard recipe missing'), T0 + 1000)

  pruefe(again.decision.status === 'suppressed' && again.decision.reason === 'cooldown_active', `11. Dedup überlebt Restore (war: ${again.decision.status}/${again.decision.reason})`)
  pruefe(writer.writes.length === 1, '11. kein zweiter Request nach Restore')
  pruefe(restored.sink.aggregate(again.decision.fingerprint)?.occurrences === 2, '11. Vorkommen zählen weiter')
}

// ── 12. Datei-Writer schreibt valide Envelopes in lokalen Outbox-Ordner ──────
{
  const dir = mkdtempSync(join(tmpdir(), 'noxia-outbox-'))
  const producer = new ObservationProducer({ writer: createFileOutboxWriter(dir) })
  const r = producer.ingest(deadEndObs('noxia-test-001', 'Farm output never stored'), T0)

  pruefe(r.decision.status === 'approved' && r.decision.candidate !== null, '12. approved mit Kandidat')
  if (r.decision.candidate) {
    const file = join(dir, envelopeFilename(r.decision.candidate))
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as OutboxEnvelope
    pruefe(parsed.candidate_id === r.decision.fingerprint, '12. Datei enthält den Kandidaten-Envelope')
    pruefe(parsed.title === 'DEAD_END: Farm output never stored', `12. Titel aus Bedingung (war: ${parsed.title})`)
  }
  rmSync(dir, { recursive: true, force: true })
}

// ── 13. Normale Game-Aktionen erzeugen keine Tasks ───────────────────────────
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  // Normale Spielschritte rufen den Sink gar nicht erst auf — der Test
  // stellt sicher, dass auch schwache/gewöhnliche Beobachtungen still bleiben.
  producer.ingest(
    {
      world_id: 'noxia-test-001',
      agent_id: AGENT,
      kind: 'UX_FRICTION',
      system: 'ui',
      summary: 'Personal preference about button color',
      expected: 'x',
      actual: 'y',
      confidence: 0.8,
      reproduction: [],
    },
    T0,
  )
  producer.ingest(
    {
      world_id: 'noxia-test-001',
      agent_id: AGENT,
      kind: 'PROPOSAL',
      system: 'design',
      summary: 'I think colonies should be round',
      expected: 'x',
      actual: 'y',
      confidence: 1,
      reproduction: ['nothing'],
    },
    T0 + 1,
  )
  pruefe(producer.sink.candidateList().length === 0 && writer.writes.length === 0, '13. gewöhnliche Aktionen/Meinungen erzeugen keinen Task')
}

// ── Ergebnis ─────────────────────────────────────────────────────────────────
console.log(`\n${fails === 0 ? '✓ alle Observation-Producer-Tests bestanden' : `✘ ${fails} Fehlschläge`}`)
process.exitCode = fails > 0 ? 1 : 0
