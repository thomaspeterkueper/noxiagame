import { LolaTerrainAdapter, type LolaRasterImageOpener } from './lolaTerrainAdapter'
import {
  validateTerrainTileManifest,
  type TerrainRasterAdapter,
  type TerrainRasterSourceSample,
  type TerrainRasterTileManifest,
} from './terrainRaster'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'

export type TerrainTileIngestionState = 'pending' | 'validating' | 'ready' | 'invalid'

export interface ShackletonTerrainTile {
  manifest: TerrainRasterTileManifest
  state: TerrainTileIngestionState
  error?: string
}

export interface TerrainTileValidator {
  validate(manifest: TerrainRasterTileManifest): Promise<void>
}

function contains(manifest: TerrainRasterTileManifest, coordinate: PlanetaryCoordinate) {
  return coordinate.latDeg >= manifest.minLatDeg
    && coordinate.latDeg <= manifest.maxLatDeg
    && coordinate.lonDeg >= manifest.minLonDeg
    && coordinate.lonDeg <= manifest.maxLonDeg
}

function storageUri(manifest: TerrainRasterTileManifest) {
  return `terrain://${manifest.storageBucket}/${manifest.storagePath}`
}

/**
 * Progressive cache catalogue for the verified Shackleton world frame.
 *
 * A tile is never exposed to gameplay/renderers before both structural manifest
 * validation and the injected byte/checksum validator succeed. Missing or invalid
 * coverage stays unresolved; there is deliberately no z=0 or synthetic fallback.
 */
export class ShackletonTerrainIngestion {
  private readonly tiles = new Map<string, ShackletonTerrainTile>()

  constructor(private readonly validator: TerrainTileValidator) {}

  catalogue(manifest: TerrainRasterTileManifest) {
    validateTerrainTileManifest(manifest)
    const tile: ShackletonTerrainTile = {
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

  readyTileAt(coordinate: PlanetaryCoordinate) {
    return [...this.tiles.values()]
      .filter(tile => tile.state === 'ready' && contains(tile.manifest, coordinate))
      .sort((a, b) => a.manifest.tileKey.localeCompare(b.manifest.tileKey))[0] ?? null
  }

  snapshot() {
    return [...this.tiles.values()].map(tile => ({
      ...tile,
      manifest: { ...tile.manifest },
    }))
  }
}

/**
 * Read adapter over validated cached LOLA tiles. The opener owns concrete byte
 * decoding/storage access; this adapter only chooses a ready tile and delegates
 * LOLA coordinate/scaling/vertical semantics to LolaTerrainAdapter.
 */
export class CachedShackletonLolaAdapter implements TerrainRasterAdapter {
  readonly id = 'moon-lro-lola-118m-shackleton-cache'

  constructor(
    private readonly ingestion: ShackletonTerrainIngestion,
    private readonly openImage: LolaRasterImageOpener,
  ) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === 'moon_lro_lola_118m'
  }

  async sampleAtPlanetary(
    dataset: TerrainDatasetDescriptor,
    frame: WorldFrame,
    coordinate: PlanetaryCoordinate,
  ): Promise<TerrainRasterSourceSample | null> {
    const tile = this.ingestion.readyTileAt(coordinate)
    if (!tile) return null

    const cachedDataset: TerrainDatasetDescriptor = {
      ...dataset,
      sourceUri: storageUri(tile.manifest),
    }
    const adapter = new LolaTerrainAdapter(this.openImage)
    const sample = await adapter.sampleAtPlanetary(cachedDataset, frame, coordinate)
    return sample ? { ...sample, tileKey: tile.manifest.tileKey } : null
  }
}
