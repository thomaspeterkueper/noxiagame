import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { CachedMarsMolaAdapter } from './marsTerrainIngestion'
import { MARS_MOLA_DATASET, type MolaRasterImageOpener, type MolaVerticalConverter } from './molaTerrainAdapter'
import { loadPersistedTerrainRuntimeCatalogue } from './persistedTerrainRuntime.server'
import { RasterTerrainSampler } from './terrainRaster'
import type { TerrainSampler } from './terrainSampling'

export interface MarsTerrainRuntimeStatus {
  datasetId: string
  persistedReadyTiles: number
  runtimeReadyTiles: number
  rejectedTiles: Array<{ tileKey: string; details: string[] }>
  decoderAvailable: boolean
}

export interface MarsTerrainRuntime {
  sampler: TerrainSampler | null
  status: MarsTerrainRuntimeStatus
}

/**
 * Server-side Mars terrain runtime over validated cached MOLA coverage.
 *
 * A persisted tile is not enough to expose terrain to gameplay: the referenced
 * private object must pass byte/checksum validation, and a concrete GeoTIFF image
 * decoder must be injected. Until both gates are satisfied, Mars terrain remains
 * explicitly unresolved rather than falling back to the remote global DEM or a
 * synthetic flat surface.
 */
export async function loadMarsTerrainRuntime(
  supabase: SupabaseClient,
  openImage?: MolaRasterImageOpener | null,
  convertVertical?: MolaVerticalConverter,
): Promise<MarsTerrainRuntime> {
  const hydrated = await loadPersistedTerrainRuntimeCatalogue(supabase, MARS_MOLA_DATASET.id)
  const status: MarsTerrainRuntimeStatus = {
    ...hydrated.status,
    decoderAvailable: Boolean(openImage),
  }

  if (!openImage || status.runtimeReadyTiles === 0) return { sampler: null, status }

  return {
    sampler: new RasterTerrainSampler([
      new CachedMarsMolaAdapter(hydrated.catalogue, openImage, convertVertical),
    ]),
    status,
  }
}
