import { strict as assert } from 'node:assert'
import { admitDreamAction } from './dreamActionAdmission'
import type { DreamActionIntent } from './dreamActionIntent'
const intent: DreamActionIntent = {
  id: 'dream-action:1', npcId: 'npc1', inquiryId: 'i1', createdAtTick: 12,
  kind: 'knowledge-investigation', prompt: 'Why?', epistemicStatus: 'unverified', sourceIds: [],
}
const check = (changes: Partial<Parameters<typeof admitDreamAction>[0]> = {}) =>
  admitDreamAction({ intent, featureEnabled: true, awake: true, working: false,
    traveling: false, hasActiveTask: false, essentialNeedsPending: false,
    knownIntentIds: [], availableSlots: 1, ...changes })
assert.equal(check().accepted, true)
assert.equal(check({ featureEnabled: false }).reason, 'disabled')
assert.equal(check({ awake: false }).reason, 'unavailable')
assert.equal(check({ traveling: true }).reason, 'unavailable')
assert.equal(check({ working: true }).reason, 'busy')
assert.equal(check({ hasActiveTask: true }).reason, 'busy')
assert.equal(check({ essentialNeedsPending: true }).reason, 'needs')
assert.equal(check({ knownIntentIds: [intent.id] }).reason, 'duplicate')
assert.equal(check({ availableSlots: 0 }).reason, 'capacity')
assert.throws(() => check({ availableSlots: -1 }))
console.log('Dream action admission tests passed')
