import { strict as assert } from 'node:assert'
import { previewDreamCycle } from './dreamCyclePreview'
const base = {
  npcId: 'npc:1', sleepTick: 10, wakeTick: 11, worldYear: 2150,
  sleepingAtSleepTick: true, awakeAtWakeTick: true,
  memories: [{ id: 'm1', summary: 'a strange bridge', emotionalWeight: 0.3 }],
  cachedSources: [], curiosity: 0.9, socialTrust: 0.5,
  emotionalSensitivity: 0.2, energy: 0.9, working: false, traveling: false,
  hasActiveTask: false, essentialNeedsPending: false,
  knownIntentIds: [], alreadyScheduledInWindow: 0, availableSlots: 1,
  featureEnabled: true,
}
const first = previewDreamCycle(base)
assert.equal(first.admission?.accepted, true)
assert.equal(first.intent?.kind, 'knowledge-investigation')
assert.equal(first.intent?.epistemicStatus, 'unverified')
assert.deepEqual(first, previewDreamCycle(base))
assert.equal(previewDreamCycle({ ...base, featureEnabled: false }).dream, null)
assert.equal(previewDreamCycle({ ...base, working: true }).admission?.reason, 'busy')
assert.equal(previewDreamCycle({ ...base, essentialNeedsPending: true }).admission?.reason, 'needs')
assert.equal(previewDreamCycle({ ...base, alreadyScheduledInWindow: 1 }).intent, null)
assert.equal(previewDreamCycle({ ...base, knownIntentIds: [first.intent!.id] }).admission?.reason, 'duplicate')
assert.equal(previewDreamCycle({ ...base, awakeAtWakeTick: false }).inquiry, null)
assert.throws(() => previewDreamCycle({ ...base, wakeTick: 10 }))
console.log('Dream cycle dry-run integration tests passed')
