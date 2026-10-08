import { exchangeMemory, type NpcMemory, type NpcMemoryState } from '../cognition/npcRelationalMemory'
import type { RelationalTrace } from '../cognition/relationalWorldRuntime'

/**
 * Integrates KNOWLEDGE-0001 with the existing relational NPC memory.
 * A validated encounter/conversation event is required: proximity alone
 * must never spread knowledge. Receipt does not imply belief or agreement.
 *
 * Persistence is deliberately delegated to the existing epistemic layer.
 */
export function deliverNpcTestimony<T>(input: {
  speakerMemory: NpcMemory<T>
  speakerTrace: RelationalTrace<T>
  listener: NpcMemoryState
  conversationEventId: string
  atTick: number
}): {
  listener: NpcMemoryState
  receivedMemory: NpcMemory<T>
  agreement: null
} {
  const { speakerMemory, speakerTrace, listener, conversationEventId, atTick } = input
  if (!conversationEventId.trim()) throw new Error('Testimony requires a conversation event reference')
  if (!Number.isSafeInteger(atTick) || atTick < 0) throw new Error('Invalid tick')
  if (speakerMemory.npcId === listener.npcId) throw new Error('Testimony requires distinct people')
  if (speakerMemory.state === 'forgotten' || !speakerTrace.active)
    throw new Error('Speaker cannot transmit a forgotten or inactive memory')
  if (speakerMemory.traceId !== speakerTrace.id)
    throw new Error('Speaker memory does not match its provenance trace')
  if (speakerMemory.subjectRef !== speakerTrace.subjectRef || speakerMemory.attribute !== speakerTrace.attribute)
    throw new Error('Speaker memory content does not match provenance trace')
  if (listener.memories.some(m => m.traceId === 'trace:memory:' + listener.npcId + ':' + speakerMemory.subjectRef + ':' + speakerMemory.attribute + ':' + atTick))
    throw new Error('Duplicate memory event: replay requires idempotent caller handling')
  const received = exchangeMemory({
    listenerId: listener.npcId,
    speakerMemory,
    speakerTrace,
    listenerClock: listener.clock,
    atTick,
  })
  // exchangeMemory preserves parent trace lineage. The conversation id
  // is an additional edge; not a substitute for its originating source.
  const trace = {
    ...received.trace,
    parentTraceIds: [...received.trace.parentTraceIds, 'conversation:' + conversationEventId],
  }
  return {
    listener: {
      npcId: listener.npcId,
      clock: received.clock,
      memories: [...listener.memories, received.memory],
      traces: [...listener.traces, trace],
    },
    receivedMemory: received.memory,
    agreement: null,
  }
}
