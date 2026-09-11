import assert from 'node:assert/strict'
import {
  canEnterApproach,
  canTransferCargoInArrivalPhase,
  holdingZoneClassForVessel,
  preferredHoldingZone,
} from './arrivalControl'

assert.equal(holdingZoneClassForVessel('surface-transfer-shuttle'), 'light-traffic')
assert.equal(holdingZoneClassForVessel('intersolar-standard'), 'standard-traffic')
assert.equal(holdingZoneClassForVessel('intersolar-heavy'), 'heavy-traffic')

assert.equal(preferredHoldingZone('phobos', 'intersolar-standard')?.id, 'phobos-h-standard')
assert.equal(preferredHoldingZone('phobos', 'intersolar-heavy')?.id, 'phobos-h-heavy')
assert.equal(preferredHoldingZone('prometheus', 'intersolar-standard')?.id, 'kepler-h-standard')
assert.equal(preferredHoldingZone('unknown', 'intersolar-standard'), null)

assert.equal(canEnterApproach({
  vesselId: 'ship-1',
  vesselClass: 'intersolar-standard',
  stationSlug: 'phobos',
  phase: 'holding',
  targetPortId: 'phobos-b1',
}), true)

assert.equal(canEnterApproach({
  vesselId: 'ship-1',
  vesselClass: 'intersolar-standard',
  stationSlug: 'phobos',
  phase: 'holding',
  targetPortId: null,
}), false)

assert.equal(canTransferCargoInArrivalPhase('holding'), false)
assert.equal(canTransferCargoInArrivalPhase('approach'), false)
assert.equal(canTransferCargoInArrivalPhase('docked'), true)

console.log('arrivalControl tests passed')
