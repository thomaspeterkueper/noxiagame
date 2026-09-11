import { PLANETARY_REFERENCES, localEnuToPlanetary, planetaryToLocalEnu } from '../../game/spatial/planetary'

export type MarsGeoPoint = {
  lat: number
  lon: number
  elevationM?: number | null
}

export type MarsLocalMetricPoint = {
  eastM: number
  northM: number
  upM?: number
}

export type MarsChunkCoord = { x: number; y: number }
export type MarsChunkCell = { chunk: MarsChunkCoord; localX: number; localY: number }

export type MarsRegionAnchor = {
  id: string
  name: string
  origin: MarsGeoPoint
  chunkSizeM: number
  cellSizeM: number
}

export const MARS_CHUNK_SIZE_M = 1_000
export const MARS_CELL_SIZE_M = 10
export const MARS_REFERENCE = PLANETARY_REFERENCES.mars

export function normalizeMarsLongitude(lon: number): number {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180
  return wrapped === -180 ? 180 : wrapped
}

export function validateMarsGeoPoint(point: MarsGeoPoint): MarsGeoPoint {
  if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) throw new Error(`Invalid Mars latitude: ${point.lat}`)
  if (!Number.isFinite(point.lon)) throw new Error(`Invalid Mars longitude: ${point.lon}`)
  return { ...point, lon: normalizeMarsLongitude(point.lon) }
}

export function marsGeoToLocalMeters(point: MarsGeoPoint, anchor: MarsGeoPoint): MarsLocalMetricPoint {
  const p = validateMarsGeoPoint(point)
  const a = validateMarsGeoPoint(anchor)
  const local = planetaryToLocalEnu(
    { latDeg: p.lat, lonDeg: p.lon, elevationM: p.elevationM ?? 0 },
    { latDeg: a.lat, lonDeg: a.lon, elevationM: a.elevationM ?? 0 },
    MARS_REFERENCE,
  )
  return { eastM: local.eastM, northM: local.northM, upM: local.upM }
}

export function localMetersToMarsGeo(point: MarsLocalMetricPoint, anchor: MarsGeoPoint): MarsGeoPoint {
  const a = validateMarsGeoPoint(anchor)
  const result = localEnuToPlanetary(
    { eastM: point.eastM, northM: point.northM, upM: point.upM ?? 0 },
    { latDeg: a.lat, lonDeg: a.lon, elevationM: a.elevationM ?? 0 },
    MARS_REFERENCE,
  )
  return validateMarsGeoPoint({ lat: result.latDeg, lon: result.lonDeg, elevationM: result.elevationM })
}

export function marsMetricToChunk(point: MarsLocalMetricPoint, chunkSizeM = MARS_CHUNK_SIZE_M): MarsChunkCoord {
  return { x: Math.floor(point.eastM / chunkSizeM), y: Math.floor(point.northM / chunkSizeM) }
}

export function marsGeoToChunk(point: MarsGeoPoint, region: MarsRegionAnchor): MarsChunkCoord {
  return marsMetricToChunk(marsGeoToLocalMeters(point, region.origin), region.chunkSizeM)
}

export function marsMetricToChunkCell(point: MarsLocalMetricPoint, chunkSizeM = MARS_CHUNK_SIZE_M, cellSizeM = MARS_CELL_SIZE_M): MarsChunkCell {
  if (chunkSizeM <= 0 || cellSizeM <= 0 || chunkSizeM % cellSizeM !== 0) throw new Error('chunkSizeM must be a positive multiple of cellSizeM')
  const chunk = marsMetricToChunk(point, chunkSizeM)
  return {
    chunk,
    localX: Math.floor((point.eastM - chunk.x * chunkSizeM) / cellSizeM),
    localY: Math.floor((point.northM - chunk.y * chunkSizeM) / cellSizeM),
  }
}

export function marsGeoToChunkCell(point: MarsGeoPoint, region: MarsRegionAnchor): MarsChunkCell {
  return marsMetricToChunkCell(marsGeoToLocalMeters(point, region.origin), region.chunkSizeM, region.cellSizeM)
}

export function marsChunkKey(regionId: string, chunk: MarsChunkCoord): string {
  return `mars:${regionId}:${chunk.x}:${chunk.y}`
}

export const THARSIS_REGION: MarsRegionAnchor = {
  id: 'tharsis',
  name: 'Tharsis',
  origin: { lat: 0, lon: -112.5, elevationM: 0 },
  chunkSizeM: MARS_CHUNK_SIZE_M,
  cellSizeM: MARS_CELL_SIZE_M,
}
