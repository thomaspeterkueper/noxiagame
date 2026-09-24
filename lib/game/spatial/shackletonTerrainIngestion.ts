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

/**
 * A cache wrapper must keep the concrete raster adapters alive across samples.
 * Creating a new Lola*Adapter for every sample defeats their imagePromise cache
 * and re-downloads the same GeoTIFF for every height lookup. Site04 is ~41 MB,
 * so that behaviour can saturate Storage/PostgREST and starve the spatial API.
 */
export class CachedShackletonLolaAdapter implements TerrainRasterAdapter {
  readonly id = 'moon-lro-lola-118m-shackleton-cache'
  private readonly lolaAdapters = new Map<string, LolaTerrainAdapter>()
  private readonly polarAdapters = new Map<string, LolaSouthPolarTerrainAdapter>()

  constructor(
    private readonly ingestion: ShackletonTerrainIngestion,
    private readonly openImage: LolaRasterImageOpener,
  ) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === 'moon_lro_lola_118m'
  }

  private lolaAdapter(sourceUri: string) {
    let adapter = this.lolaAdapters.get(sourceUri)
    if (!adapter) {
      adapter = new LolaTerrainAdapter(this.openImage)
      this.lolaAdapters.set(sourceUri, adapter)
    }
    return adapter
  }

  private polarAdapter(sourceUri: string) {
    let adapter = this.polarAdapters.get(sourceUri)
    if (!adapter) {
      adapter = new LolaSouthPolarTerrainAdapter(this.openImage)
      this.polarAdapters.set(sourceUri, adapter)
    }
    return adapter
  }

  async sampleAtPlanetary(dataset: TerrainDatasetDescriptor, frame: WorldFrame, coordinate: PlanetaryCoordinate): Promise<TerrainRasterSourceSample | null> {
    // Migration bridge: while the world frame still names the historical 118 m
    // dataset, prefer a validated metric south-polar Site04 tile when present.
    // This removes the polar lat/lon-strip artefact without changing gameplay
    // callers. The authoritative source provenance is carried by the returned
    // tile key and its manifest metadata.
    const polarTile = this.ingestion.readyTileAt(coordinate, SHACKLETON_POLAR_LOLA_DATASET_ID)
    if (polarTile) {
      const sourceUri = terrainStorageUri(polarTile.manifest)
      const polarDataset: TerrainDatasetDescriptor = {
        ...dataset,
        id: SHACKLETON_POLAR_LOLA_DATASET_ID,
        datasetName: 'LOLA Shackleton Rim Site04 5m',
        resolutionM: polarTile.manifest.pixelSizeM ?? 5,
        horizontalReference: 'MOON_ME_SOUTH_POLAR_STEREOGRAPHIC_DE421',
        verticalReference: 'MOON_ME_DE421_SURFACE_HEIGHT',
        sourceUri,
        accessMode: 'polar-stereographic-geotiff',
        metadata: { ...(dataset.metadata ?? {}), ...(polarTile.manifest.metadata ?? {}) },
      }
      const sample = await this.polarAdapter(sourceUri).sampleAtPlanetary(polarDataset, frame, coordinate)
      if (sample) return { ...sample, tileKey: polarTile.manifest.tileKey }
    }

    const tile = this.ingestion.readyTileAt(coordinate, dataset.id)
    if (!tile) return null
    const sourceUri = terrainStorageUri(tile.manifest)
    const cachedDataset = { ...dataset, sourceUri }
    const sample = await this.lolaAdapter(sourceUri).sampleAtPlanetary(cachedDataset, frame, coordinate)
    return sample ? { ...sample, tileKey: tile.manifest.tileKey } : null
  }
}

export class CachedShackletonPolarLolaAdapter implements TerrainRasterAdapter {
  readonly id = 'moon-lro-lola-south-pole-5m-shackleton-cache'
  private readonly adapters = new Map<string, LolaSouthPolarTerrainAdapter>()

  constructor(
    private readonly ingestion: ShackletonTerrainIngestion,
    private readonly openImage: LolaRasterImageOpener,
  ) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === SHACKLETON_POLAR_LOLA_DATASET_ID
  }

  private adapter(sourceUri: string) {
    let adapter = this.adapters.get(sourceUri)
    if (!adapter) {
      adapter = new LolaSouthPolarTerrainAdapter(this.openImage)
      this.adapters.set(sourceUri, adapter)
    }
    return adapter
  }

  async sampleAtPlanetary(dataset: TerrainDatasetDescriptor, frame: WorldFrame, coordinate: PlanetaryCoordinate): Promise<TerrainRasterSourceSample | null> {
    const tile = this.ingestion.readyTileAt(coordinate, dataset.id)
    if (!tile) return null
    const sourceUri = terrainStorageUri(tile.manifest)
    const cachedDataset: TerrainDatasetDescriptor = {
      ...dataset,
      sourceUri,
      metadata: { ...(dataset.metadata ?? {}), ...(tile.manifest.metadata ?? {}) },
    }
    const sample = await this.adapter(sourceUri).sampleAtPlanetary(cachedDataset, frame, coordinate)
    return sample ? { ...sample, tileKey: tile.manifest.tileKey } : null
  }
}
