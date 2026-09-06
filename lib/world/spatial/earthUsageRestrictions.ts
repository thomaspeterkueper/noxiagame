import type { BuildabilityState } from '../../game/spatial/mapLayers'
import type { UsageRestriction } from '../../game/spatial/buildability'
import type { EarthFeatureClass, ImportedEarthFeature } from './earthFeatureSource'
import type { EarthRegionAnchor, GeoPoint, LocalMetricPoint } from './earthSpatial'
import { geoToLocalMeters } from './earthSpatial'

export interface EarthFeatureRestrictionRule {
  state: Exclude<BuildabilityState, 'buildable' | 'unresolved'>
  reason: string
  /** Buffer used for line/point features. Polygon interiors need no buffer. */
  bufferM?: number
}

export type EarthFeatureRestrictionPolicy = Partial<Record<EarthFeatureClass, EarthFeatureRestrictionRule>>

export interface EarthCellFeatureClassification {
  isWater: boolean
  restrictions: UsageRestriction[]
  matchedFeatureIds: string[]
}

function distanceToSegment(point: LocalMetricPoint, a: LocalMetricPoint, b: LocalMetricPoint) {
  const dx = b.eastM - a.eastM
  const dy = b.northM - a.northM
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(point.eastM - a.eastM, point.northM - a.northM)
  const t = Math.max(0, Math.min(1, ((point.eastM - a.eastM) * dx + (point.northM - a.northM) * dy) / lengthSq))
  return Math.hypot(point.eastM - (a.eastM + t * dx), point.northM - (a.northM + t * dy))
}

function pointInPolygon(point: LocalMetricPoint, polygon: readonly LocalMetricPoint[]) {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]
    const pj = polygon[j]
    const crosses = ((pi.northM > point.northM) !== (pj.northM > point.northM))
      && point.eastM < (pj.eastM - pi.eastM) * (point.northM - pi.northM) / ((pj.northM - pi.northM) || Number.EPSILON) + pi.eastM
    if (crosses) inside = !inside
  }
  return inside
}

function featureTouchesCell(
  feature: ImportedEarthFeature,
  point: LocalMetricPoint,
  region: EarthRegionAnchor,
  bufferM: number,
) {
  const metric = (geo: GeoPoint) => geoToLocalMeters(geo, region.origin)
  if (feature.geometry.kind === 'point') {
    const target = metric(feature.geometry.coordinates)
    return Math.hypot(point.eastM - target.eastM, point.northM - target.northM) <= bufferM
  }
  const vertices = feature.geometry.coordinates.map(metric)
  if (feature.geometry.kind === 'polygon' && pointInPolygon(point, vertices)) return true
  if (bufferM <= 0) return false
  const segmentCount = feature.geometry.kind === 'polygon' ? vertices.length : vertices.length - 1
  for (let index = 0; index < segmentCount; index += 1) {
    const next = feature.geometry.kind === 'polygon' ? (index + 1) % vertices.length : index + 1
    if (vertices[next] && distanceToSegment(point, vertices[index], vertices[next]) <= bufferM) return true
  }
  return false
}

/**
 * Maps observed Earth features onto a metric planning cell.
 * Water is reported separately so the physical buildability gate can reject it.
 * Other land-use/infrastructure rules remain explicit policy inputs and are only
 * allowed to downgrade a physically valid cell later.
 */
export function classifyEarthCellFeatures(
  point: LocalMetricPoint,
  gridSizeM: number,
  features: readonly ImportedEarthFeature[],
  region: EarthRegionAnchor,
  policy: EarthFeatureRestrictionPolicy,
): EarthCellFeatureClassification {
  const restrictions: UsageRestriction[] = []
  const matchedFeatureIds: string[] = []
  let isWater = false

  for (const feature of features) {
    const featureClass = feature.featureType as EarthFeatureClass
    const isWaterFeature = featureClass === 'water' || featureClass === 'waterway'
    const rule = policy[featureClass]
    // Linear watercourses need an area of influence to intersect a planning cell.
    // Without an explicit rule, half a cell is a conservative geometric overlap,
    // not an invented legal setback.
    const bufferM = rule?.bufferM ?? (isWaterFeature && feature.geometry.kind !== 'polygon' ? gridSizeM / 2 : 0)
    if (!featureTouchesCell(feature, point, region, bufferM)) continue

    matchedFeatureIds.push(feature.id)
    if (isWaterFeature) isWater = true
    if (rule && !isWaterFeature) {
      restrictions.push({ id: feature.id, state: rule.state, reason: rule.reason })
    }
  }

  return { isWater, restrictions, matchedFeatureIds }
}
