// lib/game/buildingExpansions.ts
// NOXIA-owned domain contract for expandable buildings.
//
// Important boundary:
// - this file defines gameplay/runtime semantics only;
// - it does not create a second persistence mechanism;
// - storage adapters must project the existing NOXIA world state into these types;
// - technical/canonical identities remain external (OTA/KG) and are not minted here.

export type BuildingExpansionStatus = 'building' | 'active'

/**
 * A gameplay definition describes an expansion type that NOXIA may support.
 * Economic/build values stay optional until the expansion has a real gameplay
 * function and is explicitly made buildable.
 */
export interface BuildingExpansionDef {
  id: string
  name: string
  description: string
  parentBuildingIds: string[]
  cost?: number
  buildTimeTicks?: number
  planned: boolean
  planHint?: string
}

/**
 * Storage-neutral representation of one persisted expansion instance.
 * A concrete database adapter may source this from tile_entities, player_builds
 * or a future compatible extension of the existing persistence boundary.
 */
export interface BuildingExpansionInstance {
  id: string
  parentEntityId: string
  expansionId: string
  profileId: string | null
  status: BuildingExpansionStatus
}

export interface BuildingProjectionState {
  buildingEntityId: string
  buildingId: string
  expansions: BuildingExpansionInstance[]
}

/**
 * Deliberately empty until an expansion has a real NOXIA function.
 * Candidate ideas belong in design docs, not in the buildable catalog.
 */
export const BUILDING_EXPANSIONS: Record<string, BuildingExpansionDef> = {}

export function getExpansionDef(id: string): BuildingExpansionDef | null {
  return BUILDING_EXPANSIONS[id] ?? null
}

export function expansionsForBuilding(
  buildingEntityId: string,
  instances: BuildingExpansionInstance[],
): BuildingExpansionInstance[] {
  return instances
    .filter(instance => instance.parentEntityId === buildingEntityId)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function activeExpansionIds(
  buildingEntityId: string,
  instances: BuildingExpansionInstance[],
): string[] {
  return expansionsForBuilding(buildingEntityId, instances)
    .filter(instance => instance.status === 'active')
    .map(instance => instance.expansionId)
}

export function projectBuildingState(input: {
  buildingEntityId: string
  buildingId: string
  expansionInstances: BuildingExpansionInstance[]
}): BuildingProjectionState {
  return {
    buildingEntityId: input.buildingEntityId,
    buildingId: input.buildingId,
    expansions: expansionsForBuilding(input.buildingEntityId, input.expansionInstances),
  }
}

export function canBuildExpansion(
  expansion: BuildingExpansionDef,
  parentBuildingId: string,
): boolean {
  return (
    !expansion.planned &&
    expansion.cost != null &&
    expansion.buildTimeTicks != null &&
    expansion.parentBuildingIds.includes(parentBuildingId)
  )
}
