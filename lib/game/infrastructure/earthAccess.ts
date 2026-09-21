import { geoToLocalMeters, localMetersToGeo, type GeoPoint } from '@/lib/world/spatial/earthSpatial'
import type { ImportedEarthFeature } from '@/lib/world/spatial/earthFeatureSource'
import { metricDistance, type SurfaceMetricPoint } from './network'

export type EarthFacilityAccessInput = {
  origin: GeoPoint
  entityCenter: SurfaceMetricPoint
  footprintWidthM: number
  footprintDepthM: number
  rotationDeg: number
  roadFeatures: readonly ImportedEarthFeature[]
}

export type EarthFacilityAccessSuggestion = {
  facilityPort: SurfaceMetricPoint
  roadTieIn: SurfaceMetricPoint
  geometry: SurfaceMetricPoint[]
  geometryGeo: GeoPoint[]
  roadFeatureId: string
  lengthM: number
}

type MetricRoadSegment = {
  featureId: string
  a: SurfaceMetricPoint
  b: SurfaceMetricPoint
}

function finitePoint(point: GeoPoint) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon)
}

function roadSegments(features: readonly ImportedEarthFeature[], origin: GeoPoint) {
  const segments: MetricRoadSegment[] = []
  for (const feature of features) {
    if (feature.featureType !== 'road' || feature.geometry.kind !== 'line') continue
    const coordinates = feature.geometry.coordinates
    for (let index = 1; index < coordinates.length; index += 1) {
      const from = coordinates[index - 1]
      const to = coordinates[index]
      if (!finitePoint(from) || !finitePoint(to)) continue
      const a = geoToLocalMeters(from, origin)
      const b = geoToLocalMeters(to, origin)
      if (metricDistance({ xM: a.eastM, yM: a.northM }, { xM: b.eastM, yM: b.northM }) <= .05) continue
      segments.push({
        featureId: feature.id,
        a: { xM: a.eastM, yM: a.northM },
        b: { xM: b.eastM, yM: b.northM },
      })
    }
  }
  return segments
}

function nearestPointOnSegment(query: SurfaceMetricPoint, a: SurfaceMetricPoint, b: SurfaceMetricPoint) {
  const dx = b.xM - a.xM
  const dy = b.yM - a.yM
  const denominator = dx * dx + dy * dy
  const t = denominator > 0
    ? Math.max(0, Math.min(1, ((query.xM - a.xM) * dx + (query.yM - a.yM) * dy) / denominator))
    : 0
  return { xM: a.xM + dx * t, yM: a.yM + dy * t }
}

function nearestRoadPoint(center: SurfaceMetricPoint, segments: readonly MetricRoadSegment[]) {
  let best: { featureId: string; point: SurfaceMetricPoint; distanceM: number } | null = null
  for (const segment of segments) {
    const point = nearestPointOnSegment(center, segment.a, segment.b)
    const distanceM = metricDistance(center, point)
    if (!best || distanceM < best.distanceM) best = { featureId: segment.featureId, point, distanceM }
  }
  return best
}

function rotate(point: SurfaceMetricPoint, radians: number) {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { xM: point.xM * cos - point.yM * sin, yM: point.xM * sin + point.yM * cos }
}

/** Find the point where the center→road ray exits the rotated building rectangle. */
export function facilityPortToward(
  center: SurfaceMetricPoint,
  target: SurfaceMetricPoint,
  widthM: number,
  depthM: number,
  rotationDeg: number,
): SurfaceMetricPoint {
  const dx = target.xM - center.xM
  const dy = target.yM - center.yM
  const distance = Math.hypot(dx, dy)
  if (!(distance > .001)) return { ...center }

  const rotation = rotationDeg * Math.PI / 180
  const localDirection = rotate({ xM: dx / distance, yM: dy / distance }, -rotation)
  const halfWidth = Math.max(.5, Math.abs(widthM) / 2)
  const halfDepth = Math.max(.5, Math.abs(depthM) / 2)
  const tx = Math.abs(localDirection.xM) > 1e-9 ? halfWidth / Math.abs(localDirection.xM) : Infinity
  const ty = Math.abs(localDirection.yM) > 1e-9 ? halfDepth / Math.abs(localDirection.yM) : Infinity
  const localPort = {
    xM: localDirection.xM * Math.min(tx, ty),
    yM: localDirection.yM * Math.min(tx, ty),
  }
  const worldOffset = rotate(localPort, rotation)
  return { xM: center.xM + worldOffset.xM, yM: center.yM + worldOffset.yM }
}

export function suggestEarthFacilityRoadAccess(input: EarthFacilityAccessInput): EarthFacilityAccessSuggestion | null {
  const segments = roadSegments(input.roadFeatures, input.origin)
  if (!segments.length) return null
  const nearest = nearestRoadPoint(input.entityCenter, segments)
  if (!nearest) return null

  const facilityPort = facilityPortToward(
    input.entityCenter,
    nearest.point,
    input.footprintWidthM,
    input.footprintDepthM,
    input.rotationDeg,
  )
  const geometry = [facilityPort, nearest.point]
  const lengthM = metricDistance(facilityPort, nearest.point)
  const geometryGeo = geometry.map(point => localMetersToGeo({ eastM: point.xM, northM: point.yM }, input.origin))

  return {
    facilityPort,
    roadTieIn: nearest.point,
    geometry,
    geometryGeo,
    roadFeatureId: nearest.featureId,
    lengthM,
  }
}

export function earthRoadAccessCostCredits(lengthM: number) {
  return Math.max(250, Math.ceil(200 + Math.max(0, lengthM) * 8))
}
