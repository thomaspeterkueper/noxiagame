import assert from 'node:assert/strict'
import { getShipDockingProfile, getShipDockingVesselClass } from './shipDockingProfiles'

assert.equal(getShipDockingVesselClass('mk1'), 'intersolar-standard')
assert.equal(getShipDockingVesselClass('freighter_mk1'), 'intersolar-standard')
assert.equal(getShipDockingVesselClass('heavy'), 'intersolar-heavy')
assert.equal(getShipDockingVesselClass('heavy_hauler'), 'intersolar-heavy')
assert.equal(getShipDockingVesselClass('asce-0.3p'), 'surface-transfer-shuttle')
assert.equal(getShipDockingProfile('fast_courier')?.canonicalFrameId, 'fast')
assert.equal(getShipDockingProfile('unknown-frame'), null)

console.log('shipDockingProfiles tests passed')
