// lib/world/spatial/earthSpatial.ts
// Canonical spatial foundation for Earth in NOXIA.
//
// The simulation is not bounded by a fixed tile rectangle. Earth positions are
// expressed geodetically and projected into local metre-based chunks only for
// simulation/rendering. This keeps the model usable for future, present and
// historical epochs without coupling canon to one UI grid.

export type EarthEpoch = {
  /** Inclusive simulation instant in ISO-8601 form. */
  at: string
}

export type GeoPoint = {
  lat: number
  lon: number
  elevationM?: number | null
}

export type LocalMetricPoint = {
  eastM: number
  northM: number
}

export type ChunkCoord = {
  x: number
  y: number
}

export type ChunkCell = {
  chunk: ChunkCoord
  localX: number
  localY: number
}

export type EarthRegionAnchor = {
  id: string
  name: string
  origin: GeoPoint
  chunkSizeM: number
  cellSizeM: number
}

/**
 * 1 km chunks with 10 m simulation cells give 100×100 cells per chunk while
 * keeping streaming units compact. Rendering is free to aggregate cells at
 * lower zoom levels.
 */
export const EARTH_CHUNK_SIZE_M = 1_000
export const EARTH_CELL_SIZE_M = 10

/** Mean Earth radius; sufficient for local ENU-style projection in a region. */
const EARTH_RADIUS_M = 6_371_008.8
const DEG = Math.PI / 180

export function normalizeLongitude(lon: number): number {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180
  return wrapped === -180 ? 180 : wrapped
}

export function validateGeoPoint(point: GeoPoint): GeoPoint {
  if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) {
    throw new Error(`Invalid latitude: ${point.lat}`)
  }
  if (!Number.isFinite(point.lon)) throw new Error(`Invalid longitude: ${point.lon}`)
  return { ...point, lon: normalizeLongitude(point.lon) }
}

/**
 * Converts a WGS84-like latitude/longitude point to local metre coordinates
 * around a region anchor using an equirectangular local tangent approximation.
 * This is intentionally a local simulation projection, not the canonical ID.
 */
export function geoToLocalMeters(point: GeoPoint, anchor: GeoPoint): LocalMetricPoint {
  const p = validateGeoPoint(point)
  const a = validateGeoPoint(anchor)
  const lat0 = a.lat * DEG
  const dLat = (p.lat - a.lat) * DEG
  const dLon = (normalizeLongitude(p.lon - a.lon)) * DEG
  return {
    eastM: EARTH_RADIUS_M * dLon * Math.cos(lat0),
    northM: EARTH_RADIUS_M * dLat,
  }
}

export function localMetersToGeo(point: LocalMetricPoint, anchor: GeoPoint): GeoPoint {
  const a = validateGeoPoint(anchor)
  const lat0 = a.lat * DEG
  const lat = a.lat + (point.northM / EARTH_RADIUS_M) / DEG
  const cos = Math.cos(lat0)
  if (Math.abs(cos) < 1e-9) throw new Error('Local longitude projection is undefined at the pole')
  const lon = a.lon + (point.eastM / (EARTH_RADIUS_M * cos)) / DEG
  return validateGeoPoint({ lat, lon })
}

export function metricToChunk(point: LocalMetricPoint, chunkSizeM = EARTH_CHUNK_SIZE_M): ChunkCoord {
  return {
    x: Math.floor(point.eastM / chunkSizeM),
    y: Math.floor(point.northM / chunkSizeM),
  }
}

export function geoToChunk(point: GeoPoint, region: EarthRegionAnchor): ChunkCoord {
  return metricToChunk(geoToLocalMeters(point, region.origin), region.chunkSizeM)
}

export function metricToChunkCell(
  point: LocalMetricPoint,
  chunkSizeM = EARTH_CHUNK_SIZE_M,
  cellSizeM = EARTH_CELL_SIZE_M,
): ChunkCell {
  if (chunkSizeM <= 0 || cellSizeM <= 0 || chunkSizeM % cellSizeM !== 0) {
    throw new Error('chunkSizeM must be a positive multiple of cellSizeM')
  }
  const chunk = metricToChunk(point, chunkSizeM)
  const chunkOriginEast = chunk.x * chunkSizeM
  const chunkOriginNorth = chunk.y * chunkSizeM
  return {
    chunk,
    localX: Math.floor((point.eastM - chunkOriginEast) / cellSizeM),
    localY: Math.floor((point.northM - chunkOriginNorth) / cellSizeM),
  }
}

export function geoToChunkCell(point: GeoPoint, region: EarthRegionAnchor): ChunkCell {
  return metricToChunkCell(
    geoToLocalMeters(point, region.origin),
    region.chunkSizeM,
    region.cellSizeM,
  )
}

export function chunkKey(regionId: string, chunk: ChunkCoord): string {
  return `${regionId}:${chunk.x}:${chunk.y}`
}

/**
 * Spatial records are temporal by design. A road, forest edge, settlement or
 * coastline may exist in one epoch and not another.
 */
export type TemporalSpatialFeature<TProperties extends Record<string, unknown> = Record<string, unknown>> = {
  id: string
  worldId: 'earth'
  featureType: string
  geometryKind: 'point' | 'line' | 'polygon'
  properties: TProperties
  validFrom?: string | null
  validTo?: string | null
  source?: {
    provider: string
    dataset?: string
    sourceId?: string
    license?: string
  } | null
}
