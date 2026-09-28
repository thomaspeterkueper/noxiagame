import { strict as assert } from 'node:assert'
import { EARTH_MICROREGIONS, getEarthMicroregion, getEarthMicroregionByLandmark } from './earthMicroregions'

const ids = EARTH_MICROREGIONS.map(region => region.id)
assert.equal(new Set(ids).size, ids.length, 'microregion ids must be unique')

for (const region of EARTH_MICROREGIONS) {
  assert.ok(region.nodes.length >= 2)
  assert.ok(region.links.length >= 1)
  const nodeIds = new Set(region.nodes.map(node => node.id))
  assert.equal(nodeIds.size, region.nodes.length, `${region.id}: node ids must be unique`)
  for (const link of region.links) {
    assert.ok(nodeIds.has(link.from), `${region.id}: unknown link.from ${link.from}`)
    assert.ok(nodeIds.has(link.to), `${region.id}: unknown link.to ${link.to}`)
  }
}

const jura = getEarthMicroregion('earth-microregion-vuiteboeuf-sainte-croix')
assert.ok(jura)
assert.equal(jura.anchorLandmarkId, 'earth-ch-vuiteboeuf')
assert.deepEqual(jura.nodes.map(node => node.id), ['vuiteboeuf', 'covatannaz', 'sainte-croix'])
assert.equal(getEarthMicroregionByLandmark('earth-ch-vuiteboeuf')?.id, jura.id)
assert.equal(getEarthMicroregion('does-not-exist'), undefined)

console.log('earth microregion tests passed')
