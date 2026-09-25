import {
  PhobosTerrainAdapter,
  type PhobosRasterImageOpener,
  type PhobosVerticalConverter,
} from './phobosTerrainAdapter'
import { terrainStorageUri, TerrainTileCatalogue } from './terrainTileCatalogue'
import type { TerrainRasterAdapter, TerrainRasterSourceSample } from './terrainRaster'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'

/**
 * Phobos read adapter over validated cached HRSC-DEM tiles. Coverage is
 * selected by the shared body-independent catalogue, mirroring the Mars/MOLA
 * cached-tile pattern exactly (the whole-body raster is ingested as a single
 * tile since it is only ~478kB).
 */
export class CachedPhobosHrscAdapter implements TerrainRasterAdapter {
  readonly id = 'phobos-mex-hrsc-dem-cache'

  constructor(
    private readonly catalogue: TerrainTileCatalogue,
    private readonly openImage: PhobosRasterImageOpener,
    private readonly convertVertical?: PhobosVerticalConverter,
  ) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === 'phobos_mex_hrsc_dem_100m'
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
    const adapter = new PhobosTerrainAdapter(this.openImage, this.convertVertical)
    const sample = await adapter.sampleAtPlanetary(cachedDataset, frame, coordinate)
    return sample ? { ...sample, tileKey: tile.manifest.tileKey } : null
  }
}
