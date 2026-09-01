// lib/game/buildingExpansions.ts
// NOXIA-owned domain contract for expandable buildings.
//
// Important boundary:
// - this file defines gameplay/runtime semantics only;
// - it does not create a second persistence mechanism;
// - existing tile_entities.parent_id + slot are the preferred persistence relation;
// - player_builds.parent_id + slot can represent the matching build lifecycle;
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
 */
export interface BuildingExpansionInstance {
  id: string
  parentEntityId: string
  expansionId: string
  profileId: string | null
  status: BuildingExpansionStatus
  slot?: number | null
}

/**
 * Minimal shape already present on public.tile_entities.
 * Child infrastructure can stay a normal addressable entity and use parent_id
 * to point at the owning/base building. No building-expansion table is required.
 */
export interface TileEntityExpansionRow {
  id: string
  profile_id: string | null
  entity_type: string
  entity_id: string
  parent_id: string | null
  slot?: number | null
  status?: string | null
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

/**
 * Projects existing tile_entities children into expansion instances.
 * Rows without parent_id are base/world entities and are ignored here.
 */
export function expansionInstancesFromTileEntities(
  rows: TileEntityExpansionRow[],
): BuildingExpansionInstance[] {
  return rows
    .filter(row => row.parent_id != null)
    .map(row => ({
      id: row.id,
      parentEntityId: row.parent_id as string,
      expansionId: row.entity_id,
      profileId: row.profile_id,
      status: row.status === 'building' ? 'building' : 'active',
      slot: row.slot ?? null,
    }))
}

export function expansionsForBuilding(
  buildingEntityId: string,
  instances: BuildingExpansionInstance[],
): BuildingExpansionInstance[] {
  return instances
    .filter(instance => instance.parentEntityId === buildingEntityId)
    .sort((a, b) => {
      const slotA = a.slot ?? Number.MAX_SAFE_INTEGER
      const slotB = b.slot ?? Number.MAX_SAFE_INTEGER
      return slotA - slotB || a.id.localeCompare(b.id)
    })
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
