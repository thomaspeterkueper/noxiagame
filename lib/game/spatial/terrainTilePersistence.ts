import type { TerrainRasterTileManifest } from './terrainRaster'
import { validateTerrainTileManifest } from './terrainRaster'

export interface PersistedTerrainTileRow {
  dataset_id: string
  tile_key: string
  min_lat: number
  min_lon: number
  max_lat: number
  max_lon: number
  raster_width: number | null
  raster_height: number | null
  pixel_size_m: number | null
  storage_bucket: string | null
  storage_path: string | null
  raster_format: string | null
  nodata_value: number | null
  min_elevation_m: number | null
  max_elevation_m: number | null
  checksum: string | null
  status: 'catalogued' | 'ingesting' | 'ready' | 'failed'
  metadata: Record<string, unknown> | null
}

export type TerrainTileManifestResolution =
  | { ok: true; manifest: TerrainRasterTileManifest }
  | { ok: false; code: 'TERRAIN_TILE_METADATA_INCOMPLETE'; details: string[] }

function finitePositiveInteger(value: unknown): number | null {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function metadataByteSize(metadata: Record<string, unknown> | null | undefined): number | null {
  return finitePositiveInteger(metadata?.byte_size ?? metadata?.byteSize)
}

/**
 * Convert the relational terrain_tiles row into the stricter runtime manifest.
 *
 * Phase-1 terrain_tiles predates the runtime manifest's explicit byteSize field,
 * so ingestion must persist it in metadata.byte_size. Missing provenance stays
 * unresolved; the runtime never guesses object size or checksum semantics.
 */
export function resolvePersistedTerrainTileManifest(
  row: PersistedTerrainTileRow,
): TerrainTileManifestResolution {
  const details: string[] = []
  const rasterWidth = finitePositiveInteger(row.raster_width)
  const rasterHeight = finitePositiveInteger(row.raster_height)
  const byteSize = metadataByteSize(row.metadata)

  if (!rasterWidth) details.push('raster_width')
  if (!rasterHeight) details.push('raster_height')
  if (!row.storage_bucket?.trim()) details.push('storage_bucket')
  if (!row.storage_path?.trim()) details.push('storage_path')
  if (!row.raster_format?.trim()) details.push('raster_format')
  if (!row.checksum || !/^[a-f0-9]{64}$/i.test(row.checksum)) details.push('checksum')
  if (!byteSize) details.push('metadata.byte_size')

  if (details.length) {
    return { ok: false, code: 'TERRAIN_TILE_METADATA_INCOMPLETE', details }
  }

  const manifest: TerrainRasterTileManifest = {
    datasetId: row.dataset_id,
    tileKey: row.tile_key,
    minLatDeg: Number(row.min_lat),
    minLonDeg: Number(row.min_lon),
    maxLatDeg: Number(row.max_lat),
    maxLonDeg: Number(row.max_lon),
    rasterWidth: rasterWidth!,
    rasterHeight: rasterHeight!,
    pixelSizeM: row.pixel_size_m == null ? null : Number(row.pixel_size_m),
    storageBucket: row.storage_bucket!,
    storagePath: row.storage_path!,
    rasterFormat: row.raster_format!,
    nodataValue: row.nodata_value == null ? null : Number(row.nodata_value),
    minElevationM: row.min_elevation_m == null ? null : Number(row.min_elevation_m),
    maxElevationM: row.max_elevation_m == null ? null : Number(row.max_elevation_m),
    checksum: row.checksum!,
    checksumAlgorithm: 'sha256',
    byteSize: byteSize!,
    status: row.status,
    metadata: row.metadata ?? {},
  }

  try {
    validateTerrainTileManifest(manifest)
    return { ok: true, manifest }
  } catch (error) {
    return {
      ok: false,
      code: 'TERRAIN_TILE_METADATA_INCOMPLETE',
      details: [error instanceof Error ? error.message : String(error)],
    }
  }
}
