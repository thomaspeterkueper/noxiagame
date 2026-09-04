import type { BuildPlacement, Footprint, LocalBuildGrid, LocalPosition } from './types'

export type OccupiedPlacement = Pick<BuildPlacement, 'position' | 'footprint' | 'parentEntityId' | 'childSlot'> & {
  id?: string
}

function rectBounds(position: LocalPosition, footprint: Footprint) {
  if (footprint.kind !== 'rect') return null
  const w = footprint.widthM / 2
  const d = footprint.depthM / 2
  return {
    minX: position.xM - w,
    maxX: position.xM + w,
    minY: position.yM - d,
    maxY: position.yM + d,
  }
}

export function overlaps(a: OccupiedPlacement, b: OccupiedPlacement): boolean {
  if (a.parentEntityId && b.parentEntityId && a.parentEntityId === b.parentEntityId) {
    if (a.childSlot && b.childSlot && a.childSlot !== b.childSlot) return false
  }

  const aa = rectBounds(a.position, a.footprint)
  const bb = rectBounds(b.position, b.footprint)
  if (!aa || !bb) return false

  return aa.minX < bb.maxX && aa.maxX > bb.minX && aa.minY < bb.maxY && aa.maxY > bb.minY
}

export function canPlace(candidate: OccupiedPlacement, occupied: OccupiedPlacement[]): boolean {
  return !occupied.some(existing => overlaps(candidate, existing))
}

export function gridCellCenter(grid: LocalBuildGrid, row: number, col: number): LocalPosition {
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.columns) {
    throw new RangeError('Local build-grid cell is outside its site')
  }

  return {
    xM: (grid.originXM ?? 0) + (col + 0.5) * grid.cellWidthM,
    yM: (grid.originYM ?? 0) + (row + 0.5) * grid.cellDepthM,
    zM: 0,
    rotationDeg: 0,
  }
}

export function legacyTileToMeters(tileRow: number, tileCol: number, cellSizeM = 100): LocalPosition {
  return {
    xM: tileCol * cellSizeM,
    yM: tileRow * cellSizeM,
    zM: 0,
    rotationDeg: 0,
  }
}
