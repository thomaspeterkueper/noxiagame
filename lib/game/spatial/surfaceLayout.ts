// Shared settlement-layout primitives for planetary surfaces.
// Keep this intentionally small: bodies may use different visual grammars while
// sharing one invariant -- occupied module footprints must not overlap.

export type SurfaceLayoutArchetype =
  | 'earth-settlement'
  | 'moon-compact-hub'
  | 'mars-industrial-clusters'
  | 'phobos-tether-cluster'
  | 'deimos-science-outpost'

export type SurfaceLayoutFootprint = {
  id: string
  xM: number
  yM: number
  footprintWidthM: number
  footprintDepthM: number
}

export type SurfaceLayoutConflict = {
  firstId: string
  secondId: string
  clearanceXM: number
  clearanceYM: number
}

/**
 * Conservative axis-aligned clearance check. Rotation is deliberately ignored:
 * this makes the guard stricter, so a rotated art tile cannot silently clip its
 * neighbour. `minimumClearanceM` is the required empty space edge-to-edge.
 */
export function findSurfaceLayoutConflicts(
  nodes: readonly SurfaceLayoutFootprint[],
  minimumClearanceM = 0,
): SurfaceLayoutConflict[] {
  const conflicts: SurfaceLayoutConflict[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]
      const b = nodes[j]
      const clearanceX = Math.abs(a.xM - b.xM) - (a.footprintWidthM + b.footprintWidthM) / 2
      const clearanceY = Math.abs(a.yM - b.yM) - (a.footprintDepthM + b.footprintDepthM) / 2

      // Rectangles are safely separated when either axis has the requested gap.
      if (clearanceX < minimumClearanceM && clearanceY < minimumClearanceM) {
        conflicts.push({
          firstId: a.id,
          secondId: b.id,
          clearanceXM: clearanceX,
          clearanceYM: clearanceY,
        })
      }
    }
  }
  return conflicts
}

export function assertSurfaceLayoutClearance(
  nodes: readonly SurfaceLayoutFootprint[],
  minimumClearanceM: number,
  layoutName = 'surface layout',
): void {
  const conflicts = findSurfaceLayoutConflicts(nodes, minimumClearanceM)
  if (!conflicts.length) return
  const summary = conflicts
    .map(item => `${item.firstId}<->${item.secondId} (dx=${item.clearanceXM.toFixed(1)}m, dy=${item.clearanceYM.toFixed(1)}m)`)
    .join(', ')
  throw new Error(`${layoutName} violates ${minimumClearanceM}m module clearance: ${summary}`)
}
