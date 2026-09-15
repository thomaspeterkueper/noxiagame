import type { PhysicalBuildabilityPolicy, PhysicalBuildabilityResult } from './buildability'
import { evaluatePhysicalBuildability } from './buildability'
import type { WorldBody } from './types'

export interface PlanetaryElevationSample {
  latDeg: number
  lonDeg: number
  elevationM: number
}

export interface PlanetaryElevationGridSource {
  body: WorldBody
  provider: string
  dataset: string
  resolutionM: number
  horizontalReference: string
  verticalReference: string
}

export interface PlanetaryElevationGrid {
  rows: number
  cols: number
  samples: PlanetaryElevationSample[]
  source: PlanetaryElevationGridSource
}

export interface PlanetaryMetricPoint {
  xM: number
  yM: number
}

export interface PlanetaryBuildabilityCell extends PhysicalBuildabilityResult {
  latDeg: number
  lonDeg: number
  row: number
  col: number
}

export interface PlanetaryBuildabilitySurface {
  rows: number
  cols: number
  cellSizeM: number
  cells: PlanetaryBuildabilityCell[]
  source: PlanetaryElevationGridSource
}

export interface PlanetarySurfaceGeometry {
  /** Projects one planetary coordinate into the location's local planning frame. */
  project(sample: PlanetaryElevationSample): PlanetaryMetricPoint
  /** Physical horizontal distance on the body's configured reference surface. */
  horizontalDistanceM(a: PlanetaryElevationSample, b: PlanetaryElevationSample): number
}

function sampleAt(grid: PlanetaryElevationGrid, row: number, col: number) {
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return undefined
  return grid.samples[row * grid.cols + col]
}

/**
 * Body-independent DEM slope derivation. The body-specific geometry is injected,
 * so this works for Earth, Moon, Mars and later ellipsoidal/spherical bodies
 * without copying gameplay rules into each world implementation.
 *
 * A slope is only resolved when the centre and at least one neighbour carry a
 * finite observed/derived elevation and the geometry returns a finite physical
 * distance. NoData never becomes a synthetic zero-height neighbour.
 */
export function derivePlanetarySlopeDeg(
  grid: PlanetaryElevationGrid,
  row: number,
  col: number,
  geometry: PlanetarySurfaceGeometry,
): number | undefined {
  const center = sampleAt(grid, row, col)
  if (!center || !Number.isFinite(center.elevationM)) return undefined

  const neighbours = [
    sampleAt(grid, row - 1, col),
    sampleAt(grid, row + 1, col),
    sampleAt(grid, row, col - 1),
    sampleAt(grid, row, col + 1),
  ].filter(Boolean) as PlanetaryElevationSample[]
  if (!neighbours.length) return undefined

  let maxSlopeDeg = 0
  let usableNeighbour = false
  for (const neighbour of neighbours) {
    if (!Number.isFinite(neighbour.elevationM)) continue
    const distanceM = geometry.horizontalDistanceM(center, neighbour)
    if (!Number.isFinite(distanceM) || distanceM <= 0) continue
    const riseM = Math.abs(neighbour.elevationM - center.elevationM)
    if (!Number.isFinite(riseM)) continue
    usableNeighbour = true
    maxSlopeDeg = Math.max(maxSlopeDeg, Math.atan2(riseM, distanceM) * 180 / Math.PI)
  }
  return usableNeighbour ? maxSlopeDeg : undefined
}

/**
 * Shared physical terrain pipeline. Dataset interpretation and planetary
 * projection stay outside this function; buildability semantics stay common.
 * Missing/invalid elevations never receive a synthetic fallback height.
 */
export function buildPlanetaryBuildabilitySurface(
  grid: PlanetaryElevationGrid,
  cellSizeM: number,
  policy: PhysicalBuildabilityPolicy,
  geometry: PlanetarySurfaceGeometry,
): PlanetaryBuildabilitySurface {
  if (!Number.isFinite(cellSizeM) || cellSizeM <= 0) throw new Error('cellSizeM must be positive')
  const cells: PlanetaryBuildabilityCell[] = []

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const sample = sampleAt(grid, row, col)
      if (!sample) continue
      const metric = geometry.project(sample)
      const slopeDeg = derivePlanetarySlopeDeg(grid, row, col, geometry)
      const physical = evaluatePhysicalBuildability({
        xM: metric.xM,
        yM: metric.yM,
        elevationM: sample.elevationM,
        slopeDeg,
        terrainResolved: Number.isFinite(sample.elevationM) && Number.isFinite(slopeDeg),
        gridSizeM: cellSizeM,
      }, policy)
      cells.push({
        ...physical,
        latDeg: sample.latDeg,
        lonDeg: sample.lonDeg,
        row,
        col,
      })
    }
  }

  return { rows: grid.rows, cols: grid.cols, cellSizeM, cells, source: grid.source }
}
