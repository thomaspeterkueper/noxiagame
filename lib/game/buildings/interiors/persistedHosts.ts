import {
  getInteriorTemplateForBuildingType,
  INTERIOR_TEMPLATE_REGISTRY,
  type InteriorTemplateRegistry,
} from './registry'
import type { BuildingInstanceId, InteriorTemplate } from './types'

/**
 * Minimal shape emitted by the existing spatial/Core building projections.
 *
 * `entity_id` is the canonical building type and `id` is the persisted Core
 * entity identity. Geometry, ownership, population and runtime state are not
 * copied into the interior domain here.
 */
export interface PersistedBuildingHostSource {
  id: string
  entity_id: string
}

export interface PersistedBuildingInteriorHost {
  hostId: BuildingInstanceId
  buildingTypeId: string
  template: InteriorTemplate
}

/**
 * Projects an already-persisted Core building entity into the shared interior
 * catalog. Unknown building types fail closed; no template is guessed from
 * labels, coordinates, seed order or world body.
 */
export function projectPersistedBuildingInteriorHost(
  source: PersistedBuildingHostSource,
  registry: InteriorTemplateRegistry = INTERIOR_TEMPLATE_REGISTRY,
): PersistedBuildingInteriorHost | null {
  const hostId = source.id.trim()
  const buildingTypeId = source.entity_id.trim()
  if (!hostId || !buildingTypeId) return null

  const template = getInteriorTemplateForBuildingType(buildingTypeId, registry)
  if (!template) return null

  return {
    hostId: hostId as BuildingInstanceId,
    buildingTypeId,
    template,
  }
}

/**
 * Convenience projection for live spatial entity collections. Input order and
 * duplicate persisted IDs are preserved deliberately; reconciliation belongs
 * to the authoritative Core query, not the interior adapter.
 */
export function projectPersistedBuildingInteriorHosts(
  sources: readonly PersistedBuildingHostSource[],
  registry: InteriorTemplateRegistry = INTERIOR_TEMPLATE_REGISTRY,
): PersistedBuildingInteriorHost[] {
  return sources
    .map(source => projectPersistedBuildingInteriorHost(source, registry))
    .filter((host): host is PersistedBuildingInteriorHost => host !== null)
}
