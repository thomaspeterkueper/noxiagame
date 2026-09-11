import assert from 'node:assert/strict'
import { assessEarthRoadTraversal, classifyEarthRoad } from '../earthSurfaceLogistics'
import { assessMoonSurfaceRoute } from '../moonSurfaceLogistics'
import { emptyMaintenanceState } from './operations'
import {
  completeSurfaceMission,
  estimateSurfaceMission,
  startSurfaceMission,
  traversalFromEarthAssessment,
  traversalFromMoonAssessment,
  type SurfaceMissionPlan,
} from './surfaceMission'
import type { VehicleInstance, VehicleType } from './types'

const truckType: VehicleType = {
  id: 'test-electric-hauler',
  name: 'Test Electric Hauler',
  category: 'road_vehicle',
  mobilityDomains: ['surface-wheeled'],
  capabilities: ['cargo'],
  dryMassTonnes: 8,
  nominalSpeed: 60,
  nominalSpeedUnit: 'km/h',
  environment: {
    vacuumCapable: false,
    atmosphereRequired: true,
    pressurizedCabin: true,
    maxTerrainSlopeDeg: 16,
  },
  capacity: { cargoTonnes: 12 },
  energy: {
    carriers: ['electricity'],
    nominalConsumption: 1.5,
    consumptionUnit: 'kWh/km',
  },
  maintenance: {
    serviceIntervalDistanceKm: 100,
    baseWearPerOperatingHour: 0.2,
  },
}

const truck: VehicleInstance = {
  id: 'truck-1',
  typeId: truckType.id,
  ownerId: 'player-1',
  locationId: 'mine',
  status: 'ready',
  condition: 100,
  movement: null,
  energy: [{ carrier: 'electricity', amount: 100, capacity: 120, unit: 'kWh' }],
  cargo: [{ resourceId: 'ore', amount: 10, unit: 't' }],
  crew: { crewIds: [] },
  maintenance: emptyMaintenanceState(),
  modules: [],
  modifications: {},
  emergentState: {},
}

const earthRoad = assessEarthRoadTraversal(
  classifyEarthRoad({ highway: 'service', surface: 'asphalt' }, 'heavy-hauler'),
  { role: 'heavy-hauler', safeLongitudinalSlopeDeg: 16 },
  2,
)

const earthPlan: SurfaceMissionPlan = {
  routeId: 'earth-mine-hub',
  originId: 'mine',
  destinationId: 'hub',
  domain: 'surface-wheeled',
  segments: [
    { id: 'road-1', distanceKm: 20, traversal: traversalFromEarthAssessment(earthRoad) },
  ],
}

const earthEstimate = estimateSurfaceMission(truckType, truck, earthPlan)
assert.equal(earthEstimate.feasible, true)
assert.equal(earthEstimate.distanceKm, 20)
assert.ok((earthEstimate.durationHours ?? 0) > 0)
assert.ok((earthEstimate.energyRequired ?? 0) > 30, 'service-road + slope must cost more than nominal flat-road energy')
assert.equal(earthEstimate.cargoTonnes, 10)

const underway = startSurfaceMission(truckType, truck, earthPlan)
assert.equal(underway.status, 'operating')
assert.equal(underway.movement?.state, 'en-route')
assert.equal(underway.movement?.destinationId, 'hub')

const arrived = completeSurfaceMission(truckType, truck, earthPlan)
assert.equal(arrived.status, 'ready')
assert.equal(arrived.locationId, 'hub')
assert.equal(arrived.movement?.state, 'arrived')
assert.equal(arrived.movement?.progress, 1)
assert.equal(arrived.maintenance.distanceKm, 20)
assert.equal(arrived.maintenance.cycles, 1)
assert.ok(arrived.energy[0].amount < 70)

const overloaded: VehicleInstance = {
  ...truck,
  cargo: [{ resourceId: 'ore', amount: 13, unit: 't' }],
}
assert.deepEqual(
  estimateSurfaceMission(truckType, overloaded, earthPlan).blockReasons,
  ['cargo-capacity-exceeded'],
)

const lowEnergy: VehicleInstance = {
  ...truck,
  energy: [{ carrier: 'electricity', amount: 5, capacity: 120, unit: 'kWh' }],
}
assert.equal(estimateSurfaceMission(truckType, lowEnergy, earthPlan).blockReasons.includes('insufficient-energy'), true)

const lunarType: VehicleType = {
  ...truckType,
  id: 'test-lunar-rover',
  category: 'surface_rover',
  nominalSpeed: 20,
  environment: {
    vacuumCapable: true,
    atmosphereRequired: false,
    pressurizedCabin: true,
    maxTerrainSlopeDeg: 18,
    dustTolerance: 'extreme',
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
  originId: 'lunar-mine',
  destinationId: 'shackleton-hub',
  domain: 'surface-wheeled',
  segments: [{ id: 'track-1', distanceKm: 10, traversal: traversalFromMoonAssessment(moonAssessment) }],
}

const moonEstimate = estimateSurfaceMission(lunarType, truck, moonPlan)
assert.equal(moonEstimate.feasible, true)
assert.ok((moonEstimate.durationHours ?? 0) > 0.5)
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
assert.equal(estimateSurfaceMission(lunarType, truck, blockedPlan).blockReasons.includes('route-blocked'), true)

console.log('Surface vehicle mission vertical slice: OK')
