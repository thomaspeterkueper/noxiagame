import assert from 'node:assert/strict'
import { resolveSurfaceVehicleProfile, type SurfaceVehicleProfileEntry } from './surfaceProfileResolution'
import type { VehicleFrame } from './types'

const frame: VehicleFrame = {
  id: 'eng-earth-cargo-rover-r1',
  name: 'Earth Cargo Rover',
  role: 'cargo-rover',
  domains: ['surface'],
  mobilityModes: ['wheeled'],
  dryMassKg: 4200,
  cargo: { massCapacityKg: 6000 },
  crew: { minCrew: 0, maxCrew: 2 },
  energyStores: [{ id: 'battery', carrier: 'electricity', capacity: 180, unit: 'kWh' }],
  environment: {
    vacuumCapable: false,
    atmosphereRequired: true,
    pressurized: true,
  },
  surfaceMobility: {
    mode: 'wheeled',
    safeLongitudinalSlopeDeg: 14,
    referenceSpeedKph: 45,
  },
}

const entry: SurfaceVehicleProfileEntry = {
  frame,
  operationProfile: {
    energyStoreId: 'battery',
    nominalConsumptionPerKm: 1.2,
    wearPerOperatingHour: 0.15,
  },
  sourceId: 'ENG-EARTH-CARGO-ROVER-r1',
}

const resolved = resolveSurfaceVehicleProfile(frame.id, [entry])
assert.equal(resolved.status, 'resolved')
if (resolved.status === 'resolved') {
  assert.equal(resolved.frame.id, frame.id)
  assert.equal(resolved.operationProfile.energyStoreId, 'battery')
  assert.equal(resolved.sourceId, 'ENG-EARTH-CARGO-ROVER-r1')
}

const noRoleFallback = resolveSurfaceVehicleProfile('unknown-cargo-rover-frame', [entry])
assert.equal(noRoleFallback.status, 'unresolved')
if (noRoleFallback.status === 'unresolved') assert.equal(noRoleFallback.reason, 'frame-not-found')

const missingProfile = resolveSurfaceVehicleProfile(frame.id, [{ ...entry, operationProfile: null }])
assert.equal(missingProfile.status, 'unresolved')
if (missingProfile.status === 'unresolved') assert.equal(missingProfile.reason, 'operation-profile-missing')

const missingEnergyStore = resolveSurfaceVehicleProfile(frame.id, [{
  ...entry,
  operationProfile: { ...entry.operationProfile!, energyStoreId: 'hydrogen' },
}])
assert.equal(missingEnergyStore.status, 'unresolved')
if (missingEnergyStore.status === 'unresolved') {
  assert.equal(missingEnergyStore.reason, 'operation-profile-energy-store-missing')
}

const duplicateFrame = resolveSurfaceVehicleProfile(frame.id, [entry, { ...entry, sourceId: 'duplicate' }])
assert.equal(duplicateFrame.status, 'unresolved')
if (duplicateFrame.status === 'unresolved') assert.equal(duplicateFrame.reason, 'duplicate-frame-id')

const invalidFrame = resolveSurfaceVehicleProfile(frame.id, [{
  ...entry,
  frame: { ...frame, dryMassKg: 0 },
}])
assert.equal(invalidFrame.status, 'unresolved')
if (invalidFrame.status === 'unresolved') assert.equal(invalidFrame.reason, 'frame-invalid')

const invalidProfile = resolveSurfaceVehicleProfile(frame.id, [{
  ...entry,
  operationProfile: { ...entry.operationProfile!, nominalConsumptionPerKm: Number.NaN },
}])
assert.equal(invalidProfile.status, 'unresolved')
if (invalidProfile.status === 'unresolved') assert.equal(invalidProfile.reason, 'operation-profile-invalid')

console.log('surface vehicle profile resolution tests passed')
