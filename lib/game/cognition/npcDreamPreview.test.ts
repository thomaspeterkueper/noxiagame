import { strict as assert } from 'node:assert'
import { createNpcMemory, type NpcMemoryState } from './npcRelationalMemory'
import { previewRelationalNpcDream } from './npcDreamPreview'

const created = createNpcMemory({
  npcId: 'npc-a', subjectRef: 'bridge', attribute: 'repair',
  value: 'wooden joint', sourceRef: 'observation:1', atTick: 4, salience: 0.9,
})
const state: NpcMemoryState = {
  npcId: 'npc-a', clock: created.clock,
  memories: [created.memory, { ...created.memory, id: 'forgotten', state: 'forgotten' }],
  traces: [created.trace],
}
const sources = [
  { id: 'history', text: 'Historic bridge joinery', sourceUri: 'https://example.org/bridge',
    observedAtTick: 5, availableFromYear: 2020, license: 'CC-BY',
    worldProjection: { availableFromYear: 2100, accessible: true } },
]
const before = JSON.stringify(state)
const result = previewRelationalNpcDream({
  state, sleeping: true, tick: 10, worldYear: 2150, cachedSources: sources,
})
assert.deepEqual(result?.memoryIds, [created.memory.id])
assert.deepEqual(result?.sourceIds, ['history'])
assert.equal(result?.epistemicStatus, 'subjective-dream')
assert.equal(JSON.stringify(state), before, 'preview must not mutate canonical memory')
assert.equal(previewRelationalNpcDream({
  state, sleeping: false, tick: 10, worldYear: 2150, cachedSources: sources,
}), null)
const inactive: NpcMemoryState = {
  ...state, traces: [{ ...created.trace, active: false }],
}
assert.deepEqual(previewRelationalNpcDream({
  state: inactive, sleeping: true, tick: 10, worldYear: 2150, cachedSources: [],
}), null)
console.log('NPC dream relational preview assertions passed')
