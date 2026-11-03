import { strict as assert } from 'node:assert'
import { decideDreamInquiry } from './dreamInquiryDecision'
import type { DreamInquiry } from './dreamInquiry'

const inquiry: DreamInquiry = {
  id: 'i1', npcId: 'npc1', dreamId: 'dream1', createdAtTick: 10,
  question: 'Why?', motivation: 'curiosity', state: 'unverified', sourceIds: [],
}
const choose = (changes: Partial<Parameters<typeof decideDreamInquiry>[0]> = {}) =>
  decideDreamInquiry({ inquiry, atTick: 11, curiosity: 0.9, socialTrust: 0.2,
    distress: 0.1, energy: 0.9, ...changes })
assert.equal(choose().action, 'investigate')
assert.equal(choose({ energy: 0.1 }).action, 'defer')
assert.equal(choose({ distress: 0.9, socialTrust: 0.8 }).action, 'ask-someone')
assert.equal(choose({ distress: 0.9, socialTrust: 0.1 }).action, 'defer')
assert.equal(choose({ curiosity: 0.1 }).action, 'dismiss')
assert.equal(choose().epistemicStatus, 'unverified')
assert.equal(choose().evidenceRequired, true)
assert.deepEqual(choose(), choose())
assert.throws(() => choose({ atTick: 9 }))
assert.throws(() => choose({ distress: 2 }))
console.log('Dream inquiry decisions passed')
