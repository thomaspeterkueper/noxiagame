import type { ElevationGrid, ElevationSample } from './elevationSource'

export type TerrainSuitabilityCell = ElevationSample & {
  slopePercent: number
  reliefM: number
  terrainScore: number
}

export type TerrainSuitabilityGrid = {
  cols: number
  rows: number
  cells: TerrainSuitabilityCell[]
  best: TerrainSuitabilityCell[]
}

function horizontalDistanceM(a: ElevationSample, b: ElevationSample): number {
  const latM = (b.lat - a.lat) * 111_320
  const lonM = (b.lon - a.lon) * 111_320 * Math.cos(((a.lat + b.lat) * Math.PI) / 360)
  return Math.hypot(latM, lonM)
}

/**
 * Terrain-only suitability. It deliberately does not decide a spaceport site:
 * settlement, water, forest, transport, ownership and future planning constraints
 * must be evaluated separately before a location becomes canonical.
 */
export function analyseTerrainSuitability(grid: ElevationGrid): TerrainSuitabilityGrid {
  const at = (row: number, col: number) => grid.samples[row * grid.cols + col]
  const cells: TerrainSuitabilityCell[] = []

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const center = at(row, col)
      if (!center) continue
      const neighbours = [at(row - 1, col), at(row + 1, col), at(row, col - 1), at(row, col + 1)].filter(Boolean) as ElevationSample[]
      let maxSlope = 0
      let minElevation = center.elevationM
      let maxElevation = center.elevationM
      for (const neighbour of neighbours) {
        const distance = horizontalDistanceM(center, neighbour)
        if (distance > 0) maxSlope = Math.max(maxSlope, Math.abs(neighbour.elevationM - center.elevationM) / distance * 100)
        minElevation = Math.min(minElevation, neighbour.elevationM)
        maxElevation = Math.max(maxElevation, neighbour.elevationM)
      }
      const reliefM = maxElevation - minElevation
      const terrainScore = Math.max(0, Math.min(100, 100 - maxSlope * 7 - reliefM * 1.4))
      cells.push({ ...center, slopePercent: maxSlope, reliefM, terrainScore })
    }
  }

  const best = [...cells].sort((a, b) => b.terrainScore - a.terrainScore).slice(0, 12)
  return { cols: grid.cols, rows: grid.rows, cells, best }
}
