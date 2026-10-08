import { strict as assert } from 'node:assert'
import { createNpcMemory, type NpcMemoryState } from '../cognition/npcRelationalMemory'
import { preparePersistedTestimony, persistConfirmedNpcTestimony } from './testimonyPersistence'
import { reconstructMemoryStateFromEpistemicTraces, observationToEpistemicTrace } from '../cognition/personEpistemicPersistence'

async function run() {
  const empty = (npcId: string): NpcMemoryState => ({ npcId, clock: {}, memories: [], traces: [] })
  const a = createNpcMemory({ npcId: 'a', subjectRef: 'flood', attribute: 'rescuer', value: 'unknown visitor', sourceRef: 'observation:original', atTick: 1 })
  const params = {
    listener: empty('b'), speakerMemory: a.memory, speakerTrace: a.trace,
    conversationEventId: 'talk-123', observationId: '74f8b91e-9490-4636-8654-b117ad017b99', atTick: 2,
  }
  const prepared = preparePersistedTestimony(params)
  assert.equal(prepared.agreement, null)
  assert.equal(prepared.observation.modality, 'reported')
  assert.equal(prepared.observation.source.id, 'a')
  assert.ok(prepared.observation.source.provenanceRefs?.includes(a.trace.id))
  assert.ok(prepared.observation.source.provenanceRefs?.includes('conversation:talk-123'))
  const row = observationToEpistemicTrace(prepared.observation)
  const restored = reconstructMemoryStateFromEpistemicTraces('b', [row])
  assert.equal(restored.memories[0].rememberedValue, 'unknown visitor')
  assert.equal(restored.traces[0].parentTraceIds.includes('conversation:talk-123'), true)
  let saved: unknown[] = []
  const fake = { from(name: string) {
    assert.equal(name, 'person_epistemic_traces')
    return { async upsert(rows: unknown[]) { saved = rows; return { error: null } } }
  }}
  const result = await persistConfirmedNpcTestimony(fake, params)
  assert.equal(result.written, 1)
  assert.equal(saved.length, 1)
  const failure = { from() { return { async upsert() { return { error: { message: 'database unavailable' } } } } } }
  const failed = await persistConfirmedNpcTestimony(failure, params)
  assert.equal(failed.written, 0)
  assert.equal(failed.error, 'database unavailable')
  assert.equal(failed.listener.memories.length, 0)
  console.log('Testimony persistence bridge: 12 checks passed')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
