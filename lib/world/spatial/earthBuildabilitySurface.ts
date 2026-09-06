import type { PhysicalBuildabilityPolicy, PhysicalBuildabilityResult } from '../../game/spatial/buildability'
import { applyUsageRestrictions, evaluatePhysicalBuildability } from '../../game/spatial/buildability'
import type { GeoPoint } from './earthSpatial'
import { geoToLocalMeters, localMetersToGeo } from './earthSpatial'
import type { EarthRegionAnchor } from './earthSpatial'
import type { ElevationGrid, ElevationSample } from './elevationSource'
import type { ImportedEarthFeature } from './earthFeatureSource'
import type { EarthFeatureRestrictionPolicy } from './earthUsageRestrictions'
import { classifyEarthCellFeatures } from './earthUsageRestrictions'

export type EarthBuildabilityCell = PhysicalBuildabilityResult & {
  lat: number
  lon: number
  row: number
  col: number
  matchedFeatureIds: string[]
}

export type EarthBuildabilitySurface = {
  rows: number
  cols: number
  cellSizeM: number
  cells: EarthBuildabilityCell[]
  source: ElevationGrid['source']
}

export interface EarthBuildabilitySurfaceOptions {
  features?: readonly ImportedEarthFeature[]
  restrictionPolicy?: EarthFeatureRestrictionPolicy
}

function horizontalDistanceM(a: ElevationSample, b: ElevationSample): number {
  const latM = (b.lat - a.lat) * 111_320
  const lonM = (b.lon - a.lon) * 111_320 * Math.cos(((a.lat + b.lat) * Math.PI) / 360)
  return Math.hypot(latM, lonM)
}

/**
 * Derives slope in degrees from the DEM grid. This intentionally does not reuse
 * the older spaceport suitability percentage score: buildability consumes a
 * physical angle and leaves policy thresholds to the selected building/world.
 */
export function deriveElevationSlopeDeg(
  grid: ElevationGrid,
  row: number,
  col: number,
): number | undefined {
  const at = (r: number, c: number) => grid.samples[r * grid.cols + c]
  const center = at(row, col)
  if (!center) return undefined

  const neighbours = [
    at(row - 1, col),
    at(row + 1, col),
    at(row, col - 1),
    at(row, col + 1),
  ].filter(Boolean) as ElevationSample[]
  if (!neighbours.length) return undefined

  let maxSlopeDeg = 0
  for (const neighbour of neighbours) {
    const distanceM = horizontalDistanceM(center, neighbour)
    if (distanceM <= 0) continue
    const riseM = Math.abs(neighbour.elevationM - center.elevationM)
    maxSlopeDeg = Math.max(maxSlopeDeg, Math.atan2(riseM, distanceM) * 180 / Math.PI)
  }
  return maxSlopeDeg
}

/**
 * Projects an observed Earth DEM grid into the region's local metric planning
 * frame and evaluates physical terrain first. Observed water is folded into the
 * physical gate; explicit land-use/infrastructure rules are applied afterwards
 * and may only downgrade a physically viable cell.
 */
export function buildEarthBuildabilitySurface(
  grid: ElevationGrid,
  region: EarthRegionAnchor,
  policy: PhysicalBuildabilityPolicy,
  options: EarthBuildabilitySurfaceOptions = {},
): EarthBuildabilitySurface {
  const cells: EarthBuildabilityCell[] = []
  const features = options.features ?? []
  const restrictionPolicy = options.restrictionPolicy ?? {}

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const sample = grid.samples[row * grid.cols + col]
      if (!sample) continue
      const metric = geoToLocalMeters(sample, region.origin)
      const slopeDeg = deriveElevationSlopeDeg(grid, row, col)
      const classified = classifyEarthCellFeatures(
        metric,
        region.cellSizeM,
        features,
        region,
        restrictionPolicy,
      )
      const physical = evaluatePhysicalBuildability({
        xM: metric.eastM,
        yM: metric.northM,
        elevationM: sample.elevationM,
        slopeDeg,
        isWater: classified.isWater,
        terrainResolved: Number.isFinite(sample.elevationM) && slopeDeg != null,
        gridSizeM: region.cellSizeM,
      }, policy)
      const final = applyUsageRestrictions(physical, classified.restrictions)
      cells.push({
        ...final,
        lat: sample.lat,
        lon: sample.lon,
        row,
        col,
        matchedFeatureIds: classified.matchedFeatureIds,
      })
    }
  }

  return {
    rows: grid.rows,
    cols: grid.cols,
    cellSizeM: region.cellSizeM,
    cells,
    source: grid.source,
  }
}

/**
 * Returns the geographic centre of a metric planning cell. Useful for provider
 * queries without letting provider coordinates leak into placement semantics.
 */
export function earthPlanningCellCenter(
  region: EarthRegionAnchor,
  xM: number,
  yM: number,
): GeoPoint {
  return localMetersToGeo({ eastM: xM, northM: yM }, region.origin)
}
