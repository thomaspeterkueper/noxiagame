// lib/game/buildingExpansions.ts
// NOXIA-owned domain contract for expandable buildings.
//
// Important boundary:
// - this file defines gameplay/runtime semantics only;
// - it does not create a second persistence mechanism;
// - existing tile_entities.parent_id + slot are the preferred persistence relation;
// - player_builds.parent_id + slot can represent the matching build lifecycle;
// - renderers consume projections from world state and do not invent expansions;
// - no graphics/assets are defined here;
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

/** Storage-neutral representation of one persisted expansion instance. */
export interface BuildingExpansionInstance {
  id: string
  parentEntityId: string
  expansionId: string
  profileId: string | null
  status: BuildingExpansionStatus
  slot: number | null
  condition: number | null
}

/**
 * Minimal shape already present on public.tile_entities.
 * Child infrastructure stays a normal addressable entity and uses parent_id to
 * point at the owning/base building. No building-expansion table is required.
 */
export interface TileEntityExpansionRow {
  id: string
  profile_id: string | null
  entity_type: string
  entity_id: string
  parent_id: string | null
  slot?: number | null
  status?: string | null
  condition?: number | null
}

export interface BuildingProjectionState {
  buildingEntityId: string
  buildingId: string
  expansions: BuildingExpansionInstance[]
}

/**
 * Expansion balancing is NOXIA-owned. The first functional expansion is a
 * second physical landing pad. It is cheaper/faster than a standalone landing
 * facility because it reuses the parent site's access/control infrastructure.
 */
export const BUILDING_EXPANSIONS: Record<string, BuildingExpansionDef> = {
  landing_pad_extra_pad: {
    id: 'landing_pad_extra_pad',
    name: 'Zusätzliches Landefeld',
    description: 'Erweitert einen bestehenden Landeplatz um eine weitere physische Pad-Kapazität.',
    parentBuildingIds: ['landing_pad'],
    cost: 3000,
    buildTimeTicks: 2,
    planned: false,
  },
}

export function getExpansionDef(id: string): BuildingExpansionDef | null {
  return BUILDING_EXPANSIONS[id] ?? null
}

function normalizeExpansionStatus(status?: string | null): BuildingExpansionStatus | null {
  if (status === 'building') return 'building'
  if (status === 'active') return 'active'
  return null
}

/**
 * Projects existing tile_entities children into expansion instances.
 *
 * Important: parent_id alone is not enough. tile_entities also contains other
 * addressable children. Only registered expansion IDs with a valid lifecycle
 * status become building expansions. This prevents the personal or strategic
 * layer from accidentally treating arbitrary child entities as an extension.
 */
export function expansionInstancesFromTileEntities(
  rows: TileEntityExpansionRow[],
): BuildingExpansionInstance[] {
  return rows.flatMap(row => {
    if (row.entity_type !== 'building' || row.parent_id == null) return []
    if (!getExpansionDef(row.entity_id)) return []

    const status = normalizeExpansionStatus(row.status)
    if (!status) return []

    return [{
      id: row.id,
      parentEntityId: row.parent_id,
      expansionId: row.entity_id,
      profileId: row.profile_id,
      status,
      slot: row.slot ?? null,
      condition: row.condition ?? null,
    }]
  })
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

/**
 * Convenience projection for API/UI adapters. The renderer receives only
 * persisted, registered children belonging to this concrete building instance.
 */
export function projectBuildingFromTileEntities(input: {
  buildingEntityId: string
  buildingId: string
  rows: TileEntityExpansionRow[]
}): BuildingProjectionState {
  return projectBuildingState({
    buildingEntityId: input.buildingEntityId,
    buildingId: input.buildingId,
    expansionInstances: expansionInstancesFromTileEntities(input.rows),
  })
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
