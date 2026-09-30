// Shared settlement-layout primitives for planetary surfaces.
// Bodies share collision/clearance rules, not one universal settlement shape.

export type SurfaceLayoutArchetype =
  | 'earth-settlement'
  | 'moon-compact-hub'
  | 'mars-industrial-clusters'
  | 'phobos-tether-cluster'
  | 'deimos-science-outpost'

export type SurfaceConnectionFamily =
  | 'road'
  | 'service-path'
  | 'pressurized-corridor'
  | 'surface-tube'
  | 'tether-corridor'
  | 'anchor-line'
  | 'cargo-transfer-link'
  | 'eva-route'

export type SurfaceLayoutGrammar = {
  archetype: SurfaceLayoutArchetype
  defaultConnections: readonly SurfaceConnectionFamily[]
  settlementPattern: string
  minimumModuleClearanceM: number
}

export const BODY_SURFACE_LAYOUT_GRAMMARS: Readonly<Record<'earth' | 'moon' | 'mars' | 'phobos' | 'deimos', SurfaceLayoutGrammar>> = {
  earth: {
    archetype: 'earth-settlement',
    defaultConnections: ['road', 'service-path'],
    settlementPattern: 'grown blocks, streets and open civic space',
    minimumModuleClearanceM: 6,
  },
  moon: {
    archetype: 'moon-compact-hub',
    defaultConnections: ['pressurized-corridor', 'surface-tube', 'eva-route'],
    settlementPattern: 'compact protected hub with a separated landing zone',
    minimumModuleClearanceM: 10,
  },
  mars: {
    archetype: 'mars-industrial-clusters',
    defaultConnections: ['pressurized-corridor', 'cargo-transfer-link', 'service-path'],
    settlementPattern: 'zoned habitation, industry, logistics and exposed utilities',
    minimumModuleClearanceM: 12,
  },
  phobos: {
    archetype: 'phobos-tether-cluster',
    defaultConnections: ['pressurized-corridor', 'tether-corridor', 'anchor-line', 'cargo-transfer-link'],
    settlementPattern: 'small pressure core plus asymmetric tethered utility/logistics clusters and remote dock',
    minimumModuleClearanceM: 14,
  },
  deimos: {
    archetype: 'deimos-science-outpost',
    defaultConnections: ['pressurized-corridor', 'tether-corridor', 'eva-route'],
    settlementPattern: 'tiny station core with sparse scientific field points rather than a settlement',
    minimumModuleClearanceM: 14,
  },
}

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
