import { strict as assert } from 'node:assert'
import { bridgeDreamIntentToPopulation } from './dreamPopulationBridge'
import type { DreamActionIntent } from './dreamActionIntent'
const dreamIntent: DreamActionIntent = {
  id: 'dream-action:1', npcId: 'npc1', inquiryId: 'inquiry1', createdAtTick: 10,
  kind: 'social-conversation', prompt: 'Why?', epistemicStatus: 'unverified', sourceIds: [],
}
const result = bridgeDreamIntentToPopulation({ dreamIntent, personId: 'npc1', relatedPersonId: 'npc2' })
assert.equal(result.ok, true)
if (result.ok) {
  assert.equal(result.intent.kind, 'local')
  if (result.intent.kind === 'local') {
    assert.equal(result.intent.action, 'social_interaction')
    assert.equal(result.intent.relatedPersonId, 'npc2')
    assert.equal(result.intent.subjectRef, null)
  }
  assert.equal(result.epistemicStatus, 'unverified')
}
assert.deepEqual(bridgeDreamIntentToPopulation({ dreamIntent, personId: 'npc1', relatedPersonId: null }),
  { ok: false, reason: 'no-social-target' })
assert.deepEqual(bridgeDreamIntentToPopulation({ dreamIntent, personId: 'other', relatedPersonId: 'npc2' }),
  { ok: false, reason: 'identity-mismatch' })
assert.deepEqual(bridgeDreamIntentToPopulation({
  dreamIntent: { ...dreamIntent, kind: 'knowledge-investigation' },
  personId: 'npc1', relatedPersonId: 'npc2',
}), { ok: false, reason: 'unsupported' })
console.log('Dream population bridge tests passed')
