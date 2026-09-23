import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CachedShackletonLolaAdapter,
  CachedShackletonPolarLolaAdapter,
  ShackletonTerrainIngestion,
} from './shackletonTerrainIngestion'
import type { LolaRasterImageOpener } from './lolaTerrainAdapter'
import { SHACKLETON_POLAR_LOLA_DATASET_ID } from './lolaPolarTerrainAdapter'
import { RasterTerrainSampler } from './terrainRaster'
import { StoredTerrainTileValidator } from './terrainStorage'
import { SupabaseTerrainObjectStore } from './supabaseTerrainObjectStore'
import { resolvePersistedTerrainTileManifest, type PersistedTerrainTileRow } from './terrainTilePersistence'
import type { TerrainSampler } from './terrainSampling'

export const SHACKLETON_LOLA_DATASET_ID = 'moon_lro_lola_118m'
export { SHACKLETON_POLAR_LOLA_DATASET_ID }

export interface ShackletonTerrainRuntimeStatus {
  datasetId: string
  persistedReadyTiles: number
  runtimeReadyTiles: number
  rejectedTiles: Array<{ tileKey: string; details: string[] }>
  decoderAvailable: boolean
}

export interface ShackletonTerrainRuntime {
  sampler: TerrainSampler | null
  status: ShackletonTerrainRuntimeStatus
}

const TILE_SELECT = [
  'dataset_id', 'tile_key', 'min_lat', 'min_lon', 'max_lat', 'max_lon',
  'raster_width', 'raster_height', 'pixel_size_m', 'storage_bucket', 'storage_path',
  'raster_format', 'nodata_value', 'min_elevation_m', 'max_elevation_m',
  'checksum', 'status', 'metadata',
].join(',')

export async function loadShackletonTerrainRuntime(
  supabase: SupabaseClient,
  openImage?: LolaRasterImageOpener | null,
  datasetId: string = SHACKLETON_LOLA_DATASET_ID,
): Promise<ShackletonTerrainRuntime> {
  const datasetIds = datasetId === SHACKLETON_LOLA_DATASET_ID
    ? [SHACKLETON_POLAR_LOLA_DATASET_ID, SHACKLETON_LOLA_DATASET_ID]
    : [datasetId]

  const { data, error } = await supabase
    .from('terrain_tiles')
    .select(TILE_SELECT)
    .in('dataset_id', datasetIds)
    .eq('status', 'ready')
    .order('pixel_size_m', { ascending: true })

  if (error) throw new Error(`Shackleton terrain tile query failed: ${error.message}`)

  const rows = (data ?? []) as unknown as PersistedTerrainTileRow[]
  const store = new SupabaseTerrainObjectStore(supabase)
  const validator = new StoredTerrainTileValidator(store)
  const ingestion = new ShackletonTerrainIngestion(validator)
  const rejectedTiles: Array<{ tileKey: string; details: string[] }> = []

  for (const row of rows) {
    const resolution = resolvePersistedTerrainTileManifest(row)
    if (resolution.ok === false) {
      rejectedTiles.push({ tileKey: row.tile_key, details: resolution.details })
      continue
    }
    try {
      ingestion.catalogue(resolution.manifest)
      const record = await ingestion.ingest(resolution.manifest.tileKey)
      if (record.state !== 'ready') rejectedTiles.push({ tileKey: resolution.manifest.tileKey, details: [record.error ?? `unexpected ingestion state ${record.state}`] })
    } catch (runtimeError) {
      rejectedTiles.push({ tileKey: resolution.manifest.tileKey, details: [runtimeError instanceof Error ? runtimeError.message : String(runtimeError)] })
    }
  }

  const runtimeReadyTiles = ingestion.snapshot().filter(tile => tile.state === 'ready').length
  const status: ShackletonTerrainRuntimeStatus = {
    datasetId,
    persistedReadyTiles: rows.length,
    runtimeReadyTiles,
    rejectedTiles,
    decoderAvailable: Boolean(openImage),
  }
  if (!openImage || runtimeReadyTiles === 0) return { sampler: null, status }

  const adapter = datasetId === SHACKLETON_POLAR_LOLA_DATASET_ID
    ? new CachedShackletonPolarLolaAdapter(ingestion, openImage)
    : new CachedShackletonLolaAdapter(ingestion, openImage)

  return { sampler: new RasterTerrainSampler([adapter]), status }
}
