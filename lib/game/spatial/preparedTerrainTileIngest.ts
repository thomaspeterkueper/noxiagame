import { fromArrayBuffer } from 'geotiff'
import type { TerrainRasterTileManifest } from './terrainRaster'
import { validateTerrainTileManifest } from './terrainRaster'
import type { TerrainObjectStore } from './terrainStorage'
import { sha256Hex, StoredTerrainTileValidator, storeTerrainTile } from './terrainStorage'

export interface PreparedTerrainTileInput {
  datasetId: string
  tileKey: string
  bytes: Uint8Array
  storageBucket?: string
  storagePath: string
  /** Source-product ground resolution. Keep this separate from logical planning-cell size. */
  pixelSizeM: number
  sourceUri: string
  sourceProduct?: string
  metadata?: Record<string, unknown>
}

export interface TerrainTileManifestWriter {
  markReady(manifest: TerrainRasterTileManifest): Promise<void>
}

function finiteNoData(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function manifestBounds(
  box: [number, number, number, number],
  metadata?: Record<string, unknown>,
): [number, number, number, number] {
  if (metadata?.whole_body !== true) return box

  // Global cylindrical rasters commonly encode outer pixel edges a fraction of
  // a degree beyond the physical +/-180 / +/-90 body limits. Keep the stored
  // GeoTIFF untouched for authoritative pixel geometry, but catalogue only the
  // physically valid whole-body coverage so shared manifest validation and
  // coverage lookup remain body-safe.
  return [
    Math.max(-180, box[0]),
    Math.max(-90, box[1]),
    Math.min(180, box[2]),
    Math.min(90, box[3]),
  ]
}

/**
 * Inspect a prepared GeoTIFF, derive its authoritative raster geometry, store the
 * exact bytes, re-read/checksum them, and only then expose the manifest as ready.
 *
 * Conversion/cropping into GeoTIFF is intentionally an operator/preparation step.
 * Gameplay runtime never downloads or converts global source products on demand.
 */
export async function ingestPreparedGeoTiffTile(
  store: TerrainObjectStore,
  writer: TerrainTileManifestWriter,
  input: PreparedTerrainTileInput,
): Promise<TerrainRasterTileManifest> {
  if (!input.datasetId || !input.tileKey) throw new Error('Prepared terrain tile requires datasetId and tileKey')
  if (!input.storagePath) throw new Error('Prepared terrain tile requires storagePath')
  if (!Number.isFinite(input.pixelSizeM) || input.pixelSizeM <= 0) {
    throw new Error('Prepared terrain tile pixelSizeM must be positive')
  }
  if (!input.sourceUri) throw new Error('Prepared terrain tile requires sourceUri provenance')
  if (input.bytes.byteLength === 0) throw new Error('Prepared terrain tile is empty')

  const arrayBuffer = Uint8Array.from(input.bytes).buffer
  const tiff = await fromArrayBuffer(arrayBuffer)
  if (await tiff.getImageCount() !== 1) {
    throw new Error('Prepared terrain tile must contain exactly one GeoTIFF image')
  }
  const image = await tiff.getImage()
  if (image.getSamplesPerPixel() !== 1) {
    throw new Error('Prepared terrain tile must be a single-band elevation raster')
  }

  const rawBounds = image.getBoundingBox() as [number, number, number, number]
  const [minLonDeg, minLatDeg, maxLonDeg, maxLatDeg] = manifestBounds(rawBounds, input.metadata)
  const manifest: TerrainRasterTileManifest = {
    datasetId: input.datasetId,
    tileKey: input.tileKey,
    minLatDeg,
    minLonDeg,
    maxLatDeg,
    maxLonDeg,
    rasterWidth: image.getWidth(),
    rasterHeight: image.getHeight(),
    pixelSizeM: input.pixelSizeM,
    storageBucket: input.storageBucket ?? 'terrain',
    storagePath: input.storagePath,
    rasterFormat: 'geotiff',
    nodataValue: finiteNoData(image.getGDALNoData()),
    checksum: sha256Hex(input.bytes),
    checksumAlgorithm: 'sha256',
    byteSize: input.bytes.byteLength,
    status: 'ready',
    metadata: {
      ...input.metadata,
      byte_size: input.bytes.byteLength,
      source_uri: input.sourceUri,
      source_product: input.sourceProduct ?? null,
      ingest_contract: 'prepared-geotiff-v1',
      ...(input.metadata?.whole_body === true ? { source_raster_bounds: rawBounds } : {}),
    },
  }

  validateTerrainTileManifest(manifest)
  await storeTerrainTile(store, manifest, input.bytes)
  await new StoredTerrainTileValidator(store).validate(manifest)
  await writer.markReady(manifest)
  return manifest
}
