import assert from 'node:assert/strict'
import {
  EARTH_SURFACE_ENGINEERING_PROFILES,
  EARTH_SURFACE_ENGINEERING_REVISION,
  resolveEarthSurfaceEngineeringProfile,
} from './earthSurfaceEngineering'

assert.equal(EARTH_SURFACE_ENGINEERING_REVISION, 'ENG-EARTH-SURFACE-LOGISTICS-r1')
assert.equal(EARTH_SURFACE_ENGINEERING_PROFILES.length, 2)

const rover = resolveEarthSurfaceEngineeringProfile('eng-earth-cargo-rover-r1')
assert.equal(rover.status, 'resolved')
if (rover.status === 'resolved') {
  assert.equal(rover.frame.role, 'cargo-rover')
  assert.equal(rover.frame.dryMassKg, 6500)
  assert.equal(rover.frame.cargo.massCapacityKg, 8000)
  assert.equal(rover.frame.energyStores[0].capacity, 280)
  assert.equal(rover.frame.surfaceMobility?.safeLongitudinalSlopeDeg, 12)
  assert.equal(rover.frame.surfaceMobility?.referenceSpeedKph, 50)
  assert.equal(rover.operationProfile.nominalConsumptionPerKm, 0.95)
  assert.equal(rover.operationProfile.wearPerOperatingHour, 0.2)
  assert.equal(rover.sourceId, 'ENG-EARTH-SURFACE-LOGISTICS-r1:ENG-VEH-0001')
}

const hauler = resolveEarthSurfaceEngineeringProfile('eng-earth-heavy-hauler-r1')
assert.equal(hauler.status, 'resolved')
if (hauler.status === 'resolved') {
  assert.equal(hauler.frame.role, 'heavy-hauler')
  assert.equal(hauler.frame.dryMassKg, 18000)
  assert.equal(hauler.frame.cargo.massCapacityKg, 22000)
  assert.equal(hauler.frame.energyStores[0].capacity, 560)
  assert.equal(hauler.frame.surfaceMobility?.safeLongitudinalSlopeDeg, 8)
  assert.equal(hauler.frame.surfaceMobility?.referenceSpeedKph, 45)
  assert.equal(hauler.operationProfile.nominalConsumptionPerKm, 1.85)
  assert.equal(hauler.operationProfile.wearPerOperatingHour, 0.125)
  assert.equal(hauler.sourceId, 'ENG-EARTH-SURFACE-LOGISTICS-r1:ENG-VEH-0002')
}

// Legacy/bootstrap identity remains deliberately unresolved. Engineering r1 is
// bound only by exact frame id; no role/name migration happens implicitly.
const legacy = resolveEarthSurfaceEngineeringProfile('cargo-rover-reference')
assert.equal(legacy.status, 'unresolved')
if (legacy.status === 'unresolved') assert.equal(legacy.reason, 'frame-not-found')

const missing = resolveEarthSurfaceEngineeringProfile('')
assert.equal(missing.status, 'unresolved')
if (missing.status === 'unresolved') assert.equal(missing.reason, 'frame-id-required')

console.log('earth surface engineering registry tests passed')
