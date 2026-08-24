// lib/game/observation/observationProducer.test.ts
// Version: 0.1.1
// Deterministische Regressionstests für Game Observation -> TaskCandidate -> Outbox.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
import type { Observation, OutboxEnvelope, TaskCandidate } from './types.ts'

const T0 = Date.parse('2026-08-21T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const AGENT = NOXIA_TESTER_INTELLIGENT_01

let fails = 0
function pruefe(ok: boolean, was: string): void {
  if (!ok) {
    fails++
    console.log(`\n✘ FAIL: ${was}`)
  }
}

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
    reproduction: ['tick colony to level 3', 'open build menu', 'search for source'],
    expected: 'at least one valid acquisition path',
    actual: 'none',
    confidence,
  }
}

function bugObs(world: string, summary: string, confidence = 0.95): Observation {
  return {
    world_id: world,
    agent_id: AGENT,
    kind: 'BUG',
    system: 'trade',
    summary,
    evidence: [{ ref: `log:${world}:trade:12`, kind: 'log' }],
    reproduction: ['buy 10 water', 'sell 10 water'],
    expected: 'orders match market prices',
    actual: 'order price diverges from market',
    confidence,
  }
}

// 1. Erstes reproduzierbares Finding emittiert genau einmal und wird OPEN.
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const r = producer.ingest(deadEndObs('noxia-001', 'NdFeB acquisition path missing'), T0)
  const agg = producer.sink.aggregate(r.decision.fingerprint)

  pruefe(r.decision.status === 'approved', '1. initiales Finding approved')
  pruefe(r.decision.reason === 'gate_passed', '1. initialer Gate-Grund')
  pruefe(r.decision.candidate?.finding_event === 'INITIAL', '1. finding_event INITIAL')
  pruefe(agg?.finding_status === 'OPEN', `1. Finding OPEN (war ${agg?.finding_status})`)
  pruefe(writer.writes.length === 1, '1. genau eine Emission')
}

// 2. Derselbe ungelöste Befund emittiert auch nach langer Zeit NICHT erneut.
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const obs = deadEndObs('noxia-001', 'Bank loan dead end')
  const r1 = producer.ingest(obs, T0)
  const r2 = producer.ingest(obs, T0 + 1_000)
  const r3 = producer.ingest(obs, T0 + 30 * DAY)
  const agg = producer.sink.aggregate(r1.decision.fingerprint)

  pruefe(r1.decision.status === 'approved', '2. erste Emission')
  pruefe(r2.decision.status === 'suppressed' && r2.decision.reason === 'finding_still_open', '2. direktes Duplikat wegen OPEN unterdrückt')
  pruefe(r3.decision.status === 'suppressed' && r3.decision.reason === 'finding_still_open', '2. auch nach 30 Tagen wegen OPEN unterdrückt')
  pruefe(writer.writes.length === 1, `2. weiterhin nur eine Emission (war ${writer.writes.length})`)
  pruefe(agg?.occurrences === 3, `2. Evidence/Vorkommen weiter aggregiert (war ${agg?.occurrences})`)
  pruefe(agg?.emissions === 1, `2. emissions bleibt 1 (war ${agg?.emissions})`)
}

// 3. Nur explizit RESOLVED -> erneutes Auftreten erzeugt REGRESSION.
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const obs = bugObs('noxia-002', 'Market price divergence')
  const first = producer.ingest(obs, T0)

  pruefe(producer.sink.markResolved(first.decision.fingerprint, T0 + DAY), '3. OPEN kann explizit resolved werden')
  pruefe(producer.sink.aggregate(first.decision.fingerprint)?.finding_status === 'RESOLVED', '3. Status RESOLVED')

  const regression = producer.ingest(obs, T0 + 2 * DAY)
  const agg = producer.sink.aggregate(first.decision.fingerprint)
  pruefe(regression.decision.status === 'approved', '3. Regression approved')
  pruefe(regression.decision.reason === 'regression_after_resolution', '3. Regression-Grund')
  pruefe(regression.decision.candidate?.finding_event === 'REGRESSION', '3. finding_event REGRESSION')
  pruefe(regression.decision.candidate?.title.startsWith('REGRESSION:'), '3. Regression im Titel sichtbar')
  pruefe(agg?.finding_status === 'OPEN', '3. Regression öffnet Finding wieder')
  pruefe(agg?.regressions === 1, `3. Regression counter 1 (war ${agg?.regressions})`)
  pruefe(writer.writes.length === 2, `3. initial + Regression = zwei Emissionen (war ${writer.writes.length})`)
}

