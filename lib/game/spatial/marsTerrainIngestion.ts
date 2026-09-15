import {
  MolaTerrainAdapter,
  type MolaRasterImageOpener,
  type MolaVerticalConverter,
} from './molaTerrainAdapter'
import { terrainStorageUri, TerrainTileCatalogue } from './terrainTileCatalogue'
import type { TerrainRasterAdapter, TerrainRasterSourceSample } from './terrainRaster'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'

/**
 * Mars read adapter over validated cached MOLA tiles. Coverage is selected by
 * the shared body-independent catalogue; MOLA remains responsible for its
 * raster/value and vertical-datum semantics.
 */
export class CachedMarsMolaAdapter implements TerrainRasterAdapter {
  readonly id = 'mars-mgs-mola-megdr-cache'

  constructor(
    private readonly catalogue: TerrainTileCatalogue,
    private readonly openImage: MolaRasterImageOpener,
    private readonly convertVertical?: MolaVerticalConverter,
  ) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === 'mars_mgs_mola_463m'
  }

  async sampleAtPlanetary(
    dataset: TerrainDatasetDescriptor,
    frame: WorldFrame,
    coordinate: PlanetaryCoordinate,
  ): Promise<TerrainRasterSourceSample | null> {
    const tile = this.catalogue.readyTileAt(coordinate, dataset.id)
    if (!tile) return null

    const cachedDataset: TerrainDatasetDescriptor = {
      ...dataset,
      sourceUri: terrainStorageUri(tile.manifest),
    }
    const adapter = new MolaTerrainAdapter(this.openImage, this.convertVertical)
    const sample = await adapter.sampleAtPlanetary(cachedDataset, frame, coordinate)
    return sample ? { ...sample, tileKey: tile.manifest.tileKey } : null
  }
}
