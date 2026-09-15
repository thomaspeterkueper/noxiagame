import { LolaTerrainAdapter, type LolaRasterImageOpener } from './lolaTerrainAdapter'
import {
  TerrainTileCatalogue,
  terrainStorageUri,
  type TerrainTileIngestionState,
  type TerrainTileRecord,
  type TerrainTileValidator,
} from './terrainTileCatalogue'
import type { TerrainRasterAdapter, TerrainRasterSourceSample } from './terrainRaster'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'

export type { TerrainTileIngestionState, TerrainTileValidator }
export type ShackletonTerrainTile = TerrainTileRecord

/**
 * Backward-compatible Moon/Schackleton name over the body-independent terrain
 * catalogue. Existing Moon callers keep their API while new bodies use the
 * generic catalogue directly.
 */
export class ShackletonTerrainIngestion extends TerrainTileCatalogue {}

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
    const tile = this.ingestion.readyTileAt(coordinate, dataset.id)
    if (!tile) return null

    const cachedDataset: TerrainDatasetDescriptor = {
      ...dataset,
      sourceUri: terrainStorageUri(tile.manifest),
    }
    const adapter = new LolaTerrainAdapter(this.openImage)
    const sample = await adapter.sampleAtPlanetary(cachedDataset, frame, coordinate)
    return sample ? { ...sample, tileKey: tile.manifest.tileKey } : null
  }
}
