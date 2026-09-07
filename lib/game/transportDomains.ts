// lib/game/transportDomains.ts
// Canonical NOXIA separation between planetary surface transfer and intersolar travel.
//
// Planetary Raumhäfen are shuttle ports. They connect a surface settlement with
// an orbital interface/transfer node; they are not terminals for intersolar ships.

export type VesselOperatingDomain = 'surface-transfer-shuttle' | 'intersolar'

export type SurfacePortRole = 'shuttle-port'

export interface TransferCraftSemantics {
  id: string
  name: string
  operatingDomain: 'surface-transfer-shuttle'
  mayUsePlanetarySurfacePort: true
  mayPerformIntersolarLeg: false
  note: string
}

/**
 * Canonical surface-transfer craft whose role is already fixed in the NOXIA world.
 * Performance, capacity and propulsion remain owned by the dedicated craft model;
 * this registry only defines transport-domain semantics.
 */
export const SURFACE_TRANSFER_CRAFT: Readonly<Record<string, TransferCraftSemantics>> = {
  'asce-0.3p': {
    id: 'asce-0.3p',
    name: 'ASCE 0.3P',
    operatingDomain: 'surface-transfer-shuttle',
    mayUsePlanetarySurfacePort: true,
    mayPerformIntersolarLeg: false,
    note: 'Transfer-Shuttle für Oberfläche ↔ orbitale Schnittstelle. Kein intersolares Verkehrsmittel.',
  },
}

/**
 * Surface infrastructure belonging to the planetary shuttle-port system.
 * `spaceport_core`, service and storage support the port; only pad-bearing
 * components contribute physical landing capacity.
 */
export const SURFACE_SHUTTLE_PORT_BUILDINGS = new Set<string>([
  'spaceport_core',
  'spaceport_pad_mini',
  'spaceport_pad_standard',
  'spaceport_service',
  'spaceport_storage',
  'landing_pad',
])

export function isSurfaceShuttlePortBuilding(buildingId: string): boolean {
  return SURFACE_SHUTTLE_PORT_BUILDINGS.has(buildingId)
}

export function mayUsePlanetarySurfacePort(domain: VesselOperatingDomain): boolean {
  return domain === 'surface-transfer-shuttle'
}

export function mayPerformIntersolarLeg(domain: VesselOperatingDomain): boolean {
  return domain === 'intersolar'
}
