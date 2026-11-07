import { dreamInterestInfluence, dreamRecallRows } from './dreamPersistence'
import type { DreamAssociation } from './dreamRecombination'

const dream: DreamAssociation = {
  id: 'dream:one', npcId: 'lan', sourceMemoryIds: ['mem:1'], sourceTraceIds: ['trace:1'],
  sourcePatternKeys: ['pattern:1'], motifs: ['water', 'river'], associationStrength: 0.8,
  novelty: 0.7, createdAtTick: 100, provenance: 'dream_recombination', canonical: false,
}
const project = (recall: number, enabled = true) => dreamRecallRows({
  enabled, sleepingNpcIds: ['lan'], dreams: [dream], recallByNpc: { lan: recall }, retentionTicks: 20,
})
const assert = (ok: boolean, label: string) => { if (!ok) throw new Error(label) }

assert(project(1, false).length === 0, 'default/disabled flag creates no rows')
assert(dreamRecallRows({ enabled: true, sleepingNpcIds: [], dreams: [dream], recallByNpc: { lan: 1 } }).length === 0, 'awake NPC excluded')
assert(project(0)[0].recalled === false, 'zero recall never remembers')
assert(project(1)[0].recalled === true, 'full recall always remembers')
assert(JSON.stringify(project(0.5)) === JSON.stringify(project(0.5)), 'projection deterministic')
const row = project(1)[0]
assert(row.canonical === false && row.source_ids.includes('mem:1'), 'provenance retained without facts')
assert(dreamInterestInfluence(row, 100, 'water') === 0, 'no same-tick influence')
assert(dreamInterestInfluence(row, 101, 'water') > 0, 'later tick influence')
assert(dreamInterestInfluence(row, 101, 'water') <= 0.1, 'influence bounded')
assert(dreamInterestInfluence(row, 110, 'water') < dreamInterestInfluence(row, 101, 'water'), 'influence decays')
assert(dreamInterestInfluence(row, 120, 'water') === 0, 'influence expires')
assert(dreamInterestInfluence(row, 101, 'unrelated') === 0, 'only matching interest')
assert(dreamInterestInfluence(project(0)[0], 101, 'water') === 0, 'forgotten dream has no influence')
console.log('Dream recall projection pilot: all checks passed')
