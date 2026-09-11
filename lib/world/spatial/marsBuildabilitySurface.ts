import type { PhysicalBuildabilityPolicy, PhysicalBuildabilityResult } from '../../game/spatial/buildability'
import { evaluatePhysicalBuildability } from '../../game/spatial/buildability'
import type { MarsGeoPoint, MarsRegionAnchor } from './marsSpatial'
import { localMetersToMarsGeo, marsGeoToLocalMeters } from './marsSpatial'

export type MarsElevationSample = MarsGeoPoint & { elevationM: number }

export type MarsElevationGrid = {
  rows: number
  cols: number
  samples: MarsElevationSample[]
  source: {
    provider: string
    dataset: string
    resolutionM: number
    verticalReference: string
  }
}

export type MarsBuildabilityCell = PhysicalBuildabilityResult & {
  lat: number
  lon: number
  row: number
  col: number
}

export type MarsBuildabilitySurface = {
  rows: number
  cols: number
  cellSizeM: number
  cells: MarsBuildabilityCell[]
  source: MarsElevationGrid['source']
}

export function deriveMarsElevationSlopeDeg(grid: MarsElevationGrid, row: number, col: number): number | undefined {
  const at = (r: number, c: number) => grid.samples[r * grid.cols + c]
  const center = at(row, col)
  if (!center) return undefined

  const neighbours = [at(row - 1, col), at(row + 1, col), at(row, col - 1), at(row, col + 1)].filter(Boolean) as MarsElevationSample[]
  if (!neighbours.length) return undefined

  let maxSlopeDeg = 0
  for (const neighbour of neighbours) {
    const metric = marsGeoToLocalMeters(neighbour, center)
    const distanceM = Math.hypot(metric.eastM, metric.northM)
    if (distanceM <= 0) continue
    const riseM = Math.abs(neighbour.elevationM - center.elevationM)
    maxSlopeDeg = Math.max(maxSlopeDeg, Math.atan2(riseM, distanceM) * 180 / Math.PI)
  }
  return maxSlopeDeg
}

export function buildMarsBuildabilitySurface(
  grid: MarsElevationGrid,
  region: MarsRegionAnchor,
  policy: PhysicalBuildabilityPolicy,
): MarsBuildabilitySurface {
  const cells: MarsBuildabilityCell[] = []

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const sample = grid.samples[row * grid.cols + col]
      if (!sample) continue
      const metric = marsGeoToLocalMeters(sample, region.origin)
      const slopeDeg = deriveMarsElevationSlopeDeg(grid, row, col)
      const physical = evaluatePhysicalBuildability({
        xM: metric.eastM,
        yM: metric.northM,
        elevationM: sample.elevationM,
        slopeDeg,
        terrainResolved: Number.isFinite(sample.elevationM) && slopeDeg != null,
        gridSizeM: region.cellSizeM,
      }, policy)
      cells.push({ ...physical, lat: sample.lat, lon: sample.lon, row, col })
    }
  }

  return { rows: grid.rows, cols: grid.cols, cellSizeM: region.cellSizeM, cells, source: grid.source }
}

export function marsPlanningCellCenter(region: MarsRegionAnchor, xM: number, yM: number): MarsGeoPoint {
  return localMetersToMarsGeo({ eastM: xM, northM: yM }, region.origin)
}
