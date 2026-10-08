import type { Observation } from '../cognition/observation'
import { persistEpistemicObservations } from '../cognition/personEpistemicPersistence'
import type { NpcMemory, NpcMemoryState } from '../cognition/npcRelationalMemory'
import type { RelationalTrace } from '../cognition/relationalWorldRuntime'
import { deliverNpcTestimony } from './npcTestimony'

/**
 * Bridge into existing person_epistemic_traces, not a competing memory table.
 * Only call after authoritative dialogue confirms that a statement was spoken.
 * observationId must be a stable UUID supplied by that pipeline.
 * Listening to a claim is not agreeing with it.
 */
export function preparePersistedTestimony<T>(input: {
  listener: NpcMemoryState
  speakerMemory: NpcMemory<T>
  speakerTrace: RelationalTrace<T>
  conversationEventId: string
  observationId: string
  atTick: number
}): {
  listener: NpcMemoryState
  observation: Observation<T>
  agreement: null
} {
  if (!input.observationId.trim()) throw new Error('Testimony needs a persisted observation id')
  const delivered = deliverNpcTestimony(input)
  const observation: Observation<T> = {
    id: input.observationId,
    observerId: input.listener.npcId,
    subjectRef: input.speakerMemory.subjectRef,
    attribute: input.speakerMemory.attribute,
    value: input.speakerMemory.rememberedValue,
    source: {
      type: 'person',
      id: input.speakerMemory.npcId,
      provenanceRefs: [
        input.speakerTrace.id,
        'conversation:' + input.conversationEventId,
        ...input.speakerTrace.parentTraceIds,
      ],
    },
    modality: 'reported',
    observedAtTick: input.atTick,
    confidence: Math.max(0, Math.min(1, input.speakerMemory.subjectiveConfidence * 0.85)),
    salience: input.speakerMemory.salience,
  }
  return { listener: delivered.listener, observation, agreement: null }
}

export async function persistConfirmedNpcTestimony<T>(supabase: any, input: Parameters<typeof preparePersistedTestimony<T>>[0]) {
  const prepared = preparePersistedTestimony(input)
  const write = await persistEpistemicObservations(supabase, [prepared.observation])
  if (write.error) return { written: 0, error: write.error, listener: input.listener, agreement: null }
  return { written: write.written, error: null, listener: prepared.listener, agreement: null }
}
