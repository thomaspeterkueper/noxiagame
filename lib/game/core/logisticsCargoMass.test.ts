import assert from 'node:assert/strict'
import { resolveLogisticsCargoMass } from './logisticsCargoMass'

const kilograms = resolveLogisticsCargoMass(
  { commodityId: 'metal-billet', amount: 750, unit: 'kg' },
  { kind: 'catalog-unit', authority: 'authoritative', sourceId: 'catalog:v2' },
)
assert.equal(kilograms.status, 'resolved')
if (kilograms.status === 'resolved') {
  assert.equal(kilograms.massKg, 750)
  assert.deepEqual(kilograms.cargo, { commodityId: 'metal-billet', amount: 750, unit: 'kg' })
  assert.equal(kilograms.resolution, 'direct-mass-unit')
}

const tonnes = resolveLogisticsCargoMass(
  { commodityId: 'regolith', amount: 2.5, unit: 't' },
  { kind: 'catalog-unit', authority: 'authoritative', sourceId: 'catalog:v2' },
)
assert.equal(tonnes.status, 'resolved')
if (tonnes.status === 'resolved') {
  assert.equal(tonnes.massKg, 2500)
  assert.deepEqual(tonnes.cargo, { commodityId: 'regolith', amount: 2.5, unit: 't' })
}

const explicitPieceMass = resolveLogisticsCargoMass(
  { commodityId: 'component-crate', amount: 4, unit: 'crate' },
  {
    kind: 'mass-per-unit',
    authority: 'authoritative',
    massPerUnitKg: 125,
    sourceId: 'ENG-CARGO-COMPONENT-CRATE-r1',
  },
)
assert.equal(explicitPieceMass.status, 'resolved')
if (explicitPieceMass.status === 'resolved') {
  assert.equal(explicitPieceMass.massKg, 500)
  assert.deepEqual(explicitPieceMass.cargo, { commodityId: 'component-crate', amount: 500, unit: 'kg' })
  assert.equal(explicitPieceMass.resolution, 'mass-per-unit')
  assert.equal(explicitPieceMass.sourceId, 'ENG-CARGO-COMPONENT-CRATE-r1')
}

const legacyTonnes = resolveLogisticsCargoMass(
  { commodityId: 'energy', amount: 10, unit: 't' },
  { kind: 'catalog-unit', authority: 'legacy-default' },
)
assert.deepEqual(legacyTonnes, {
  status: 'unresolved',
  commodityId: 'energy',
  sourceAmount: 10,
  sourceUnit: 't',
  reason: 'legacy-unit-not-authoritative',
})

const gameUnit = resolveLogisticsCargoMass(
  { commodityId: 'components', amount: 10, unit: 'game-unit' },
  { kind: 'catalog-unit', authority: 'authoritative' },
)
assert.equal(gameUnit.status, 'unresolved')
if (gameUnit.status === 'unresolved') assert.equal(gameUnit.reason, 'unsupported-unit')

const unknownBasis = resolveLogisticsCargoMass(
  { commodityId: 'water', amount: 12, unit: 'kg' },
  { kind: 'catalog-unit', authority: 'unknown' },
)
assert.equal(unknownBasis.status, 'unresolved')
if (unknownBasis.status === 'unresolved') assert.equal(unknownBasis.reason, 'mass-basis-not-authoritative')

const missingUnit = resolveLogisticsCargoMass(
  { commodityId: 'water', amount: 12, unit: null },
  { kind: 'catalog-unit', authority: 'authoritative' },
)
assert.equal(missingUnit.status, 'unresolved')
if (missingUnit.status === 'unresolved') assert.equal(missingUnit.reason, 'missing-unit')

const invalidAmount = resolveLogisticsCargoMass(
  { commodityId: 'metal', amount: 0, unit: 'kg' },
  { kind: 'catalog-unit', authority: 'authoritative' },
)
assert.equal(invalidAmount.status, 'unresolved')
if (invalidAmount.status === 'unresolved') assert.equal(invalidAmount.reason, 'invalid-amount')

const invalidConversion = resolveLogisticsCargoMass(
  { commodityId: 'component-crate', amount: 4, unit: 'crate' },
  { kind: 'mass-per-unit', authority: 'authoritative', massPerUnitKg: Number.NaN },
)
assert.equal(invalidConversion.status, 'unresolved')
if (invalidConversion.status === 'unresolved') assert.equal(invalidConversion.reason, 'invalid-mass-per-unit')

console.log('logistics cargo mass contract tests passed')
