import { validateTerrainTileManifest, type TerrainRasterTileManifest } from './terrainRaster'
import type { PlanetaryCoordinate } from './types'

export type TerrainTileIngestionState = 'pending' | 'validating' | 'ready' | 'invalid'

export interface TerrainTileRecord {
  manifest: TerrainRasterTileManifest
  state: TerrainTileIngestionState
  error?: string
}

export interface TerrainTileValidator {
  validate(manifest: TerrainRasterTileManifest): Promise<void>
}

function normalizeLongitude(lonDeg: number) {
  const normalized = ((lonDeg + 180) % 360 + 360) % 360 - 180
  return normalized === -180 ? 180 : normalized
}

function contains(manifest: TerrainRasterTileManifest, coordinate: PlanetaryCoordinate) {
  const lon = normalizeLongitude(coordinate.lonDeg)
  return coordinate.latDeg >= manifest.minLatDeg
    && coordinate.latDeg <= manifest.maxLatDeg
    && lon >= manifest.minLonDeg
    && lon <= manifest.maxLonDeg
}

export function terrainStorageUri(manifest: TerrainRasterTileManifest) {
  return `terrain://${manifest.storageBucket}/${manifest.storagePath}`
}

/**
 * Body-independent progressive terrain cache catalogue.
 *
 * A tile is visible to sampling/gameplay only after structural manifest
 * validation and the injected byte/checksum validator both succeed. Missing,
 * invalid or still-ingesting coverage remains unresolved. This class makes no
 * assumption about Earth/Moon/Mars, raster decoder, vertical datum or renderer.
 */
export class TerrainTileCatalogue {
  private readonly tiles = new Map<string, TerrainTileRecord>()

  constructor(private readonly validator: TerrainTileValidator) {}

  catalogue(manifest: TerrainRasterTileManifest) {
    validateTerrainTileManifest(manifest)
    const tile: TerrainTileRecord = {
      manifest: { ...manifest, status: 'catalogued' },
      state: 'pending',
    }
    this.tiles.set(manifest.tileKey, tile)
    return tile
  }

  async ingest(tileKey: string) {
    const tile = this.tiles.get(tileKey)
    if (!tile) throw new Error(`Unknown terrain tile ${tileKey}`)

    tile.state = 'validating'
    tile.manifest = { ...tile.manifest, status: 'ingesting' }
    delete tile.error

    try {
      await this.validator.validate(tile.manifest)
      tile.state = 'ready'
      tile.manifest = { ...tile.manifest, status: 'ready' }
    } catch (error) {
      tile.state = 'invalid'
      tile.manifest = { ...tile.manifest, status: 'failed' }
      tile.error = error instanceof Error ? error.message : String(error)
    }
    return tile
  }

  readyTileAt(coordinate: PlanetaryCoordinate, datasetId?: string) {
    return [...this.tiles.values()]
      .filter(tile => tile.state === 'ready'
        && (!datasetId || tile.manifest.datasetId === datasetId)
        && contains(tile.manifest, coordinate))
      .sort((a, b) => {
        const resolutionA = a.manifest.pixelSizeM ?? Number.POSITIVE_INFINITY
        const resolutionB = b.manifest.pixelSizeM ?? Number.POSITIVE_INFINITY
        return resolutionA - resolutionB || a.manifest.tileKey.localeCompare(b.manifest.tileKey)
      })[0] ?? null
  }

  snapshot() {
    return [...this.tiles.values()].map(tile => ({
      ...tile,
      manifest: { ...tile.manifest },
    }))
  }
}
