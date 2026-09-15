import type { SurfaceVehicleProfileEntry } from './vehicles/surfaceProfileResolution'
import { resolveSurfaceVehicleProfile } from './vehicles/surfaceProfileResolution'

/**
 * Read-only integration of KUEPER Engineering revision
 * `ENG-EARTH-SURFACE-LOGISTICS-r1`.
 *
 * Engineering source of truth:
 * kueper-engineering/vehicles/earth-surface-logistics-r1.json
 *
 * Earth continues to own OSM/terrain route multipliers. These entries only
 * supply the absolute frame and operating values approved by Engineering.
 */
export const EARTH_SURFACE_ENGINEERING_REVISION = 'ENG-EARTH-SURFACE-LOGISTICS-r1'

export const EARTH_SURFACE_ENGINEERING_PROFILES: readonly SurfaceVehicleProfileEntry[] = [
  {
    sourceId: `${EARTH_SURFACE_ENGINEERING_REVISION}:ENG-VEH-0001`,
    frame: {
      id: 'eng-earth-cargo-rover-r1',
      name: 'Earth Cargo Rover ECR-8',
      role: 'cargo-rover',
      domains: ['surface'],
      mobilityModes: ['wheeled'],
      dryMassKg: 6500,
      cargo: { massCapacityKg: 8000 },
      crew: { minCrew: 0, maxCrew: 2 },
      energyStores: [{ id: 'battery', carrier: 'electricity', capacity: 280, unit: 'kWh' }],
      environment: {
        gravityMs2: { min: 9.0, max: 10.2 },
        vacuumCapable: false,
        atmosphereRequired: true,
        pressurized: true,
        dustTolerant: true,
        temperatureC: { min: -30, max: 50 },
      },
      surfaceMobility: {
        mode: 'wheeled',
        safeLongitudinalSlopeDeg: 12,
        referenceSpeedKph: 50,
      },
    },
    operationProfile: {
      energyStoreId: 'battery',
      nominalConsumptionPerKm: 0.95,
      wearPerOperatingHour: 0.2,
    },
  },
  {
    sourceId: `${EARTH_SURFACE_ENGINEERING_REVISION}:ENG-VEH-0002`,
    frame: {
      id: 'eng-earth-heavy-hauler-r1',
      name: 'Earth Heavy Hauler EHH-22',
      role: 'heavy-hauler',
      domains: ['surface'],
      mobilityModes: ['wheeled'],
      dryMassKg: 18000,
      cargo: { massCapacityKg: 22000 },
      crew: { minCrew: 0, maxCrew: 2 },
      energyStores: [{ id: 'battery', carrier: 'electricity', capacity: 560, unit: 'kWh' }],
      environment: {
        gravityMs2: { min: 9.0, max: 10.2 },
        vacuumCapable: false,
        atmosphereRequired: true,
        pressurized: true,
        dustTolerant: true,
        temperatureC: { min: -30, max: 50 },
      },
      surfaceMobility: {
        mode: 'wheeled',
        safeLongitudinalSlopeDeg: 8,
        referenceSpeedKph: 45,
      },
    },
    operationProfile: {
      energyStoreId: 'battery',
      nominalConsumptionPerKm: 1.85,
      wearPerOperatingHour: 0.125,
    },
  },
]

export function resolveEarthSurfaceEngineeringProfile(frameId: string) {
  return resolveSurfaceVehicleProfile(frameId, EARTH_SURFACE_ENGINEERING_PROFILES)
}
