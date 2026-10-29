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
