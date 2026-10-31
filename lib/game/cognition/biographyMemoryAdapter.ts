/** NOXIA #575: witnessed biography events become subjective NPC memories.
 * Pure adapter. No claim that unobserved events are known; no DB writes.
 */
import { createNpcMemory, type NpcMemoryState } from './npcRelationalMemory'
import type { BiographyEvent } from './biographyEvents'

export type BiographyWitness = {
  npcId: string
  perceivedEventId: string
  atTick: number
  sourceRef: string
  confidence: number
  salience: number
}
export function rememberBiographyEvent(
  state: NpcMemoryState,
  event: BiographyEvent,
  witness: BiographyWitness,
): NpcMemoryState {
  if (!state.npcId || state.npcId !== witness.npcId ||
      !event.id || event.id !== witness.perceivedEventId ||
      !witness.sourceRef || !Number.isSafeInteger(witness.atTick) ||
      !Number.isSafeInteger(event.tick) || witness.atTick < event.tick ||
      !Number.isFinite(witness.confidence) || witness.confidence < 0 || witness.confidence > 1 ||
      !Number.isFinite(witness.salience) || witness.salience < 0 || witness.salience > 1) {
    throw new Error('Invalid witnessed biography event')
  }
  // Source-event id is the idempotency key; one recollection per observer/event.
  if (state.traces.some(t => t.sourceRef === witness.sourceRef && t.attribute === 'biography_event' && t.value === event.id)) return state
  const created = createNpcMemory({
    npcId: witness.npcId, subjectRef: event.personId, attribute: 'biography_event',
    value: event.id, sourceRef: witness.sourceRef, atTick: witness.atTick,
    confidence: witness.confidence, salience: witness.salience, clock: state.clock,
  })
  // The generic memory factory keys by subject/attribute/tick; reject collisions
  // instead of silently overwriting memories from different witnessed events.
  if (state.memories.some(m=>m.id === created.memory.id) ||
      state.traces.some(t=>t.id === created.trace.id)) {
    throw new Error('Memory key collision')
  }
  return { npcId: state.npcId, clock: created.clock,
    memories: [...state.memories, created.memory],
    traces: [...state.traces, created.trace] }
}
