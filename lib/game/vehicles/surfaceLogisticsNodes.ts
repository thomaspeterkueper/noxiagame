import type { SurfaceRoutePoint } from './surfaceRouteGeometry'

export interface SurfaceLogisticsInventoryRef {
  id: string
  subject_id?: string | null
  metadata?: Record<string, unknown> | null
}

export interface SurfaceSpatialEntityRef {
  id: string
  entity_id?: string | null
  x_m?: number | string | null
  y_m?: number | string | null
}

export type SurfaceLogisticsPointSource = 'inventory-metadata' | 'spatial-entity'

export interface ResolvedSurfaceLogisticsNode {
  inventoryId: string
  point: SurfaceRoutePoint
  source: SurfaceLogisticsPointSource
  spatialEntityId: string | null
}

export type SurfaceLogisticsEndpointResolution =
  | {
      status: 'resolved'
      origin: ResolvedSurfaceLogisticsNode
      destination: ResolvedSurfaceLogisticsNode
    }
  | {
      status: 'unresolved'
      reason: 'origin-unresolved' | 'destination-unresolved' | 'both-unresolved'
      origin: ResolvedSurfaceLogisticsNode | null
      destination: ResolvedSurfaceLogisticsNode | null
    }

function finiteCoordinate(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Resolve a logistics inventory to an existing local-world-meters coordinate.
 *
 * Inventory metadata is authoritative when it explicitly carries x/y values.
 * Otherwise the inventory's subject is matched to the spatial entity projection.
 * No fallback coordinates are synthesized.
 */
export function resolveSurfaceLogisticsNode(
  inventory: SurfaceLogisticsInventoryRef,
  entities: readonly SurfaceSpatialEntityRef[],
): ResolvedSurfaceLogisticsNode | null {
  const metadata = inventory.metadata ?? {}
  const metadataX = finiteCoordinate(metadata.xM ?? metadata.x_m)
  const metadataY = finiteCoordinate(metadata.yM ?? metadata.y_m)
  if (metadataX != null && metadataY != null) {
    return {
      inventoryId: inventory.id,
      point: { xM: metadataX, yM: metadataY },
      source: 'inventory-metadata',
      spatialEntityId: null,
    }
  }

  const subjectId = inventory.subject_id?.trim()
  if (!subjectId) return null

  const entity = entities.find(item => item.id === subjectId || item.entity_id === subjectId)
  if (!entity) return null

  const entityX = finiteCoordinate(entity.x_m)
  const entityY = finiteCoordinate(entity.y_m)
  if (entityX == null || entityY == null) return null

  return {
    inventoryId: inventory.id,
    point: { xM: entityX, yM: entityY },
    source: 'spatial-entity',
    spatialEntityId: entity.id,
  }
}

/**
 * Resolve both endpoints required for a surface route candidate. This deliberately
 * stops at endpoint geometry; route shape and terrain traversal remain world-owned.
 */
export function resolveSurfaceLogisticsEndpoints(
  originInventory: SurfaceLogisticsInventoryRef,
  destinationInventory: SurfaceLogisticsInventoryRef,
  entities: readonly SurfaceSpatialEntityRef[],
): SurfaceLogisticsEndpointResolution {
  const origin = resolveSurfaceLogisticsNode(originInventory, entities)
  const destination = resolveSurfaceLogisticsNode(destinationInventory, entities)

  if (origin && destination) return { status: 'resolved', origin, destination }
  return {
    status: 'unresolved',
    reason: !origin && !destination
      ? 'both-unresolved'
      : !origin
        ? 'origin-unresolved'
        : 'destination-unresolved',
    origin,
    destination,
  }
}
