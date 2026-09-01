import type { GeoBounds } from './earthFeatureSource'
import type { GeoPoint } from './earthSpatial'

export type ElevationSample = GeoPoint & { elevationM: number }

export type ElevationGrid = {
  bounds: GeoBounds
  cols: number
  rows: number
  samples: ElevationSample[]
  source: {
    provider: string
    dataset: string
    resolutionM: number
    license?: string
  }
}

/** Terrain height is a separate authoritative spatial layer, never inferred from art. */
export interface EarthElevationSource {
  readonly id: string
  load(bounds: GeoBounds, targetResolutionM?: number): Promise<ElevationGrid>
}

export function elevationRange(grid: ElevationGrid): { minM: number; maxM: number } {
  if (!grid.samples.length) return { minM: 0, maxM: 0 }
  let minM = Infinity, maxM = -Infinity
  for (const sample of grid.samples) {
    minM = Math.min(minM, sample.elevationM)
    maxM = Math.max(maxM, sample.elevationM)
  }
  return { minM, maxM }
}
