import assert from 'node:assert/strict'
import { assessEarthRoadTraversal, classifyEarthRoad } from '../earthSurfaceLogistics'
import { assessMoonSurfaceRoute } from '../moonSurfaceLogistics'
import {
  buildSurfaceRouteSnapshot,
  estimateSurfaceMission,
  traversalFromEarthAssessment,
  traversalFromMoonAssessment,
  type SurfaceMissionPlan,
  type SurfaceOperationProfile,
} from './surfaceMission'
import type { VehicleFrame, VehicleInstance } from './types'

const frame: VehicleFrame = {
  id: 'test-electric-hauler',
  name: 'Test Electric Hauler',
  role: 'heavy-hauler',
  domains: ['surface'],
  mobilityModes: ['wheeled'],
  dryMassKg: 8000,
  cargo: { massCapacityKg: 12000 },
  crew: { minCrew: 0, maxCrew: 2 },
  energyStores: [{ id: 'battery', carrier: 'electricity', capacity: 120, unit: 'kWh' }],
  environment: {
    vacuumCapable: false,
    atmosphereRequired: true,
    pressurized: true,
  },
  surfaceMobility: {
    mode: 'wheeled',
    safeLongitudinalSlopeDeg: 16,
    referenceSpeedKph: 60,
  },
}

const instance: VehicleInstance = {
  id: 'truck-1',
  frameId: frame.id,
  ownerId: 'player-1',
  locationId: 'earth',
  status: 'ready',
  condition: 100,
  wear: 0,
  energy: [{ storeId: 'battery', amount: 100 }],
  cargo: [{ commodityId: 'metal', amount: 10, unit: 't' }],
  crewIds: [],
  modules: [],
  modifications: {},
  emergentState: {},
}

const profile: SurfaceOperationProfile = {
  energyStoreId: 'battery',
  nominalConsumptionPerKm: 1.5,
  wearPerOperatingHour: 0.2,
}

const earthRoad = assessEarthRoadTraversal(
  classifyEarthRoad({ highway: 'service', surface: 'asphalt' }, 'heavy-hauler'),
  { role: 'heavy-hauler', safeLongitudinalSlopeDeg: 16 },
  2,
)

const earthPlan: SurfaceMissionPlan = {
  routeId: 'earth-mine-hub',
  originInventoryId: 'mine-inventory',
  destinationInventoryId: 'hub-inventory',
  segments: [{ id: 'road-1', distanceKm: 20, traversal: traversalFromEarthAssessment(earthRoad) }],
}

const estimate = estimateSurfaceMission(frame, instance, profile, earthPlan)
assert.equal(estimate.feasible, true)
assert.equal(estimate.distanceKm, 20)
assert.equal(estimate.cargoMassKg, 10000)
assert.ok((estimate.etaSeconds ?? 0) > 0)
assert.ok((estimate.energyRequired ?? 0) > 30)
assert.ok((estimate.wearIncrement ?? 0) > 0)

const snapshot = buildSurfaceRouteSnapshot(frame, instance, profile, earthPlan)
assert.equal(snapshot.kind, 'surface-vehicle-route-v1')
assert.equal(snapshot.routeId, earthPlan.routeId)
assert.equal(snapshot.passable, true)
assert.equal(snapshot.distanceKm, 20)
assert.ok(snapshot.etaSeconds > 0)
assert.ok(snapshot.energyRequired > 30)

const overloaded: VehicleInstance = {
  ...instance,
  cargo: [{ commodityId: 'metal', amount: 13, unit: 't' }],
}
assert.equal(estimateSurfaceMission(frame, overloaded, profile, earthPlan).blockReasons.includes('cargo-capacity-exceeded'), true)

const lowEnergy: VehicleInstance = {
  ...instance,
  energy: [{ storeId: 'battery', amount: 5 }],
}
assert.equal(estimateSurfaceMission(frame, lowEnergy, profile, earthPlan).blockReasons.includes('insufficient-energy'), true)

const lunarFrame: VehicleFrame = {
  ...frame,
  id: 'test-lunar-rover',
  role: 'cargo-rover',
  environment: {
    vacuumCapable: true,
    atmosphereRequired: false,
    pressurized: true,
    dustTolerant: true,
  },
  surfaceMobility: {
    mode: 'wheeled',
    safeLongitudinalSlopeDeg: 18,
    referenceSpeedKph: 20,
  },
}

const moonAssessment = assessMoonSurfaceRoute({
  routeClass: 'prepared-track',
  metrics: {
    distanceM: 10000,
    ascentM: 120,
    descentM: 80,
    meanAbsSlopeDeg: 2.5,
    maxAbsSlopeDeg: 7,
  },
  vehicle: { role: 'cargo-rover', safeLongitudinalSlopeDeg: 18 },
  roughness01: 0.2,
})
const moonPlan: SurfaceMissionPlan = {
  routeId: 'shackleton-mine-hub',
  originInventoryId: 'lunar-mine',
  destinationInventoryId: 'shackleton-hub',
  segments: [{ id: 'track-1', distanceKm: 10, traversal: traversalFromMoonAssessment(moonAssessment) }],
}
const moonEstimate = estimateSurfaceMission(lunarFrame, instance, profile, moonPlan)
assert.equal(moonEstimate.feasible, true)
assert.ok((moonEstimate.etaSeconds ?? 0) > 1800)
assert.ok((moonEstimate.energyRequired ?? 0) > 15)

const blockedMoon = assessMoonSurfaceRoute({
  routeClass: 'offroad',
  metrics: {
    distanceM: 1000,
    ascentM: 300,
    descentM: 0,
    meanAbsSlopeDeg: 20,
    maxAbsSlopeDeg: 30,
  },
  vehicle: { role: 'cargo-rover', safeLongitudinalSlopeDeg: 18 },
})
const blockedPlan: SurfaceMissionPlan = {
  ...moonPlan,
  segments: [{ id: 'blocked', distanceKm: 1, traversal: traversalFromMoonAssessment(blockedMoon) }],
}
assert.equal(estimateSurfaceMission(lunarFrame, instance, profile, blockedPlan).blockReasons.includes('route-blocked'), true)

console.log('Surface vehicle mission planning: OK')