// 4. Snapshot/Restore erhält OPEN-Status; kein Neustart-Duplikat.
{
  const writer = new MemoryWriter()
  const original = new ObservationProducer({ writer })
  const obs = deadEndObs('noxia-003', 'Shipyard recipe missing')
  original.ingest(obs, T0)

  const restored = new ObservationProducer({
    writer,
    sink: LocalObservationSink.fromJSON(original.sink.toJSON()),
  })
  const again = restored.ingest(obs, T0 + 10 * DAY)
  pruefe(again.decision.status === 'suppressed' && again.decision.reason === 'finding_still_open', '4. OPEN-Dedup überlebt Restore')
  pruefe(writer.writes.length === 1, '4. Restore erzeugt keinen zweiten Request')
}

// 5. Snapshot/Restore erhält RESOLVED und ermöglicht spätere Regression.
{
  const writer = new MemoryWriter()
  const original = new ObservationProducer({ writer })
  const obs = deadEndObs('noxia-004', 'Oxygen dead end')
  const first = original.ingest(obs, T0)
  original.sink.markResolved(first.decision.fingerprint, T0 + DAY)

  const restored = new ObservationProducer({
    writer,
    sink: LocalObservationSink.fromJSON(original.sink.toJSON()),
  })
  const regression = restored.ingest(obs, T0 + 2 * DAY)
  pruefe(regression.decision.candidate?.finding_event === 'REGRESSION', '5. RESOLVED überlebt Restore und wird Regression')
  pruefe(writer.writes.length === 2, '5. Regression nach Restore emittiert')
}

// 6. estimated_effort und Lifecycle-Metadaten überleben die Outbox-Grenze.
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const r = producer.ingest(deadEndObs('noxia-005', 'Glass input missing'), T0)
  const env = writer.envelopes()[0]

  pruefe(env.estimated_effort === r.decision.candidate?.estimated_effort, `6. estimated_effort erhalten (${env.estimated_effort})`)
  pruefe(env.estimated_effort === 'medium', '6. erwarteter Aufwand medium')
  pruefe(env.cost_policy === 'immediate', '6. cost_policy immediate')
  pruefe(env.finding_event === 'INITIAL', '6. finding_event im Envelope')
  pruefe(env.candidate_id === r.decision.fingerprint, '6. candidate_id = Fingerprint')
  pruefe(env.world_id === 'noxia-005' && env.agent_id === AGENT, '6. Provenienz world/agent erhalten')
  pruefe(env.evidence_refs.length === 1, '6. evidence_refs erhalten')
}

// 7. Niedrige Konfidenz, fehlende Reproduktion und nicht-promotable Kinds erzeugen keine Tasks.
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const low = producer.ingest(deadEndObs('noxia-006', 'Weak dead end', 0.5), T0)
  const proposal = producer.ingest({
    world_id: 'noxia-006', agent_id: AGENT, kind: 'PROPOSAL', system: 'design',
    summary: 'Add luxury goods', expected: 'x', actual: 'y', confidence: 1,
    reproduction: ['opinion'],
  }, T0 + 1)
  const ux = producer.ingest({
    world_id: 'noxia-006', agent_id: AGENT, kind: 'UX_FRICTION', system: 'ui',
    summary: 'Button preference', expected: 'x', actual: 'y', confidence: 1,
    reproduction: ['observe'],
  }, T0 + 2)
  const notReproducible = producer.ingest({
    world_id: 'noxia-006', agent_id: AGENT, kind: 'BUG', system: 'trade',
    summary: 'Market glitch without reproduction', expected: 'x', actual: 'y',
    confidence: 0.95,
  }, T0 + 3)

  pruefe(low.decision.status === 'aggregating', '7. niedrige Konfidenz aggregiert')
  pruefe(proposal.decision.status === 'parked', '7. PROPOSAL geparkt')
  pruefe(ux.decision.status === 'aggregating', '7. UX nur aggregiert')
  pruefe(notReproducible.decision.status === 'aggregating' && notReproducible.decision.reason === 'not_reproducible', '7. hoch-konfident ohne Reproduction aggregiert (not_reproducible)')
  pruefe(writer.writes.length === 0, '7. keine Outbox-Emission')
}

