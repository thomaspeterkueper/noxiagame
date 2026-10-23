import assert from 'node:assert/strict'
import {
  MOON_SURFACE_ENGINEERING_PROFILES,
  MOON_SURFACE_ENGINEERING_REVISION,
  resolveMoonSurfaceEngineeringProfile,
  resolveMoonSurfaceRouteClassEngineering,
} from './moonSurfaceEngineering'

assert.equal(MOON_SURFACE_ENGINEERING_REVISION, 'ENG-LUNAR-SURFACE-LOGISTICS-r1')
assert.equal(MOON_SURFACE_ENGINEERING_PROFILES.length, 2)

const rover = resolveMoonSurfaceEngineeringProfile('eng-lunar-cargo-rover-r1')
assert.equal(rover.status, 'resolved')
if (rover.status === 'resolved') {
  assert.equal(rover.frame.role, 'cargo-rover')
  assert.equal(rover.frame.dryMassKg, 5200)
  assert.equal(rover.frame.cargo.massCapacityKg, 6000)
  assert.equal(rover.frame.energyStores[0].capacity, 240)
  assert.equal(rover.frame.surfaceMobility?.safeLongitudinalSlopeDeg, 10)
  assert.equal(rover.frame.surfaceMobility?.referenceSpeedKph, 12)
  assert.equal(rover.operationProfile.nominalConsumptionPerKm, 1.35)
  assert.equal(rover.operationProfile.wearPerOperatingHour, 0.25)
  assert.equal(rover.sourceId, 'ENG-LUNAR-SURFACE-LOGISTICS-r1:ENG-VEH-0003')
}

const roverOffroad = resolveMoonSurfaceRouteClassEngineering('eng-lunar-cargo-rover-r1', 'offroad')
assert.deepEqual(roverOffroad, { referenceSpeedKph: 5, energyFactor: 1.55, wearFactor: 1.8 })

const hauler = resolveMoonSurfaceEngineeringProfile('eng-lunar-heavy-hauler-r1')
assert.equal(hauler.status, 'resolved')
if (hauler.status === 'resolved') {
  assert.equal(hauler.frame.role, 'heavy-hauler')
  assert.equal(hauler.frame.dryMassKg, 15000)
  assert.equal(hauler.frame.cargo.massCapacityKg, 20000)
  assert.equal(hauler.frame.energyStores[0].capacity, 520)
  assert.equal(hauler.frame.surfaceMobility?.safeLongitudinalSlopeDeg, 7)
  assert.equal(hauler.frame.surfaceMobility?.referenceSpeedKph, 8)
  assert.equal(hauler.operationProfile.nominalConsumptionPerKm, 2.8)
  assert.equal(hauler.operationProfile.wearPerOperatingHour, 0.2)
  assert.equal(hauler.sourceId, 'ENG-LUNAR-SURFACE-LOGISTICS-r1:ENG-VEH-0004')
}

// The historical bootstrap identity must remain unresolved rather than receiving
// Engineering values by role/name inference.
const legacy = resolveMoonSurfaceEngineeringProfile('cargo-rover-reference')
assert.equal(legacy.status, 'unresolved')
if (legacy.status === 'unresolved') assert.equal(legacy.reason, 'frame-not-found')

console.log('moon surface engineering registry tests passed')
