import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadShackletonTerrainRuntime,
  SHACKLETON_LOLA_DATASET_ID,
  SHACKLETON_POLAR_LOLA_DATASET_ID,
} from './shackletonTerrainRuntime'
import { createSupabaseLolaImageOpener } from './supabaseLolaImageOpener.server'
import { loadMarsTerrainRuntime } from './marsTerrainRuntime'
import { MARS_MOLA_DATASET } from './molaTerrainAdapter'
import { loadPhobosTerrainRuntime } from './phobosTerrainRuntime'
import { PHOBOS_HRSC_DATASET } from './phobosTerrainAdapter'
import type { TerrainSampler } from './terrainSampling'

export interface RuntimeTerrainSamplerResolution {
  sampler: TerrainSampler | null
  supported: boolean
  datasetId: string
  details?: string
}

const runtimeCache = new Map<string, Promise<RuntimeTerrainSamplerResolution>>()

async function createRuntimeTerrainSampler(
  supabase: SupabaseClient,
  datasetId: string,
): Promise<RuntimeTerrainSamplerResolution> {
  if (datasetId === SHACKLETON_LOLA_DATASET_ID || datasetId === SHACKLETON_POLAR_LOLA_DATASET_ID) {
    const runtime = await loadShackletonTerrainRuntime(
      supabase,
      createSupabaseLolaImageOpener(supabase),
      datasetId,
    )
    return {
      sampler: runtime.sampler,
      supported: true,
      datasetId,
      details: runtime.sampler ? undefined : `No validated/decodable Shackleton terrain tile is runtime-ready for ${datasetId}`,
    }
  }

  if (datasetId === MARS_MOLA_DATASET.id) {
    const runtime = await loadMarsTerrainRuntime(supabase)
    return {
      sampler: runtime.sampler,
      supported: true,
      datasetId,
      details: runtime.sampler ? undefined : 'No validated/decodable Mars MOLA tile is runtime-ready',
    }
  }

  if (datasetId === PHOBOS_HRSC_DATASET.id) {
    const runtime = await loadPhobosTerrainRuntime(supabase)
    return {
      sampler: runtime.sampler,
      supported: true,
      datasetId,
      details: runtime.sampler ? undefined : 'No validated/decodable Phobos HRSC tile is runtime-ready',
    }
  }

  return {
    sampler: null,
    supported: false,
    datasetId,
    details: `No runtime terrain adapter registered for dataset ${datasetId}`,
  }
}

export function resolveRuntimeTerrainSampler(
  supabase: SupabaseClient,
  datasetId: string,
): Promise<RuntimeTerrainSamplerResolution> {
  const cached = runtimeCache.get(datasetId)
  if (cached) return cached

  const pending = createRuntimeTerrainSampler(supabase, datasetId).catch(error => {
    runtimeCache.delete(datasetId)
    throw error
  })
  runtimeCache.set(datasetId, pending)
  return pending
}
