import { strict as assert } from 'node:assert'
import { synthesizeNpcDream } from './dreamKnowledge'
import { proposeDreamInquiry } from './dreamInquiry'

const dream = synthesizeNpcDream({
  npcId: 'a', tick: 10, worldYear: 2150, sleeping: true,
  memories: [{ id: 'memory', summary: 'an unfamiliar door', emotionalWeight: 0.2 }],
  sources: [],
})
assert.ok(dream)
const inquiry = proposeDreamInquiry({ dream, awake: true, atTick: 11, curiosity: 0.9 })
assert.equal(inquiry?.state, 'unverified')
assert.equal(inquiry?.dreamId, dream.id)
assert.equal(inquiry?.motivation, 'curiosity')
assert.equal(proposeDreamInquiry({ dream, awake: false, atTick: 11, curiosity: 0.9 }), null)
assert.equal(proposeDreamInquiry({ dream, awake: true, atTick: 11, curiosity: 0.1 }), null)
assert.throws(() => proposeDreamInquiry({ dream, awake: true, atTick: 9, curiosity: 0.9 }))
const nightmare = synthesizeNpcDream({
  npcId: 'a', tick: 10, worldYear: 2150, sleeping: true, emotionalSensitivity: 1,
  memories: [], sources: [{ id: 's', text: 'an unknown signal', sourceUri: 'https://example.org',
    observedAtTick: 9, availableFromYear: 2100, license: 'CC-BY', emotionalIntensity: 1,
    worldProjection: { availableFromYear: 2120, accessible: true } }],
})
assert.ok(nightmare)
assert.equal(proposeDreamInquiry({ dream: nightmare, awake: true, atTick: 11, curiosity: 0.8 })?.motivation, 'reassurance')
console.log('Dream inquiry tests passed')
