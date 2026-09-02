// lib/game/dockingAssignments.ts
// Pure NOXIA runtime-domain helpers for ship -> concrete pad attribution.
// Persistence adapters live outside this file.

import {
  EXTRA_LANDING_PAD_EXPANSION_ID,
  type LandingPadBaseInstance,
} from './landingCapacity'
import type { BuildingExpansionInstance } from './buildingExpansions'

export interface ShipDockingAssignment {
  shipId: string
  locationId: string
  padEntityId: string
}

export interface DockingPadCandidate {
  id: string
  kind: 'base' | 'expansion'
  /** Pad owner (tile_entities.profile_id). null = public/state-owned pad. */
  profileId: string | null
}

function operational(condition?: number | null): boolean {
  return condition == null || condition > 0
}

export function operationalDockingPads(input: {
  basePads: LandingPadBaseInstance[]
  expansions: BuildingExpansionInstance[]
}): DockingPadCandidate[] {
  const base = input.basePads
    .filter(pad => pad.status === 'active' && operational(pad.condition))
    .map(pad => ({ id: pad.id, kind: 'base' as const, profileId: pad.profileId ?? null }))

  const expansions = input.expansions
    .filter(expansion =>
      expansion.expansionId === EXTRA_LANDING_PAD_EXPANSION_ID &&
      expansion.status === 'active' &&
      operational(expansion.condition),
    )
    .map(expansion => ({ id: expansion.id, kind: 'expansion' as const, profileId: expansion.profileId ?? null }))

  return [...base, ...expansions].sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * A pad is dockable by a ship of `playerProfileId` when it is public
 * (state-owned, no owner) or owned by that player. Player-owned pads must
 * never be handed to another player's ship.
 */
export function isPadEligibleForPlayer(pad: DockingPadCandidate, playerProfileId: string): boolean {
  return pad.profileId == null || pad.profileId === playerProfileId
}

/**
 * Deterministically chooses the first free operational pad the arriving ship
 * may use. Eligibility is ownership-scoped: only public pads and pads owned by
 * the arriving player are candidates. Existing assignment rows are the only
 * occupancy source; ships merely sharing a location do not count as pad
 * occupants.
 */
export function selectFreeDockingPad(input: {
  pads: DockingPadCandidate[]
  assignments: ShipDockingAssignment[]
  arrivingShipId: string
  playerProfileId: string
}): DockingPadCandidate | null {
  const occupied = new Set(
    input.assignments
      .filter(a => a.shipId !== input.arrivingShipId)
      .map(a => a.padEntityId),
  )
  return input.pads
    .filter(pad => isPadEligibleForPlayer(pad, input.playerProfileId))
    .find(pad => !occupied.has(pad.id)) ?? null
}

export function occupiedPadIds(assignments: ShipDockingAssignment[]): string[] {
  return Array.from(new Set(assignments.map(a => a.padEntityId))).sort()
}
