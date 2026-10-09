import { createNpcMemory, applyForgetting, type NpcMemoryState } from '../cognition/npcRelationalMemory'
import { deliverNpcTestimony } from './npcTestimony'
import { originateClaim, transmitClaim, receiveTransmission, reinterpretReceipt } from './transmission'

let checks = 0
function check(condition: unknown, message: string) {
  if (!condition) throw new Error('NOXIA-KNOWLEDGE-0001: ' + message)
  checks++
}
function fresh(npcId: string): NpcMemoryState {
  return { npcId, clock: {}, memories: [], traces: [] }
}

// Authoritative synthetic event is kept OUTSIDE NPC knowledge. A perceives it,
// B hears A; C hears B. Their traces must not claim direct observation.
const event = { id: 'event:flood:1', description: 'A visitor helped during the flood' }
const a = createNpcMemory({
  npcId: 'npc-a', subjectRef: 'event:flood:1', attribute: 'reported_rescuer',
  value: 'visitor helped', sourceRef: 'observation:npc-a:flood',
  atTick: 1, confidence: 0.9, salience: 0.8,
})
const b = deliverNpcTestimony({
  speakerMemory: a.memory, speakerTrace: a.trace, listener: fresh('npc-b'),
  conversationEventId: 'spoken:a-b', atTick: 2,
})
const c = deliverNpcTestimony({
  speakerMemory: b.receivedMemory, speakerTrace: b.listener.traces[0],
  listener: fresh('npc-c'), conversationEventId: 'spoken:b-c', atTick: 3,
})
check(b.agreement === null && c.agreement === null, 'testimony cannot imply agreement')
check(c.listener.memories[0].npcId === 'npc-c', 'recipient retains separate identity')
check(c.listener.traces[0].parentTraceIds.includes(b.receivedMemory.traceId), 'C links to B')
check(b.listener.traces[0].parentTraceIds.includes(a.trace.id), 'B links to A')
check(!c.listener.traces[0].sourceRef.includes('observation'), 'C did not observe the event')
check(event.description === 'A visitor helped during the flood', 'canonical event remains untouched')

// Interpretation is an explicit act, not a side effect of hearing.
const claim = originateClaim({
  id: 'claim:a', text: event.description, sourceKind: 'perception',
  sourceRef: 'observation:npc-a:flood',
})
const utterance = transmitClaim({
  id: 'utterance:a-b', senderId: 'npc-a', recipientId: 'npc-b',
  source: claim, transmittedAtTick: 2,
})
const interpreted = reinterpretReceipt({
  id: 'claim:b', receipt: receiveTransmission({ transmission: utterance }),
  interpretedText: 'The visitor was sent to save us',
})
check(interpreted.text !== claim.text, 'interpretation differs')
check(interpreted.rootClaimId === claim.id, 'root claim remains traceable')
check(interpreted.sourceKind === 'testimony', 'interpretation is not an authoritative event')
check(claim.text === event.description, 'original claim remains unchanged')

// Different copies can survive when the original witness forgets.
// Without a receiving person or a durable record the narrative cannot spread.
const forgotten = applyForgetting(a.memory, a.trace, 1000, 1)
check(forgotten.memory.state === 'forgotten' && !forgotten.trace.active, 'A loses active recall')
let refused = false
try {
  deliverNpcTestimony({
    speakerMemory: forgotten.memory, speakerTrace: forgotten.trace,
    listener: fresh('npc-d'), conversationEventId: 'spoken:a-d', atTick: 1001,
  })
} catch { refused = true }
check(refused, 'forgotten source cannot transmit')
check(b.listener.memories[0].state === 'fresh', 'B still has independent testimony')
check(c.listener.memories[0].state === 'fresh', 'C still has independent testimony')
console.log('NOXIA-KNOWLEDGE-0001 A→B→C synthetic experiment: ' + checks + ' checks passed')
