import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { CachedMarsMolaAdapter } from './marsTerrainIngestion'
import { MARS_MOLA_DATASET, type MolaRasterImageOpener, type MolaVerticalConverter } from './molaTerrainAdapter'
import { loadPersistedTerrainRuntimeCatalogue } from './persistedTerrainRuntime.server'
import { RasterTerrainSampler } from './terrainRaster'
import type { TerrainSampler } from './terrainSampling'
import { SupabaseTerrainObjectStore } from './supabaseTerrainObjectStore'
import { createTerrainGeoTiffOpener } from './terrainGeoTiff.server'

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
 * private object must pass byte/checksum validation and be decodable as GeoTIFF.
 * The default decoder reads only validated `terrain://` object-storage URIs.
 * Passing `null` explicitly disables decoding for diagnostics/tests.
 *
 * There is deliberately no remote global-DEM fallback and no synthetic flat
 * terrain. Missing/invalid cached coverage stays unresolved.
 */
export async function loadMarsTerrainRuntime(
  supabase: SupabaseClient,
  openImage?: MolaRasterImageOpener | null,
  convertVertical?: MolaVerticalConverter,
): Promise<MarsTerrainRuntime> {
  const hydrated = await loadPersistedTerrainRuntimeCatalogue(supabase, MARS_MOLA_DATASET.id)
  const decoder = openImage === null
    ? null
    : openImage ?? createTerrainGeoTiffOpener(new SupabaseTerrainObjectStore(supabase))
  const status: MarsTerrainRuntimeStatus = {
    ...hydrated.status,
    decoderAvailable: Boolean(decoder),
  }

  if (!decoder || status.runtimeReadyTiles === 0) return { sampler: null, status }

  return {
    sampler: new RasterTerrainSampler([
      new CachedMarsMolaAdapter(hydrated.catalogue, decoder, convertVertical),
    ]),
    status,
  }
}
