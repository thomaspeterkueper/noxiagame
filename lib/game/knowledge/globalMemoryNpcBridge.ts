import { createNpcMemory, type NpcMemoryState } from '../cognition/npcRelationalMemory'
import { learnFromHistoricalSource, type HistoricalEvent, type HistoricalSource, type HistoricalExposure } from './globalMemory'

/**
 * Explicit adapter to the existing NPC relational-memory layer.
 * This is NOT a public endpoint: the trusted caller must verify that the
 * historical exposure actually occurred and that the source is accessible.
 * A historical claim is testimony, not an automatically accepted fact.
 */
export function rememberHistoricalEncounter(input: {
  state: NpcMemoryState
  event: HistoricalEvent
  source: HistoricalSource
  exposure: HistoricalExposure
  /** Stable witnessed/read/heard interaction identifier, supplied by runtime. */
  encounterId: string
  /** Subjective importance; independent from evidence reliability. */
  salience?: number
}): NpcMemoryState {
  const { state, exposure, source } = input
  if (!input.encounterId.trim()) throw new Error('Historical encounter ID required')
  if (state.npcId !== exposure.actorId) throw new Error('Cannot write another actor memory')
  const knowledge = learnFromHistoricalSource({
    event: input.event, source, exposure,
  })
  if (state.memories.some(m => m.traceId ===
      'trace:memory:' + state.npcId + ':' + knowledge.eventId + ':historical_claim:' + exposure.tick)) {
    throw new Error('Duplicate historical memory at tick')
  }
  const created = createNpcMemory({
    npcId: state.npcId,
    subjectRef: knowledge.eventId,
    attribute: 'historical_claim',
    value: knowledge.claimText,
    sourceRef: 'historical-source:' + knowledge.sourceId,
    parentTraceIds: ['historical-encounter:' + input.encounterId],
    confidence: knowledge.epistemicStatus === 'direct-observation' ? 0.8 : 0.55,
    salience: input.salience ?? 0.5,
    atTick: knowledge.learnedAtTick,
    clock: state.clock,
  })
  return {
    npcId: state.npcId,
    clock: created.clock,
    memories: [...state.memories, created.memory],
    traces: [...state.traces, created.trace],
  }
}
