import type { SurfaceVehicleProfileEntry } from './vehicles/surfaceProfileResolution'
import { resolveSurfaceVehicleProfile } from './vehicles/surfaceProfileResolution'

export type MoonSurfaceEngineeringRouteClass = 'offroad' | 'prepared-track' | 'hardened-road'

export interface MoonSurfaceRouteClassEngineeringProfile {
  referenceSpeedKph: number
  energyFactor: number
  wearFactor: number
}

export interface MoonSurfaceEngineeringProfileEntry extends SurfaceVehicleProfileEntry {
  engineeringId: 'ENG-VEH-0003' | 'ENG-VEH-0004'
  routeClasses: Readonly<Record<MoonSurfaceEngineeringRouteClass, MoonSurfaceRouteClassEngineeringProfile>>
  engineeringEnvelope: {
    maxLongitudinalSlopeDeg: { loaded: number; unloaded: number }
    maxCrossSlopeDeg: { loaded: number; unloaded: number }
    regenerativeBraking: boolean
  }
}

/**
 * Read-only integration of KUEPER Engineering revision
 * `ENG-LUNAR-SURFACE-LOGISTICS-r1` (status: provisional-selected).
 *
 * Engineering source of truth:
 * kueper-engineering/vehicles/lunar-surface-logistics-r1.json
 *
 * Moon owns terrain/routing policy. Engineering owns the absolute vehicle frame,
 * mobility envelope, energy anchor and route-class engineering factors.
 */
export const MOON_SURFACE_ENGINEERING_REVISION = 'ENG-LUNAR-SURFACE-LOGISTICS-r1'

export const MOON_SURFACE_ENGINEERING_PROFILES: readonly MoonSurfaceEngineeringProfileEntry[] = [
  {
    engineeringId: 'ENG-VEH-0003',
    sourceId: `${MOON_SURFACE_ENGINEERING_REVISION}:ENG-VEH-0003`,
    frame: {
      id: 'eng-lunar-cargo-rover-r1',
      name: 'Lunar Cargo Rover LCR-6',
      role: 'cargo-rover',
      domains: ['surface'],
      mobilityModes: ['wheeled'],
      dryMassKg: 5200,
      cargo: { massCapacityKg: 6000 },
      crew: { minCrew: 0, maxCrew: 2 },
      energyStores: [{ id: 'battery', carrier: 'electricity', capacity: 240, unit: 'kWh' }],
      environment: {
        gravityMs2: { min: 1.60, max: 1.65 },
        vacuumCapable: true,
        atmosphereRequired: false,
        pressurized: false,
        dustTolerant: true,
      },
      surfaceMobility: {
        mode: 'wheeled',
        safeLongitudinalSlopeDeg: 10,
        referenceSpeedKph: 12,
      },
    },
    operationProfile: {
      energyStoreId: 'battery',
      nominalConsumptionPerKm: 1.35,
      wearPerOperatingHour: 0.25,
    },
    routeClasses: {
      offroad: { referenceSpeedKph: 5, energyFactor: 1.55, wearFactor: 1.8 },
      'prepared-track': { referenceSpeedKph: 10, energyFactor: 1.15, wearFactor: 1.2 },
      'hardened-road': { referenceSpeedKph: 15, energyFactor: 1.0, wearFactor: 1.0 },
    },
    engineeringEnvelope: {
      maxLongitudinalSlopeDeg: { loaded: 15, unloaded: 18 },
      maxCrossSlopeDeg: { loaded: 8, unloaded: 10 },
      regenerativeBraking: true,
    },
  },
  {
    engineeringId: 'ENG-VEH-0004',
    sourceId: `${MOON_SURFACE_ENGINEERING_REVISION}:ENG-VEH-0004`,
    frame: {
      id: 'eng-lunar-heavy-hauler-r1',
      name: 'Lunar Heavy Hauler LHH-20',
      role: 'heavy-hauler',
      domains: ['surface'],
      mobilityModes: ['wheeled'],
      dryMassKg: 15000,
      cargo: { massCapacityKg: 20000 },
      crew: { minCrew: 0, maxCrew: 2 },
      energyStores: [{ id: 'battery', carrier: 'electricity', capacity: 520, unit: 'kWh' }],
      environment: {
        gravityMs2: { min: 1.60, max: 1.65 },
        vacuumCapable: true,
        atmosphereRequired: false,
        pressurized: false,
        dustTolerant: true,
      },
      surfaceMobility: {
        mode: 'wheeled',
        safeLongitudinalSlopeDeg: 7,
        referenceSpeedKph: 8,
      },
    },
    operationProfile: {
      energyStoreId: 'battery',
      nominalConsumptionPerKm: 2.8,
      wearPerOperatingHour: 0.2,
    },
    routeClasses: {
      offroad: { referenceSpeedKph: 3, energyFactor: 1.7, wearFactor: 2.2 },
      'prepared-track': { referenceSpeedKph: 7, energyFactor: 1.2, wearFactor: 1.3 },
      'hardened-road': { referenceSpeedKph: 10, energyFactor: 1.0, wearFactor: 1.0 },
    },
    engineeringEnvelope: {
      maxLongitudinalSlopeDeg: { loaded: 12, unloaded: 15 },
      maxCrossSlopeDeg: { loaded: 6, unloaded: 8 },
      regenerativeBraking: true,
    },
  },
]

export function resolveMoonSurfaceEngineeringProfile(frameId: string) {
  return resolveSurfaceVehicleProfile(frameId, MOON_SURFACE_ENGINEERING_PROFILES)
}

export function resolveMoonSurfaceEngineeringEntry(frameId: string) {
  const matches = MOON_SURFACE_ENGINEERING_PROFILES.filter(entry => entry.frame.id === frameId.trim())
  return matches.length === 1 ? matches[0] : null
}

export function resolveMoonSurfaceRouteClassEngineering(
  frameId: string,
  routeClass: MoonSurfaceEngineeringRouteClass,
) {
  return resolveMoonSurfaceEngineeringEntry(frameId)?.routeClasses[routeClass] ?? null
}
