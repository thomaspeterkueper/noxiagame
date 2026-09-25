import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { CachedPhobosHrscAdapter } from './phobosTerrainIngestion'
import { PHOBOS_HRSC_DATASET, type PhobosRasterImageOpener, type PhobosVerticalConverter } from './phobosTerrainAdapter'
import { loadPersistedTerrainRuntimeCatalogue } from './persistedTerrainRuntime.server'
import { RasterTerrainSampler } from './terrainRaster'
import type { TerrainSampler } from './terrainSampling'
import { SupabaseTerrainObjectStore } from './supabaseTerrainObjectStore'
import { createTerrainGeoTiffOpener } from './terrainGeoTiff.server'

export interface PhobosTerrainRuntimeStatus {
  datasetId: string
  persistedReadyTiles: number
  runtimeReadyTiles: number
  rejectedTiles: Array<{ tileKey: string; details: string[] }>
  decoderAvailable: boolean
}

export interface PhobosTerrainRuntime {
  sampler: TerrainSampler | null
  status: PhobosTerrainRuntimeStatus
}

/**
 * Server-side Phobos terrain runtime over validated cached HRSC-DEM coverage.
 * Same body-independent shape as loadMarsTerrainRuntime/loadShackletonTerrainRuntime:
 * no remote fallback, no synthetic flat terrain -- missing/invalid coverage
 * stays unresolved rather than silently faked.
 */
export async function loadPhobosTerrainRuntime(
  supabase: SupabaseClient,
  openImage?: PhobosRasterImageOpener | null,
  convertVertical?: PhobosVerticalConverter,
): Promise<PhobosTerrainRuntime> {
  const hydrated = await loadPersistedTerrainRuntimeCatalogue(supabase, PHOBOS_HRSC_DATASET.id)
  const decoder = openImage === null
    ? null
    : openImage ?? createTerrainGeoTiffOpener(new SupabaseTerrainObjectStore(supabase))
  const status: PhobosTerrainRuntimeStatus = {
    ...hydrated.status,
    decoderAvailable: Boolean(decoder),
  }

  if (!decoder || status.runtimeReadyTiles === 0) return { sampler: null, status }

  return {
    sampler: new RasterTerrainSampler([
      new CachedPhobosHrscAdapter(hydrated.catalogue, decoder, convertVertical),
    ]),
    status,
  }
}
