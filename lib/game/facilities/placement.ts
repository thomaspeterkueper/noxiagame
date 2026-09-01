// lib/game/facilities/placement.ts
// Erstellt: 01.09.2026
// Reine Platzierungslogik für physische Anlagenmodule.

import type {
  FacilityModuleDefinition,
  ModulePlacementResult,
  PlacementCellState,
} from './types'

export interface PlacementWorld {
  rows: number
  cols: number
  isBuildable(row: number, col: number): boolean
  isLegallyUsable(row: number, col: number): boolean
  isOccupied(row: number, col: number): boolean
}

export function getModuleCells(
  definition: FacilityModuleDefinition,
  originRow: number,
  originCol: number,
): Array<{ row: number; col: number }> {
  return definition.footprint.map(offset => ({
    row: originRow + offset.row,
    col: originCol + offset.col,
  }))
}

export function validateModulePlacement(
  definition: FacilityModuleDefinition,
  originRow: number,
  originCol: number,
  world: PlacementWorld,
): ModulePlacementResult {
  const cells: PlacementCellState[] = getModuleCells(definition, originRow, originCol).map(({ row, col }) => {
    const inBounds = row >= 0 && row < world.rows && col >= 0 && col < world.cols
    if (!inBounds) {
      return {
        row, col, inBounds: false, buildable: false, legallyUsable: false, occupied: false,
        reason: 'outside-grid',
      }
    }

    const buildable = world.isBuildable(row, col)
    const legallyUsable = world.isLegallyUsable(row, col)
    const occupied = world.isOccupied(row, col)
    const reason = !buildable
      ? 'terrain-blocked'
      : !legallyUsable
        ? 'land-unavailable'
        : occupied
          ? 'occupied'
          : undefined

    return { row, col, inBounds, buildable, legallyUsable, occupied, reason }
  })

  const reasons = cells.flatMap(cell => cell.reason ? [`${cell.row}:${cell.col}:${cell.reason}`] : [])
  return { allowed: reasons.length === 0, cells, reasons }
}
