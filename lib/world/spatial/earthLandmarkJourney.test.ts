import { strict as assert } from 'node:assert'
import { buildEarthLandmarkJourneyTarget } from './earthLandmarkJourney'

const target = buildEarthLandmarkJourneyTarget('earth-de-darmstadt-esoc')
assert.deepEqual(target.worldObject, {
  kind: 'earth-landmark',
  id: 'earth-de-darmstadt-esoc',
})
assert.deepEqual(target.arrival, {
  mode: 'resolve-canonical-arrival-node',
  nodeId: null,
  authority: 'server-required',
})
assert.deepEqual(target.immersiveHandoff, {
  mode: 'after-arrival',
  spaceId: null,
  authority: 'world-object-required',
})

assert.throws(
  () => buildEarthLandmarkJourneyTarget('does-not-exist'),
  /Unknown Earth landmark/,
)

console.log('earth landmark journey target tests passed')
