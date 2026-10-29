/**
 * Read-only bridge from an authenticated Core parcel projection to the local
 * Earth scene. A refreshed OSM/import layer must not resurrect a demolished
 * building, but the bridge never edits that imported baseline.
 *
 * SECURITY: The caller must supply a projection built from server-verified
 * persisted Core receipts, and authoritative parcel-to-geometry bindings.
 * Neither this adapter nor the client can authorize a construction.
 */
import type { ParcelProjection } from './parcelLifecycle'
import type {
  LocalSurfaceBuilding, LocalSurfacePoint, LocalSurfacePolygon, LocalSurfaceScene,
} from '../spatial/localSurfaceScene'

export interface ParcelSceneBinding {
  parcelId: string
  /** Imported feature ID, not the canonical Core building ID. */
  importedBuildingId?: string
  /** Canonical Core ID of the imported building at the baseline year. */
  baselineBuildingId?: string
  /** True parcel footprint in local scene metres; never infer it from a house. */
  parcelOutline?: readonly LocalSurfacePoint[]
  /** Already-authorized geometry, keyed by canonical Core building ID. */
  canonicalBuildings?: readonly LocalSurfaceBuilding[]
}
export type SceneOverlayGap =
  | { parcelId: string; reason: 'unknown_parcel' | 'missing_parcel_outline' }
  | { parcelId: string; reason: 'missing_canonical_building' | 'geometry_conflict'; buildingId: string }

export interface ParcelSceneOverlay {
  scene: LocalSurfaceScene
  gaps: SceneOverlayGap[]
  hiddenImportedBuildings: string[]
  shownCanonicalBuildings: string[]
  restoredMeadows: string[]
}

const meadowId = (parcelId: string) => 'noxia:restored-meadow:' + parcelId
const validOutline = (points: readonly LocalSurfacePoint[] | undefined): points is readonly LocalSurfacePoint[] =>
  !!points && points.length >= 3 && points.every(p => Number.isFinite(p.xM) && Number.isFinite(p.yM))
const validBuilding = (b: LocalSurfaceBuilding) =>
  b.provenance === 'canonical' && !!b.id?.trim() &&
  Number.isFinite(b.center.xM) && Number.isFinite(b.center.yM) &&
  Number.isFinite(b.widthM) && b.widthM > 0 &&
  Number.isFinite(b.depthM) && b.depthM > 0 &&
  Number.isFinite(b.rotationDeg)

/**
 * Apply a year-specific projection to a fresh imported scene. All unrelated
 * imported features remain unchanged. This function does not persist anything.
 */
export function overlayParcelProjection(input: {
  settlementId: string
  scene: LocalSurfaceScene
  projection: ParcelProjection
  bindings: readonly ParcelSceneBinding[]
}): ParcelSceneOverlay {
  if (input.scene.body !== 'earth' || !input.settlementId.trim() ||
      input.settlementId !== input.projection.settlementId) {
    throw new Error('Parcel scene/settlement mismatch')
  }
  const states = new Map(input.projection.parcels.map(p => [p.parcelId, p]))
  const boundParcels = new Set<string>()
  const importedIds = new Set<string>()
  for (const binding of input.bindings) {
    if (!binding.parcelId.trim() || boundParcels.has(binding.parcelId) ||
        (binding.importedBuildingId && (!binding.baselineBuildingId?.trim() || importedIds.has(binding.importedBuildingId)))) {
      throw new Error('Duplicate or invalid parcel scene binding')
    }
    boundParcels.add(binding.parcelId)
    if (binding.importedBuildingId) importedIds.add(binding.importedBuildingId)
  }

  const gaps: SceneOverlayGap[] = []
  const hide = new Set<string>()
  const additions: LocalSurfaceBuilding[] = []
  const meadows: LocalSurfacePolygon[] = []
  const shown = new Set<string>()
  const existing = new Map(input.scene.buildings.map(b => [b.id, b]))
  for (const binding of [...input.bindings].sort((a, b) => a.parcelId.localeCompare(b.parcelId))) {
    const state = states.get(binding.parcelId)
    if (!state) {
      gaps.push({ parcelId: binding.parcelId, reason: 'unknown_parcel' })
      continue
    }
    const currentIsImported = state.surface === 'occupied' &&
      state.buildingId === binding.baselineBuildingId
    // A real imported feature can use an OSM ID distinct from the Core ID.
    // A binding to that feature must therefore carry its canonical baseline ID.
    // When the parcel has changed, the old feature is hidden on every replay.
    if (binding.importedBuildingId && !currentIsImported) hide.add(binding.importedBuildingId)

    if (state.surface === 'meadow') {
      if (!validOutline(binding.parcelOutline)) {
        gaps.push({ parcelId: binding.parcelId, reason: 'missing_parcel_outline' })
      } else {
        meadows.push({
          id: meadowId(binding.parcelId),
          kind: 'vegetation',
          points: binding.parcelOutline.map(p => ({ ...p })),
          provenance: 'synthetic',
          className: 'noxia-restored-meadow',
        })
      }
    }
    if (state.surface !== 'occupied' || !state.buildingId ||
        currentIsImported) continue
    const canonical = binding.canonicalBuildings?.find(b => b.id === state.buildingId)
    if (!canonical || !validBuilding(canonical)) {
      gaps.push({ parcelId: binding.parcelId, reason: 'missing_canonical_building', buildingId: state.buildingId })
      continue
    }
    const present = existing.get(canonical.id)
    if (present && present.provenance !== 'canonical') {
      gaps.push({ parcelId: binding.parcelId, reason: 'geometry_conflict', buildingId: canonical.id })
      continue
    }
    if (!present && !shown.has(canonical.id)) {
      additions.push({ ...canonical, center: { ...canonical.center },
        footprint: canonical.footprint?.map(p => ({ ...p })),
        tags: canonical.tags ? { ...canonical.tags } : undefined })
    }
    shown.add(canonical.id)
  }

  // Remove previously generated overlays so replaying the same year is stable.
  const controlledMeadows = new Set(input.bindings.map(b => meadowId(b.parcelId)))
  const scene: LocalSurfaceScene = {
    ...input.scene,
    buildings: [
      ...input.scene.buildings.filter(b => !hide.has(b.id)),
      ...additions,
    ],
    polygons: [
      ...input.scene.polygons.filter(p => !controlledMeadows.has(p.id)),
      ...meadows,
    ],
  }
  return {
    scene,
    gaps,
    hiddenImportedBuildings: [...hide].sort(),
    shownCanonicalBuildings: [...shown].sort(),
    restoredMeadows: meadows.map(m => m.id),
  }
}