// 8. Welt-Cap begrenzt unterschiedliche Findings, offene Duplikate verbrauchen kein neues Cap.
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  for (let i = 0; i < 5; i++) producer.ingest(bugObs('noxia-007', `Distinct bug ${i}`), T0 + i)
  const sixth = producer.ingest(bugObs('noxia-007', 'Distinct bug 6'), T0 + 10)
  const duplicate = producer.ingest(bugObs('noxia-007', 'Distinct bug 0'), T0 + 20)

  pruefe(writer.writes.length === 5, `8. fünf Emissionen (war ${writer.writes.length})`)
  pruefe(sixth.decision.reason === 'world_emission_cap', '8. sechstes Finding durch Cap blockiert')
  pruefe(duplicate.decision.reason === 'finding_still_open', '8. Duplikat durch Lifecycle, nicht Zeit/Cap unterdrückt')
}

// 9. Fingerprints bleiben normalisiert und stabil.
{
  const f1 = observationFingerprint({ kind: 'BUG', system: 'trade', summary: 'Price divergence' })
  const f2 = observationFingerprint({ kind: 'bug', system: ' TRADE ', summary: ' PRICE   DIVERGENCE ' })
  const f3 = observationFingerprint({ kind: 'DEAD_END', system: 'trade', summary: 'Price divergence' })
  pruefe(f1 === f2, '9. Normalisierung stabil')
  pruefe(f1 !== f3, '9. anderer Kind -> anderer Fingerprint')
  pruefe(/^[0-9a-f]{16}$/.test(f1), '9. 16-stelliger Hex-Fingerprint')
}

// 10. recordAssertion: Erfolg still, Fehlschlag erzeugt genau einen BUG.
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const ok = recordAssertion(producer, {
    world_id: 'noxia-008', agent_id: AGENT, system: 'build', summary: 'one entrance',
    check: () => true, expected: 'one', actual: 'one',
  }, T0)
  const fail = recordAssertion(producer, {
    world_id: 'noxia-008', agent_id: AGENT, system: 'build', summary: 'one entrance',
    check: () => false, expected: 'one', actual: 'two',
  }, T0 + 1)
  pruefe(ok === true && fail === false, '10. Assertion-Rückgabewerte')
  pruefe(writer.writes.length === 1 && writer.envelopes()[0].type === 'BUG', '10. nur Fehlschlag emittiert BUG')
}

// 11. Datei-Writer schreibt valides Envelope lokal.
{
  const dir = mkdtempSync(join(tmpdir(), 'noxia-outbox-'))
  const producer = new ObservationProducer({ writer: createFileOutboxWriter(dir) })
  const r = producer.ingest(deadEndObs('noxia-009', 'Farm output never stored'), T0)
  if (r.decision.candidate) {
    const file = join(dir, envelopeFilename(r.decision.candidate))
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as OutboxEnvelope
    pruefe(parsed.estimated_effort === 'medium', '11. Datei enthält estimated_effort')
    pruefe(parsed.finding_event === 'INITIAL', '11. Datei enthält Lifecycle-Event')
  } else {
    pruefe(false, '11. Kandidat erwartet')
  }
  rmSync(dir, { recursive: true, force: true })
}

