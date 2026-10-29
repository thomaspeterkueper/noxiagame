/**
 * Renderer-facing, read-only year replay for a single Earth settlement.
 *
 * IMPORTANT: The snapshot must come from a server-authorized baseline and
 * persisted Core receipts. This adapter cannot authenticate receipts and must
 * never accept a client-supplied "committed" assertion as proof of authority.
 *
 * Always rebuild from the captured baseline, never from the last rendered
 * frame. Otherwise rewinding 2050 -> 2026 leaves new buildings behind or
 * fails to restore the imported house hidden by a later demolition.
 */
import {
  projectParcelLifecycle, type CoreParcelReceipt, type ParcelBaseline,
  type ParcelProjection,
} from './parcelLifecycle'
import {
  overlayParcelProjection, type ParcelSceneBinding, type ParcelSceneOverlay,
} from './parcelSceneOverlay'
import type { LocalSurfaceScene } from '../spatial/localSurfaceScene'

export interface ParcelSceneTimelineSnapshot {
  settlementId: string
  baselineYear: number
  baseline: readonly ParcelBaseline[]
  receipts: readonly CoreParcelReceipt[]
  scene: LocalSurfaceScene
  bindings: readonly ParcelSceneBinding[]
}

export interface ParcelSceneTimelineFrame {
  year: number
  projection: ParcelProjection
  overlay: ParcelSceneOverlay
}

/**
 * Captures a baseline once. Both incoming objects and returned frames may be
 * mutated by UI code without changing subsequent replays.
 */
export function createParcelSceneTimeline(snapshot: ParcelSceneTimelineSnapshot): {
  render: (year: number) => ParcelSceneTimelineFrame
} {
  if (!snapshot.settlementId?.trim() || !Number.isInteger(snapshot.baselineYear) ||
      snapshot.scene.body !== 'earth') {
    throw new Error('Invalid Earth parcel timeline baseline')
  }
  const source = structuredClone(snapshot)
  // Reject inconsistent bindings before any replay can hide an imported
  // feature. This is a referential check, NOT proof of land ownership or
  // geometry provenance; the server must supply authorized bindings.
  const baseline = new Map(source.baseline.map(parcel => [parcel.parcelId, parcel]))
  const sceneBuildings = new Map(source.scene.buildings.map(building => [building.id, building]))
  const usedCanonicalIds = new Set<string>()
  for (const binding of source.bindings) {
    const original = baseline.get(binding.parcelId)
    if (!original) throw new Error('Parcel binding has no baseline parcel')
    if (binding.importedBuildingId) {
      const imported = sceneBuildings.get(binding.importedBuildingId)
      if (original.surface !== 'occupied' ||
          original.buildingId !== binding.baselineBuildingId ||
          !imported || imported.provenance === 'canonical') {
        throw new Error('Imported building binding does not match the captured baseline')
      }
    } else if (binding.baselineBuildingId) {
      throw new Error('Baseline building ID without imported feature binding')
    }
    for (const building of binding.canonicalBuildings ?? []) {
      if (usedCanonicalIds.has(building.id)) {
        throw new Error('Canonical building geometry assigned to multiple parcels')
      }
      usedCanonicalIds.add(building.id)
    }
  }
  return {
    render(year: number): ParcelSceneTimelineFrame {
      const projection = projectParcelLifecycle({
        settlementId: source.settlementId,
        baselineYear: source.baselineYear,
        year,
        baseline: source.baseline,
        receipts: source.receipts,
      })
      const overlay = overlayParcelProjection({
        settlementId: source.settlementId,
        // Do not let the renderer mutate the captured baseline through a
        // shared building/point reference in the overlay's output.
        scene: structuredClone(source.scene),
        projection,
        bindings: source.bindings,
      })
      return { year, projection, overlay }
    },
  }
}
