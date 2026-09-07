// lib/game/landingCapacity.ts
// Pure NOXIA gameplay-domain model for planetary shuttle-pad capacity.
//
// Planetary Raumhäfen are surface-transfer hubs. Their pads are for transfer
// shuttles (e.g. ASCE), never for intersolar ships. No rendering, assets or
// persistence writes live here; callers project persisted infrastructure.

import type { BuildingExpansionInstance } from './buildingExpansions'
import { mayUsePlanetarySurfacePort, type VesselOperatingDomain } from './transportDomains'

export const EXTRA_LANDING_PAD_EXPANSION_ID = 'landing_pad_extra_pad'

export interface LandingPadBaseInstance {
  id: string
  status: string
  condition?: number | null
  /** Pad owner. null = state-owned/public pad eligible for every player. */
  profileId?: string | null
}

export interface LandingCapacityState {
  basePads: number
  expansionPads: number
  totalPads: number
  operationalPads: number
  occupancyKnown: boolean
  occupiedPads: number | null
  availablePads: number | null
  enforceable: boolean
}

export interface LandingCapacityInput {
  basePads: LandingPadBaseInstance[]
  expansions: BuildingExpansionInstance[]
  /**
   * Occupancy is deliberately optional. The current ships.location model tells
   * us which logistics domain a craft belongs to, but not which concrete shuttle
   * pad it occupies. Until that attribution exists, capacity can be projected but
   * not safely enforced against shuttle arrivals.
   */
  occupiedPadEntityIds?: string[] | null
}

function operational(condition?: number | null): boolean {
  return condition == null || condition > 0
}

/**
 * Derives physical transfer-shuttle pad capacity from persisted infrastructure.
 *
 * Base landing_pad entities contribute one pad each when active and operable.
 * Every active landing_pad_extra_pad child contributes one additional pad.
 * A merely planned or currently-building expansion contributes nothing.
 *
 * This state is not intersolar docking capacity. Intersolar vessels terminate at
 * orbital interfaces / transfer stations and therefore never consume a planetary
 * Raumhafen pad.
 */
export function deriveLandingCapacity(input: LandingCapacityInput): LandingCapacityState {
  const activeBasePads = input.basePads.filter(
    pad => pad.status === 'active' && operational(pad.condition),
  )

  const activeExpansionPads = input.expansions.filter(
    expansion =>
      expansion.expansionId === EXTRA_LANDING_PAD_EXPANSION_ID &&
      expansion.status === 'active' &&
      operational(expansion.condition),
  )

  const occupiedIds = input.occupiedPadEntityIds
  const occupancyKnown = Array.isArray(occupiedIds)
  const operationalPadIds = new Set<string>([
    ...activeBasePads.map(pad => pad.id),
    ...activeExpansionPads.map(expansion => expansion.id),
  ])

  const occupiedPads = occupancyKnown
    ? new Set(occupiedIds.filter(id => operationalPadIds.has(id))).size
    : null

  const operationalPads = operationalPadIds.size
  const availablePads = occupiedPads == null
    ? null
    : Math.max(0, operationalPads - occupiedPads)

  return {
    basePads: activeBasePads.length,
    expansionPads: activeExpansionPads.length,
    totalPads: input.basePads.length + input.expansions.filter(
      expansion => expansion.expansionId === EXTRA_LANDING_PAD_EXPANSION_ID,
    ).length,
    operationalPads,
    occupancyKnown,
    occupiedPads,
    availablePads,
    // Physical capacity must not reject shuttle arrivals until craft→pad
    // attribution is persistent. Counting every craft in the location domain as
    // a pad occupant would silently break the multiplayer/world model.
    enforceable: occupancyKnown,
  }
}

/**
 * Arrival guard for a planetary surface port.
 *
 * Existing callers may omit `vesselDomain`; that compatibility path represents a
 * surface-transfer-shuttle arrival. An explicit intersolar vessel is always
 * rejected from the surface port, independently of free pad count.
 */
export function hasLandingCapacityForArrival(
  state: LandingCapacityState,
  vesselDomain: VesselOperatingDomain = 'surface-transfer-shuttle',
): boolean | null {
  if (!mayUsePlanetarySurfacePort(vesselDomain)) return false
  if (!state.enforceable || state.availablePads == null) return null
  return state.availablePads > 0
}
