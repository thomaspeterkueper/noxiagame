import { strict as assert } from 'node:assert'
import { createNpcMemory, applyForgetting, type NpcMemoryState } from '../cognition/npcRelationalMemory'
import { deliverNpcTestimony } from './npcTestimony'

const empty = (npcId: string): NpcMemoryState => ({ npcId, clock: {}, memories: [], traces: [] })
const a = createNpcMemory({ npcId: 'a', subjectRef: 'visitor', attribute: 'helped', value: 'during flood', sourceRef: 'observation:1', atTick: 1 })
const first = deliverNpcTestimony({ speakerMemory: a.memory, speakerTrace: a.trace, listener: empty('b'), conversationEventId: 'talk-1', atTick: 2 })
assert.equal(first.listener.memories.length, 1)
assert.equal(first.agreement, null)
assert.deepEqual(first.listener.traces[0].parentTraceIds, [a.trace.id, 'conversation:talk-1'])
assert.equal(first.receivedMemory.rememberedValue, 'during flood')
const second = deliverNpcTestimony({
  speakerMemory: first.receivedMemory, speakerTrace: first.listener.traces[0],
  listener: empty('c'), conversationEventId: 'talk-2', atTick: 3
})
assert.deepEqual(second.listener.traces[0].parentTraceIds, [first.receivedMemory.traceId, 'conversation:talk-2'])
assert.equal(second.agreement, null)
assert.throws(() => deliverNpcTestimony({
  speakerMemory: a.memory, speakerTrace: a.trace, listener: empty('b'),
  conversationEventId: '', atTick: 2
}), /conversation event/)
assert.throws(() => deliverNpcTestimony({
  speakerMemory: a.memory, speakerTrace: a.trace, listener: first.listener,
  conversationEventId: 'talk-1', atTick: 2
}), /Duplicate/)
const forgotten = applyForgetting(a.memory, a.trace, 100, 1)
assert.throws(() => deliverNpcTestimony({
  speakerMemory: forgotten.memory, speakerTrace: forgotten.trace, listener: empty('b'),
  conversationEventId: 'talk-3', atTick: 101
}), /forgotten/)
assert.equal(a.memory.state, 'fresh')
console.log('NPC testimony integration: 9 assertions passed')
