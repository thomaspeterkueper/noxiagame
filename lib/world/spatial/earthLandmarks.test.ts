import { strict as assert } from 'node:assert'
import {
  EARTH_LANDMARKS,
  getCrossUniverseEarthLandmarks,
  getEarthLandmark,
  getEarthLandmarksByTag,
} from './earthLandmarks'

const ids = EARTH_LANDMARKS.map(landmark => landmark.id)
assert.equal(new Set(ids).size, ids.length, 'landmark ids must be unique')

for (const landmark of EARTH_LANDMARKS) {
  assert.ok(landmark.name.trim().length > 0)
  assert.equal(landmark.locator.kind, 'address')
  assert.ok(landmark.locator.value.trim().length > 0)
  assert.ok(landmark.presentDayRole.trim().length > 0)
  assert.ok(landmark.noxiaRole.trim().length > 0)
  assert.ok(landmark.sourceProjects.length > 0)

  if (landmark.externalUrl) {
    const url = new URL(landmark.externalUrl)
    assert.equal(url.protocol, 'https:')
    assert.ok(landmark.externalLinkLabel)
  }
}

const ssf = getEarthLandmark('earth-de-sundern-ssf-hq')
assert.ok(ssf)
assert.ok(ssf.tags.includes('canonical-foundation'))
assert.equal(ssf.externalUrl, 'https://solarsciencefoundation.vercel.app/')

const crossUniverse = getCrossUniverseEarthLandmarks()
assert.deepEqual(
  crossUniverse.map(landmark => landmark.id).sort(),
  ['earth-eg-alexandria', 'earth-gr-phaistos', 'earth-in-dwarka'].sort(),
)

assert.ok(getEarthLandmarksByTag('spaceflight').length >= 3)
assert.ok(getEarthLandmarksByTag('real-science').some(landmark => landmark.id === 'earth-de-darmstadt-esoc'))
assert.equal(getEarthLandmark('does-not-exist'), undefined)

console.log('earth landmark registry tests passed')
