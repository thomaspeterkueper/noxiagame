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

const frankfurt = getEarthMicroregion('earth-microregion-frankfurt-book-world')
assert.ok(frankfurt)
assert.equal(frankfurt.anchorLandmarkId, 'earth-de-frankfurt-senckenberg')
assert.deepEqual(frankfurt.nodes.map(node => node.id), ['frankfurt-hbf', 'senckenberg', 'camaleo-artlounge', 'sachsenhausen', 'staedel', 'bornheim', 'paulskirche', 'roemerberg', 'schwanheimer-duene'])

const sauerland = getEarthMicroregion('earth-microregion-sauerland-hexenteich')
assert.ok(sauerland)
assert.equal(sauerland.anchorLandmarkId, 'earth-de-menden-hexenteich')
assert.deepEqual(sauerland.nodes.map(node => node.id), ['hexenteich', 'felsenmeer-hemer', 'reckenhoehle', 'ebberg', 'bilsteinhoehle'])
assert.equal(getEarthMicroregionByLandmark('earth-de-menden-hexenteich')?.id, sauerland.id)

const cyrenaica = getEarthMicroregion('earth-microregion-apollonia-cyrene')
assert.ok(cyrenaica)
assert.equal(cyrenaica.anchorLandmarkId, 'earth-ly-cyrene')
assert.deepEqual(cyrenaica.nodes.map(node => node.id), ['apollonia-susa', 'cyrene-road-transition', 'cyrene'])
assert.equal(getEarthMicroregionByLandmark('earth-ly-cyrene')?.id, cyrenaica.id)

const malta = getEarthMicroregion('earth-microregion-malta-hypogeum')
assert.ok(malta)
assert.equal(malta.anchorLandmarkId, 'earth-mt-hal-saflieni')
assert.deepEqual(malta.nodes.map(node => node.id), ['paola', 'hal-saflieni', 'national-museum-archaeology'])

const dwarka = getEarthMicroregion('earth-microregion-dwarka-coast')
assert.ok(dwarka)
assert.equal(dwarka.anchorLandmarkId, 'earth-in-dwarka')
assert.deepEqual(dwarka.nodes.map(node => node.id), ['dwarka', 'dwarka-offshore-archaeology', 'bet-dwarka'])
assert.equal(getEarthMicroregionByLandmark('earth-in-dwarka')?.id, dwarka.id)

const crete = getEarthMicroregion('earth-microregion-crete-phaistos')
assert.ok(crete)
assert.equal(crete.anchorLandmarkId, 'earth-gr-phaistos')
assert.deepEqual(crete.nodes.map(node => node.id), ['heraklion', 'heraklion-archaeological-museum', 'phaistos'])
assert.equal(getEarthMicroregionByLandmark('earth-gr-phaistos')?.id, crete.id)

const jura = getEarthMicroregion('earth-microregion-vuiteboeuf-sainte-croix')
assert.ok(jura)
assert.equal(jura.anchorLandmarkId, 'earth-ch-vuiteboeuf')
assert.deepEqual(jura.nodes.map(node => node.id), ['vuiteboeuf', 'covatannaz', 'sainte-croix'])
assert.equal(getEarthMicroregionByLandmark('earth-ch-vuiteboeuf')?.id, jura.id)
assert.equal(getEarthMicroregionByLandmark('earth-de-frankfurt-senckenberg')?.id, frankfurt.id)
assert.equal(getEarthMicroregionByLandmark('earth-mt-hal-saflieni')?.id, malta.id)
assert.equal(getEarthMicroregion('does-not-exist'), undefined)

console.log('earth microregion tests passed')
