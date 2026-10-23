import assert from 'node:assert/strict'
import {
  LOGISTICS_CARGO_MASS_AUTHORITIES,
  resolveAuthoritativeLogisticsCargoMass,
} from './logisticsCargoMassAuthority'

assert.equal(LOGISTICS_CARGO_MASS_AUTHORITIES.length, 1)
assert.equal(LOGISTICS_CARGO_MASS_AUTHORITIES[0]?.commodityId, 'water')

const waterTonnes = resolveAuthoritativeLogisticsCargoMass({
  commodityId: 'water',
  amount: 3,
  unit: 't',
})
assert.equal(waterTonnes.resolution.status, 'resolved')
if (waterTonnes.resolution.status === 'resolved') {
  assert.equal(waterTonnes.resolution.massKg, 3000)
  assert.deepEqual(waterTonnes.resolution.cargo, {
    commodityId: 'water',
    amount: 3,
    unit: 't',
  })
  assert.equal(waterTonnes.resolution.sourceId, 'KUEPER-Engineering:ENG-COM-0001:r1')
}
assert.deepEqual(waterTonnes.source, {
  repository: 'thomaspeterkueper/kueper-engineering',
  reference: 'components/logistics/engineering-commodities-r1.json#ENG-COM-0001',
})

const waterKg = resolveAuthoritativeLogisticsCargoMass({
  commodityId: 'water',
  amount: 750,
  unit: 'kg',
})
assert.equal(waterKg.resolution.status, 'resolved')
if (waterKg.resolution.status === 'resolved') {
  assert.equal(waterKg.resolution.massKg, 750)
}

for (const commodityId of ['energy', 'metal', 'components']) {
  const unresolved = resolveAuthoritativeLogisticsCargoMass({
    commodityId,
    amount: 1,
    unit: 't',
  })
  assert.equal(unresolved.resolution.status, 'unresolved')
  if (unresolved.resolution.status === 'unresolved') {
    assert.equal(unresolved.resolution.reason, 'mass-basis-not-authoritative')
  }
  assert.equal(unresolved.source, null)
}

const waterVolume = resolveAuthoritativeLogisticsCargoMass({
  commodityId: 'water',
  amount: 1,
  unit: 'm3',
})
assert.equal(waterVolume.resolution.status, 'unresolved')
if (waterVolume.resolution.status === 'unresolved') {
  assert.equal(waterVolume.resolution.reason, 'unsupported-unit')
}

console.log('authoritative logistics cargo mass tests passed')
