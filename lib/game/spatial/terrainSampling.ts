import type {
  Footprint,
  TerrainDatasetDescriptor,
  TerrainFootprintSummary,
  TerrainHeightSample,
  WorldFrame,
} from './types'
import { footprintSamplePoints, summarizeTerrainFootprint } from './terrain'

/**
 * Renderer-independent terrain sampling boundary.
 *
 * Adapters resolve observed raster data. They must never manufacture elevation
 * when the frame origin, dataset or raster sample is unresolved.
 */
export interface TerrainSampleContext {
  frame: WorldFrame
  dataset: TerrainDatasetDescriptor
}

export interface TerrainSampleRequest {
  xM: number
  yM: number
}

export interface ResolvedTerrainHeightSample extends TerrainHeightSample {
  datasetId: string
  sourceElevationM: number
  verticalReference: string
}

export interface TerrainSampler {
  sampleTerrainHeight(
    context: TerrainSampleContext,
    point: TerrainSampleRequest,
  ): Promise<ResolvedTerrainHeightSample | null>
}

export interface TerrainFootprintResolution {
  samples: ResolvedTerrainHeightSample[]
  summary: TerrainFootprintSummary
}

export function assertTerrainSamplingReady(context: TerrainSampleContext) {
  const { frame, dataset } = context
  if (frame.originStatus !== 'verified') {
    throw new Error('Terrain sampling requires a verified world-frame origin')
  }
  if (frame.originLatDeg == null || frame.originLonDeg == null || frame.originAltM == null) {
    throw new Error('Terrain sampling requires complete world-frame origin coordinates')
  }
  if (dataset.status !== 'ready') {
    throw new Error(`Terrain dataset ${dataset.id} is not ready`)
  }
  if (frame.terrainDatasetId && frame.terrainDatasetId !== dataset.id) {
    throw new Error(`World frame expects terrain dataset ${frame.terrainDatasetId}, got ${dataset.id}`)
  }
}

export async function sampleTerrainFootprint(
  sampler: TerrainSampler,
  context: TerrainSampleContext,
  footprint: Footprint,
): Promise<TerrainFootprintResolution | null> {
  assertTerrainSamplingReady(context)
  const points = footprintSamplePoints(footprint)
  const samples: ResolvedTerrainHeightSample[] = []

  for (const point of points) {
    const sample = await sampler.sampleTerrainHeight(context, point)
    // NoData or otherwise unresolved terrain stays unresolved. A partial
    // footprint must not silently become an authoritative foundation height.
    if (!sample) return null
    samples.push(sample)
  }

  return {
    samples,
    summary: summarizeTerrainFootprint(samples),
  }
}
