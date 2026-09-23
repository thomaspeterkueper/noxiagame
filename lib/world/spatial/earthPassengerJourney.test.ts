import { strict as assert } from 'node:assert'
import { EARTH_LANDMARKS } from './earthLandmarks'
import { getEarthLandmarkArrivalNode } from './earthArrivalNodes'
import { resolveEarthLandmarkPassengerTarget } from './earthPassengerJourney'

for (const landmark of EARTH_LANDMARKS) {
  const node = getEarthLandmarkArrivalNode(landmark.id)
  assert.ok(node, `arrival node exists for ${landmark.id}`)
  assert.equal(node.id, `earth-arrival:${landmark.id}:site`)
  assert.deepEqual(node.worldObject, { kind: 'earth-landmark', id: landmark.id })
  assert.equal(node.authority, 'canonical-world-registry')
  assert.equal(node.accessKind, 'landmark-site-anchor')
  assert.equal(node.precision, 'site')
  assert.deepEqual(node.locator, landmark.locator)
  assert.equal('lat' in node.locator, false)
  assert.equal('lon' in node.locator, false)

  const resolved = resolveEarthLandmarkPassengerTarget(landmark.id)
  assert.equal(resolved?.resolution, 'resolved')
  assert.equal(resolved?.arrivalNode?.id, node.id)
}

assert.equal(getEarthLandmarkArrivalNode('missing-landmark'), null)
assert.equal(resolveEarthLandmarkPassengerTarget('missing-landmark'), null)

console.log('Earth passenger arrival-node tests passed')