// 12. Ungültiges Observation.target (Pfad-Traversal) wird auf das Default-Target
//     zurückgesetzt; der Dateiname kann das Outbox-Verzeichnis nie verlassen.
{
  const dir = mkdtempSync(join(tmpdir(), 'noxia-outbox-'))
  const producer = new ObservationProducer({ writer: createFileOutboxWriter(dir) })
  const obs = deadEndObs('noxia-010', 'Target escape attempt')
  obs.target = '../../escaped-target'
  const r = producer.ingest(obs, T0)

  pruefe(r.decision.status === 'approved', '12. ungültiges target verhindert die Emission nicht')
  pruefe(r.filename !== null && r.filename.startsWith('NOXIA-'), `12. Dateiname nutzt Default-Target (${r.filename})`)
  const parsed = JSON.parse(readFileSync(join(dir, r.filename as string), 'utf8')) as OutboxEnvelope
  pruefe(parsed.target === 'NOXIA', `12. Envelope-Target auf Default zurückgefallen (${parsed.target})`)
  rmSync(dir, { recursive: true, force: true })
}

// 12b. envelopeFilename weist ungültige Targets an der Datei-Grenze ab (letzte Verteidigung).
{
  let threw = false
  try {
    envelopeFilename({ target: '../../x' } as TaskCandidate)
  } catch {
    threw = true
  }
  pruefe(threw, '12b. envelopeFilename lehnt ungültiges Target ab')
}

// 13. Writer-Fehler committet keinen Emissions-Zustand; Retry emittiert; kein Throw in Gameplay.
{
  const writes: string[] = []
  let fail = true
  const writer: OutboxWriter = {
    write(filename: string): void {
      if (fail) throw new Error('simulated disk full')
      writes.push(filename)
    },
  }
  const producer = new ObservationProducer({ writer })
  const obs = deadEndObs('noxia-011', 'Emission while disk full')
  const failed = producer.ingest(obs, T0)
  const agg = producer.sink.aggregate(failed.decision.fingerprint)

  pruefe(failed.decision.status === 'suppressed' && failed.decision.reason === 'outbox_write_failed', '13. Writer-Fehler wird abgefangen, kein Throw in Gameplay')
  pruefe(agg?.finding_status === 'UNEMITTED' && agg?.emissions === 0, '13. kein Emissions-Commmit nach Writer-Fehler')
  pruefe(producer.sink.worldEmissionCount('noxia-011') === 0, '13. kein World-Emission-Zähler nach Writer-Fehler')

  fail = false
  const retry = producer.ingest(obs, T0 + 1)
  pruefe(retry.decision.status === 'approved', '13. Retry nach Writer-Erholung emittiert')
  pruefe(writes.length === 1, `13. genau eine erfolgreiche Emission (war ${writes.length})`)
}

// 14. Regression bei Writer-Fehler: RESOLVED-Status bleibt erhalten, Retry emittiert REGRESSION.
{
  const writer = new MemoryWriter()
  const producer = new ObservationProducer({ writer })
  const obs = bugObs('noxia-012', 'Regression survives write failure')
  const first = producer.ingest(obs, T0)
  const fingerprint = first.decision.fingerprint
  producer.sink.markResolved(fingerprint, T0 + DAY)
  const resolvedAt = producer.sink.aggregate(fingerprint)?.resolved_at

  const failingProducer = new ObservationProducer({
    writer: { write: () => { throw new Error('EACCES') } },
    sink: producer.sink,
  })
  const failed = failingProducer.ingest(obs, T0 + 2 * DAY)
  const agg = producer.sink.aggregate(fingerprint)
  pruefe(failed.decision.reason === 'outbox_write_failed', '14. Regression-Write-Fehler abgefangen')
  pruefe(agg?.finding_status === 'RESOLVED', '14. Status bleibt RESOLVED nach fehlgeschlagenem Write')
  pruefe(agg?.resolved_at === resolvedAt, '14. resolved_at bleibt erhalten')

  const regression = producer.ingest(obs, T0 + 3 * DAY)
  pruefe(regression.decision.status === 'approved' && regression.decision.candidate?.finding_event === 'REGRESSION', '14. Retry emittiert REGRESSION')
  pruefe(writer.writes.length === 2, `14. genau zwei Emissionen insgesamt (war ${writer.writes.length})`)
}

console.log(`\n${fails === 0 ? '✓ alle Observation-Producer-Tests bestanden' : `✘ ${fails} Fehlschläge`}`)
process.exitCode = fails > 0 ? 1 : 0
