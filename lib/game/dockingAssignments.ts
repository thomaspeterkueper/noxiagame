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
    .map(pad => ({ id: pad.id, kind: 'base' as const }))

  const expansions = input.expansions
    .filter(expansion =>
      expansion.expansionId === EXTRA_LANDING_PAD_EXPANSION_ID &&
      expansion.status === 'active' &&
      operational(expansion.condition),
    )
    .map(expansion => ({ id: expansion.id, kind: 'expansion' as const }))

  return [...base, ...expansions].sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Deterministically chooses the first free operational pad.
 * Existing assignment rows are the only occupancy source; ships merely sharing
 * a location do not count as pad occupants.
 */
export function selectFreeDockingPad(input: {
  pads: DockingPadCandidate[]
  assignments: ShipDockingAssignment[]
  arrivingShipId: string
}): DockingPadCandidate | null {
  const occupied = new Set(
    input.assignments
      .filter(a => a.shipId !== input.arrivingShipId)
      .map(a => a.padEntityId),
  )
  return input.pads.find(pad => !occupied.has(pad.id)) ?? null
}

export function occupiedPadIds(assignments: ShipDockingAssignment[]): string[] {
  return Array.from(new Set(assignments.map(a => a.padEntityId))).sort()
}
