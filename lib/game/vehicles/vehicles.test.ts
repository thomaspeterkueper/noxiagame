import assert from 'node:assert/strict'
import { EXPLORATION_ASSET_TYPES } from '../explorationAssets'
import { SHIP_FRAMES } from '../ships'
import { SURFACE_TRANSFER_CRAFT } from '../transportDomains'
import {
  applyOperatingWear,
  emptyMaintenanceState,
  isEnvironmentCompatible,
  maintenanceDue,
  supportsMobilityDomain,
  vehicleTypeFromExplorationAsset,
  vehicleTypeFromShipFrame,
  vehicleTypeFromTransferCraft,
} from './index'

const rover = vehicleTypeFromExplorationAsset(EXPLORATION_ASSET_TYPES.rover_p)
assert.equal(rover.category, 'surface_rover')
assert.equal(supportsMobilityDomain(rover, 'surface-wheeled'), true)
assert.equal(rover.capabilities.includes('exploration'), true)
assert.equal(isEnvironmentCompatible(rover.environment, {
  gravityMs2: 1.62,
  vacuum: true,
  temperatureC: -30,
}), true)

const drone = vehicleTypeFromExplorationAsset(EXPLORATION_ASSET_TYPES.vex_47)
assert.equal(drone.category, 'exploration_drone')
assert.equal(drone.capabilities.includes('autonomous'), true)
assert.equal(isEnvironmentCompatible(drone.environment, {
  gravityMs2: 1.62,
  vacuum: true,
}), false)

for (const frame of Object.values(SHIP_FRAMES)) {
  const vehicle = vehicleTypeFromShipFrame(frame)
  assert.equal(vehicle.category, 'spacecraft')
  assert.equal(vehicle.dryMassTonnes, frame.hullMass)
  assert.equal(vehicle.moduleSlots, frame.slots)
  assert.equal(vehicle.capabilities.includes('intersolar_transfer'), true)
  assert.equal(supportsMobilityDomain(vehicle, 'interplanetary'), true)
}

const asce = vehicleTypeFromTransferCraft(SURFACE_TRANSFER_CRAFT['asce-0.3p'])
assert.equal(asce.category, 'surface_transfer_craft')
assert.equal(asce.capabilities.includes('surface_landing'), true)
assert.equal(asce.capabilities.includes('intersolar_transfer'), false)

const maintenanceSpec = {
  serviceIntervalHours: 100,
  serviceIntervalDistanceKm: 1_000,
  baseWearPerOperatingHour: 0.2,
}
let maintenance = emptyMaintenanceState()
maintenance = applyOperatingWear(maintenance, 40, 300, 0, maintenanceSpec)
assert.equal(maintenance.wear, 8)
assert.equal(maintenance.serviceDue, false)
assert.equal(maintenanceDue(maintenance, maintenanceSpec), false)
maintenance = applyOperatingWear(maintenance, 60, 200, 0, maintenanceSpec)
assert.equal(maintenance.operatingHours, 100)
assert.equal(maintenance.serviceDue, true)

console.log('Unified vehicle domain: OK')
