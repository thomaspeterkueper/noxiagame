import { strict as assert } from 'node:assert'
import { planDreamAction } from './dreamActionIntent'
import type { DreamInquiry } from './dreamInquiry'
import type { DreamInquiryDecision } from './dreamInquiryDecision'

const inquiry: DreamInquiry = {
  id: 'inquiry:1', npcId: 'npc1', dreamId: 'dream:1', createdAtTick: 10,
  question: 'Why did I dream about a bridge?', motivation: 'curiosity',
  state: 'unverified', sourceIds: ['source:1'],
}
const decision: DreamInquiryDecision = {
  inquiryId: inquiry.id, npcId: inquiry.npcId, decidedAtTick: 11,
  action: 'investigate', epistemicStatus: 'unverified', evidenceRequired: true,
}
const plan = (changes: Partial<Parameters<typeof planDreamAction>[0]> = {}) =>
  planDreamAction({ inquiry, decision, atTick: 12, featureEnabled: true,
    alreadyScheduledInWindow: 0, ...changes })
assert.equal(plan()?.kind, 'knowledge-investigation')
assert.equal(plan({ decision: { ...decision, action: 'ask-someone' } })?.kind, 'social-conversation')
assert.equal(plan({ decision: { ...decision, action: 'defer' } }), null)
assert.equal(plan({ decision: { ...decision, action: 'dismiss' } }), null)
assert.equal(plan({ featureEnabled: false }), null)
assert.equal(plan({ alreadyScheduledInWindow: 1 }), null)
assert.equal(plan()?.epistemicStatus, 'unverified')
assert.deepEqual(plan()?.sourceIds, ['source:1'])
assert.deepEqual(plan(), plan())
assert.throws(() => plan({ decision: { ...decision, npcId: 'other' } }))
assert.throws(() => plan({ atTick: 9 }))
console.log('Dream action intent tests passed')
