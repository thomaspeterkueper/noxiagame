import { LolaTerrainAdapter, type LolaRasterImageOpener } from './lolaTerrainAdapter'
import { LolaSouthPolarTerrainAdapter, SHACKLETON_POLAR_LOLA_DATASET_ID } from './lolaPolarTerrainAdapter'
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

export class ShackletonTerrainIngestion extends TerrainTileCatalogue {}

export class CachedShackletonLolaAdapter implements TerrainRasterAdapter {
  readonly id = 'moon-lro-lola-118m-shackleton-cache'

  constructor(
    private readonly ingestion: ShackletonTerrainIngestion,
    private readonly openImage: LolaRasterImageOpener,
  ) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === 'moon_lro_lola_118m'
  }

  async sampleAtPlanetary(dataset: TerrainDatasetDescriptor, frame: WorldFrame, coordinate: PlanetaryCoordinate): Promise<TerrainRasterSourceSample | null> {
    const tile = this.ingestion.readyTileAt(coordinate, dataset.id)
    if (!tile) return null
    const cachedDataset = { ...dataset, sourceUri: terrainStorageUri(tile.manifest) }
    const sample = await new LolaTerrainAdapter(this.openImage).sampleAtPlanetary(cachedDataset, frame, coordinate)
    return sample ? { ...sample, tileKey: tile.manifest.tileKey } : null
  }
}

export class CachedShackletonPolarLolaAdapter implements TerrainRasterAdapter {
  readonly id = 'moon-lro-lola-south-pole-5m-shackleton-cache'

  constructor(
    private readonly ingestion: ShackletonTerrainIngestion,
    private readonly openImage: LolaRasterImageOpener,
  ) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === SHACKLETON_POLAR_LOLA_DATASET_ID
  }

  async sampleAtPlanetary(dataset: TerrainDatasetDescriptor, frame: WorldFrame, coordinate: PlanetaryCoordinate): Promise<TerrainRasterSourceSample | null> {
    const tile = this.ingestion.readyTileAt(coordinate, dataset.id)
    if (!tile) return null
    const cachedDataset: TerrainDatasetDescriptor = {
      ...dataset,
      sourceUri: terrainStorageUri(tile.manifest),
      metadata: { ...(dataset.metadata ?? {}), ...(tile.manifest.metadata ?? {}) },
    }
    const sample = await new LolaSouthPolarTerrainAdapter(this.openImage).sampleAtPlanetary(cachedDataset, frame, coordinate)
    return sample ? { ...sample, tileKey: tile.manifest.tileKey } : null
  }
}
