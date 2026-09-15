import type { PhysicalBuildabilityPolicy, PhysicalBuildabilityResult } from '../../game/spatial/buildability'
import {
  buildPlanetaryBuildabilitySurface,
  derivePlanetarySlopeDeg,
  type PlanetaryElevationGrid,
  type PlanetaryElevationSample,
  type PlanetarySurfaceGeometry,
} from '../../game/spatial/planetarySurface'
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
    horizontalReference?: string
  }
}
export type MarsBuildabilityCell = PhysicalBuildabilityResult & { lat: number; lon: number; row: number; col: number }
export type MarsBuildabilitySurface = { rows: number; cols: number; cellSizeM: number; cells: MarsBuildabilityCell[]; source: MarsElevationGrid['source'] }

function asPlanetarySample(sample: MarsElevationSample): PlanetaryElevationSample {
  return { latDeg: sample.lat, lonDeg: sample.lon, elevationM: sample.elevationM }
}

function asPlanetaryGrid(grid: MarsElevationGrid): PlanetaryElevationGrid {
  return {
    rows: grid.rows,
    cols: grid.cols,
    samples: grid.samples.map(asPlanetarySample),
    source: {
      body: 'mars',
      provider: grid.source.provider,
      dataset: grid.source.dataset,
      resolutionM: grid.source.resolutionM,
      horizontalReference: grid.source.horizontalReference ?? 'IAU_MARS_PLANETOCENTRIC',
      verticalReference: grid.source.verticalReference,
    },
  }
}

function marsGeometry(region: MarsRegionAnchor): PlanetarySurfaceGeometry {
  return {
    project(sample) {
      const metric = marsGeoToLocalMeters(
        { lat: sample.latDeg, lon: sample.lonDeg, elevationM: sample.elevationM },
        region.origin,
      )
      return { xM: metric.eastM, yM: metric.northM }
    },
    horizontalDistanceM(a, b) {
      const metric = marsGeoToLocalMeters(
        { lat: b.latDeg, lon: b.lonDeg, elevationM: 0 },
        { lat: a.latDeg, lon: a.lonDeg, elevationM: 0 },
      )
      return Math.hypot(metric.eastM, metric.northM)
    },
  }
}

export function deriveMarsElevationSlopeDeg(grid: MarsElevationGrid, row: number, col: number): number | undefined {
  const first = grid.samples[0]
  if (!first) return undefined
  const referenceRegion: MarsRegionAnchor = {
    id: 'mars-slope-reference',
    name: 'Mars slope reference',
    origin: { lat: first.lat, lon: first.lon, elevationM: 0 },
    chunkSizeM: 1_000,
    cellSizeM: 10,
  }
  return derivePlanetarySlopeDeg(asPlanetaryGrid(grid), row, col, marsGeometry(referenceRegion))
}

export function buildMarsBuildabilitySurface(grid: MarsElevationGrid, region: MarsRegionAnchor, policy: PhysicalBuildabilityPolicy): MarsBuildabilitySurface {
  const generic = buildPlanetaryBuildabilitySurface(
    asPlanetaryGrid(grid),
    region.cellSizeM,
    policy,
    marsGeometry(region),
  )
  return {
    rows: generic.rows,
    cols: generic.cols,
    cellSizeM: generic.cellSizeM,
    source: grid.source,
    cells: generic.cells.map(cell => ({
      ...cell,
      lat: cell.latDeg,
      lon: cell.lonDeg,
    })),
  }
}

export function marsPlanningCellCenter(region: MarsRegionAnchor, xM: number, yM: number): MarsGeoPoint {
  return localMetersToMarsGeo({ eastM: xM, northM: yM }, region.origin)
}
