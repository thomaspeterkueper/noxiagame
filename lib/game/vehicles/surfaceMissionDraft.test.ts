import assert from 'node:assert/strict'
import {
  estimateProspectiveSurfaceMission,
  prepareProspectiveSurfaceMission,
  projectVehicleCargoForSurfaceMission,
} from './surfaceMissionDraft'
import type { SurfaceMissionPlan, SurfaceOperationProfile } from './surfaceMission'
import type { VehicleFrame, VehicleInstance } from './types'

const frame: VehicleFrame = {
  id: 'test-cargo-rover',
  name: 'Test Cargo Rover',
  role: 'cargo-rover',
  domains: ['surface'],
  mobilityModes: ['wheeled'],
  dryMassKg: 4200,
  cargo: { massCapacityKg: 6000 },
  crew: { minCrew: 0, maxCrew: 2 },
  energyStores: [{ id: 'battery', carrier: 'electricity', capacity: 150, unit: 'kWh' }],
  environment: {
    vacuumCapable: false,
    atmosphereRequired: true,
    pressurized: true,
  },
  surfaceMobility: {
    mode: 'wheeled',
    safeLongitudinalSlopeDeg: 18,
    referenceSpeedKph: 40,
  },
}

const instance: VehicleInstance = {
  id: 'vehicle-1',
  frameId: frame.id,
  ownerId: 'player-1',
  locationId: 'earth',
  status: 'ready',
  condition: 100,
  wear: 0,
  energy: [{ storeId: 'battery', amount: 120 }],
  cargo: [],
  crewIds: [],
  modules: [],
  modifications: {},
  emergentState: {},
}

const operationProfile: SurfaceOperationProfile = {
  energyStoreId: 'battery',
  nominalConsumptionPerKm: 1.2,
  wearPerOperatingHour: 0.15,
}

const plan: SurfaceMissionPlan = {
  routeId: 'earth:facility-a-to-depot-b',
  originInventoryId: 'facility-a',
  destinationInventoryId: 'depot-b',
  segments: [{
    id: 'road-1',
    distanceKm: 10,
    traversal: {
      passable: true,
      speedMultiplier: 0.8,
      energyMultiplier: 1.1,
      wearMultiplier: 1.2,
    },
  }],
}

const projected = projectVehicleCargoForSurfaceMission(instance, [
  { commodityId: 'metal', amount: 5, unit: 't' },
])
assert.equal(projected.cargo.length, 1)
assert.equal(projected.cargo[0].amount, 5)
assert.equal(instance.cargo.length, 0)

const feasible = prepareProspectiveSurfaceMission({
  frame,
  instance,
  operationProfile,
  plan,
  projectedCargo: [{ commodityId: 'metal', amount: 5, unit: 't' }],
})
assert.equal(feasible.estimate.feasible, true)
assert.equal(feasible.estimate.cargoMassKg, 5000)
assert.ok((feasible.estimate.etaSeconds ?? 0) > 0)
assert.ok((feasible.estimate.energyRequired ?? 0) > 0)
assert.equal(feasible.routeSnapshot?.kind, 'surface-vehicle-route-v1')

const overloaded = prepareProspectiveSurfaceMission({
  frame,
  instance,
  operationProfile,
  plan,
  projectedCargo: [{ commodityId: 'metal', amount: 7, unit: 't' }],
})
assert.equal(overloaded.estimate.feasible, false)
assert.ok(overloaded.estimate.blockReasons.includes('cargo-capacity-exceeded'))
assert.equal(overloaded.estimate.cargoMassKg, 7000)
assert.equal(overloaded.routeSnapshot, null)

const unresolved = estimateProspectiveSurfaceMission({
  frame,
  instance,
  operationProfile,
  plan,
  projectedCargo: [{ commodityId: 'components', amount: 4, unit: 'game-unit' }],
})
assert.equal(unresolved.feasible, false)
assert.ok(unresolved.blockReasons.includes('cargo-mass-unresolved'))
