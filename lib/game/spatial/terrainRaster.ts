import { localWorldToPlanetary } from './planetary'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'
import type {
  ResolvedTerrainHeightSample,
  TerrainSampleContext,
  TerrainSampleRequest,
  TerrainSampler,
} from './terrainSampling'

export type TerrainRasterTileStatus = 'catalogued' | 'ingesting' | 'ready' | 'failed'

/** Metadata stored in terrain_tiles. Raster bytes stay in object/file storage. */
export interface TerrainRasterTileManifest {
  datasetId: string
  tileKey: string
  minLatDeg: number
  minLonDeg: number
  maxLatDeg: number
  maxLonDeg: number
  rasterWidth: number
  rasterHeight: number
  pixelSizeM?: number | null
  storageBucket: string
  storagePath: string
  rasterFormat: string
  nodataValue?: number | null
  minElevationM?: number | null
  maxElevationM?: number | null
  checksum: string
  checksumAlgorithm: 'sha256'
  byteSize: number
  status: TerrainRasterTileStatus
  metadata?: Record<string, unknown>
}

export interface TerrainRasterSourceSample {
  /** Elevation in the dataset's native vertical reference. */
  sourceElevationM: number
  /**
   * Local ENU Up after the adapter has performed the required vertical datum
   * conversion. This is deliberately distinct from sourceElevationM.
   */
  localUpM: number
  tileKey: string
}

/**
 * Source-specific raster adapter. Projection, native datum handling and raster
 * decoding belong here, not in renderers or generic terrain gameplay code.
 */
export interface TerrainRasterAdapter {
  id: string
  supports(dataset: TerrainDatasetDescriptor): boolean
  sampleAtPlanetary(
    dataset: TerrainDatasetDescriptor,
    frame: WorldFrame,
    coordinate: PlanetaryCoordinate,
  ): Promise<TerrainRasterSourceSample | null>
}

export function validateTerrainTileManifest(manifest: TerrainRasterTileManifest) {
  if (!manifest.datasetId || !manifest.tileKey) throw new Error('Terrain tile requires datasetId and tileKey')
  if (manifest.rasterWidth <= 0 || manifest.rasterHeight <= 0) throw new Error('Terrain tile raster dimensions must be positive')
  if (manifest.byteSize <= 0) throw new Error('Terrain tile byteSize must be positive')
  if (!manifest.storageBucket || !manifest.storagePath) throw new Error('Terrain tile requires external storage location')
  if (!/^[a-f0-9]{64}$/i.test(manifest.checksum)) throw new Error('Terrain tile requires a SHA-256 checksum')
  if (manifest.minLatDeg < -90 || manifest.maxLatDeg > 90 || manifest.maxLatDeg < manifest.minLatDeg) {
    throw new Error('Terrain tile latitude bounds are invalid')
  }
  if (manifest.minLonDeg < -180 || manifest.minLonDeg > 180 || manifest.maxLonDeg < -180 || manifest.maxLonDeg > 180) {
    throw new Error('Terrain tile longitude bounds are invalid')
  }
}

export function selectTerrainRasterAdapter(
  adapters: TerrainRasterAdapter[],
  dataset: TerrainDatasetDescriptor,
): TerrainRasterAdapter {
  const matches = adapters.filter(adapter => adapter.supports(dataset))
  if (matches.length === 0) throw new Error(`No terrain raster adapter supports ${dataset.id}`)
  if (matches.length > 1) throw new Error(`Multiple terrain raster adapters support ${dataset.id}`)
  return matches[0]
}

/**
 * Bridges source-specific raster adapters into the canonical TerrainSampler.
 * x/y are converted to planetary coordinates using the verified world frame.
 * No terrain z is assumed during that horizontal lookup; `upM: 0` is the ENU
 * reference plane, not a fallback terrain elevation.
 */
export class RasterTerrainSampler implements TerrainSampler {
  constructor(private readonly adapters: TerrainRasterAdapter[]) {}

  async sampleTerrainHeight(
    context: TerrainSampleContext,
    point: TerrainSampleRequest,
  ): Promise<ResolvedTerrainHeightSample | null> {
    const planetary = localWorldToPlanetary({ xM: point.xM, yM: point.yM, zM: 0 }, context.frame)
    if (!planetary) return null

    const adapter = selectTerrainRasterAdapter(this.adapters, context.dataset)
    const source = await adapter.sampleAtPlanetary(context.dataset, context.frame, planetary)
    if (!source) return null

    return {
      xM: point.xM,
      yM: point.yM,
      zM: source.localUpM,
      datasetId: context.dataset.id,
      sourceElevationM: source.sourceElevationM,
      verticalReference: context.dataset.verticalReference,
    }
  }
}
