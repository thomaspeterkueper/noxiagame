import { recordHistoricalEvent, publishHistoricalSource } from './globalMemory'
import { prepareHistoricalObservation, persistConfirmedHistoricalEncounter } from './globalMemoryPersistence'
import { reconstructMemoryStateFromEpistemicTraces, observationToEpistemicTrace } from '../cognition/personEpistemicPersistence'

let checks = 0
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error('GLOBAL-MEMORY-PERSISTENCE: ' + message)
  checks++
}
function rejects(f: () => unknown, message: string) {
  let thrown = false
  try { f() } catch { thrown = true }
  check(thrown, message)
}

const event = recordHistoricalEvent({
  id: 'history:flood', kind: 'flood', tick: 5,
  summary: 'The river flooded', retention: 'world-public', provenanceRef: 'world:5',
})
const source = publishHistoricalSource({
  id: 'archive:flood', eventId: event.id, kind: 'archive',
  visibility: 'public', availableFromTick: 10, permittedActorIds: [],
  claimText: 'The river spirit caused a flood',
})
const input = {
  actorId: 'npc:reader', event, source,
  exposure: { actorId: 'npc:reader', sourceId: source.id, tick: 1000, channel: 'read' as const },
  encounterId: 'visit:library:1000',
  observationId: '10000000-0000-4000-8000-000000000001',
}
const obs = prepareHistoricalObservation(input)
check(obs.value === source.claimText && obs.value !== event.summary, 'historical claim, not canonical event')
check(obs.source.type === 'record' && obs.source.id === source.id, 'source metadata')
check(obs.modality === 'reported' && obs.confidence < 1, 'archive cannot be firsthand truth')
check(obs.source.provenanceRefs?.includes('historical-encounter:visit:library:1000'), 'encounter provenance')
check(obs.id === input.observationId, 'stable idempotency id')
const trace = observationToEpistemicTrace(obs)
const state = reconstructMemoryStateFromEpistemicTraces('npc:reader', [trace])
check(state.memories.length === 1, 'reuses existing memory reconstruction')
check(state.memories[0].rememberedValue === source.claimText, 'source statement remembered after reconstruction')
check(state.traces[0].sourceRef === 'observation:' + obs.id, 'epistemic trace retains origin')
rejects(() => prepareHistoricalObservation({ ...input, actorId: 'npc:other' }), 'no foreign actor writes')
rejects(() => prepareHistoricalObservation({ ...input, observationId: '' }), 'missing persistent observation id rejected')
rejects(() => prepareHistoricalObservation({ ...input, encounterId: '' }), 'no encounter reference rejected')
rejects(() => prepareHistoricalObservation({ ...input, salience: Number.NaN }), 'nonfinite salience rejected')
rejects(() => prepareHistoricalObservation({ ...input, event: { ...event, retention: 'erased' } }), 'erased event rejected')
rejects(() => prepareHistoricalObservation({ ...input, source: { ...source, visibility: 'restricted', permittedActorIds: [] } }), 'private source rejected')

let writes = 0
const fakeSupabase = {
  from(table: string) {
    check(table === 'person_epistemic_traces', 'existing database table used')
    return { upsert: async (rows: unknown[], options: { onConflict: string; ignoreDuplicates: boolean }) => {
      writes++
      check(rows.length === 1, 'one observation persisted')
      check(options.onConflict === 'id' && options.ignoreDuplicates, 'idempotent upsert')
      return { error: null }
    } }
  },
}

async function main() {
  const result = await persistConfirmedHistoricalEncounter(fakeSupabase, input)
  check(result.written === 1 && result.error === null && writes === 1, 'persisted via established writer')
  console.log('NOXIA Global Memory Persistence: ' + checks + ' checks passed')
}
main().catch(err => { console.error(err); process.exitCode = 1 })
