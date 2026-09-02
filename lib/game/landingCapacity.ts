// lib/game/landingCapacity.ts
// Pure NOXIA gameplay-domain model for physical landing-pad capacity.
//
// No rendering, no assets and no persistence writes live here. The caller
// projects existing tile_entities / expansion state into this model.

import type { BuildingExpansionInstance } from './buildingExpansions'

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
   * us which location a ship belongs to, but not which concrete pad it occupies.
   * Until that attribution exists, capacity can be projected but not safely
   * enforced against arrivals.
   */
  occupiedPadEntityIds?: string[] | null
}

function operational(condition?: number | null): boolean {
  return condition == null || condition > 0
}

/**
 * Derives physical pad capacity from persisted infrastructure.
 *
 * Base landing_pad entities contribute one pad each when active and operable.
 * Every active landing_pad_extra_pad child contributes one additional pad.
 * A merely planned or currently-building expansion contributes nothing.
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
    // Physical capacity must not reject arrivals until ship→pad attribution is
    // persistent. Counting every ship at a location as a pad occupant would
    // silently break the existing multiplayer/world model.
    enforceable: occupancyKnown,
  }
}

export function hasLandingCapacityForArrival(state: LandingCapacityState): boolean | null {
  if (!state.enforceable || state.availablePads == null) return null
  return state.availablePads > 0
}
