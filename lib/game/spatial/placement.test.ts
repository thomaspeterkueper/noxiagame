import { canPlace, gridCellCenter, legacyTileToMeters } from './placement'

const base = {
  parentEntityId: null,
  childSlot: null,
  footprint: { kind: 'rect' as const, widthM: 20, depthM: 20 },
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

export function runSpatialPlacementTests() {
  assert(
    !canPlace(
      { ...base, position: { xM: 10, yM: 10 } },
      [{ ...base, position: { xM: 15, yM: 15 } }],
    ),
    'overlapping world footprints must collide',
  )

  assert(
    canPlace(
      { ...base, position: { xM: 50, yM: 50 } },
      [{ ...base, position: { xM: 15, yM: 15 } }],
    ),
    'separated world footprints must be placeable',
  )

  const cell = gridCellCenter({ columns: 4, rows: 3, cellWidthM: 5, cellDepthM: 8 }, 1, 2)
  assert(cell.xM === 12.5 && cell.yM === 12, 'local build grid must resolve to meter coordinates')

  const legacy = legacyTileToMeters(3, 7)
  assert(legacy.xM === 700 && legacy.yM === 300, 'legacy grid bridge must stay deterministic')
}
