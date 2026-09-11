// lib/game/dockingApproach.ts
// Pure planning helpers for selecting an approach target before Core persistence exists.
//
// IMPORTANT: choosing an approach target is NOT a reservation and NOT docking.
// Runtime reservation/occupancy remains Core-owned.

import { isPortCompatible, type DockingPortClass, type DockingVesselClass } from './docking'
import {
  getStationDockingTopology,
  type StationDockingPortDefinition,
} from './stationDockingTopologies'

export interface DockingApproachOption {
  port: StationDockingPortDefinition
  exactClassMatch: boolean
  cargoCapable: boolean
}

function exactPreferredClass(vesselClass: DockingVesselClass): DockingPortClass | null {
  switch (vesselClass) {
    case 'surface-transfer-shuttle': return 'shuttle'
    case 'intersolar-standard': return 'standard'
    case 'intersolar-heavy': return 'heavy'
    case 'service-craft': return 'service'
    default: return null
  }
}

/**
 * Returns only statically compatible ports. No runtime availability claim is made.
 * Ordering prefers the vessel's exact port class, then cargo-capable ports, then id.
 */
export function getDockingApproachOptions(
  stationSlug: string,
  vesselClass: DockingVesselClass,
): DockingApproachOption[] {
  const topology = getStationDockingTopology(stationSlug)
  if (!topology) return []

  const preferred = exactPreferredClass(vesselClass)

  return topology.ports
    .filter(port => isPortCompatible(vesselClass, port.portClass))
    .map(port => ({
      port,
      exactClassMatch: preferred != null && port.portClass === preferred,
      cargoCapable: port.cargoEnabled,
    }))
    .sort((a, b) => {
      if (a.exactClassMatch !== b.exactClassMatch) return a.exactClassMatch ? -1 : 1
      if (a.cargoCapable !== b.cargoCapable) return a.cargoCapable ? -1 : 1
      return a.port.id.localeCompare(b.port.id)
    })
}

export function getSuggestedApproachPort(
  stationSlug: string,
  vesselClass: DockingVesselClass,
): StationDockingPortDefinition | null {
  return getDockingApproachOptions(stationSlug, vesselClass)[0]?.port ?? null
}
