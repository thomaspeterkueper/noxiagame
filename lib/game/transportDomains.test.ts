import assert from 'node:assert/strict'
import { SHIP_FRAMES } from './ships'
import {
  INTERSOLAR_SHIP_FRAME_IDS,
  SURFACE_TRANSFER_CRAFT,
  isSurfaceShuttlePortBuilding,
  mayPerformIntersolarLeg,
  mayUsePlanetarySurfacePort,
  shipFrameMayUsePlanetarySurfacePort,
  shipFrameOperatingDomain,
} from './transportDomains'

const asce = SURFACE_TRANSFER_CRAFT['asce-0.3p']
assert.ok(asce, 'ASCE 0.3P must be registered as canonical transfer craft')
assert.equal(asce.operatingDomain, 'surface-transfer-shuttle')
assert.equal(asce.mayUsePlanetarySurfacePort, true)
assert.equal(asce.mayPerformIntersolarLeg, false)

assert.equal(mayUsePlanetarySurfacePort('surface-transfer-shuttle'), true)
assert.equal(mayUsePlanetarySurfacePort('intersolar'), false)
assert.equal(mayPerformIntersolarLeg('surface-transfer-shuttle'), false)
assert.equal(mayPerformIntersolarLeg('intersolar'), true)

for (const buildingId of [
  'spaceport_core',
  'spaceport_pad_mini',
  'spaceport_pad_standard',
  'spaceport_service',
  'spaceport_storage',
  'landing_pad',
]) {
  assert.equal(isSurfaceShuttlePortBuilding(buildingId), true, `${buildingId} must remain shuttle-port infrastructure`)
}
assert.equal(isSurfaceShuttlePortBuilding('shipyard'), false)

const currentFrameIds = Object.keys(SHIP_FRAMES).sort()
assert.deepEqual(
  [...INTERSOLAR_SHIP_FRAME_IDS].sort(),
  currentFrameIds,
  'every current SHIP_FRAMES hull must be explicitly classified; update the transport domain when adding a frame',
)

for (const frameId of currentFrameIds) {
  assert.equal(shipFrameOperatingDomain(frameId), 'intersolar', `${frameId} must remain an intersolar frame`)
  assert.equal(shipFrameMayUsePlanetarySurfacePort(frameId), false, `${frameId} must never use a planetary shuttle port`)
}
assert.equal(shipFrameOperatingDomain('unknown-frame'), null)
assert.equal(shipFrameMayUsePlanetarySurfacePort('unknown-frame'), false)

console.log('Transport-domain semantics: OK')
