import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseTerrainObjectStore } from './supabaseTerrainObjectStore'
import { StoredTerrainTileValidator } from './terrainStorage'
import { hydrateTerrainRuntimeCatalogue } from './terrainRuntimeCatalogue'
import type { PersistedTerrainTileRow } from './terrainTilePersistence'

const TILE_SELECT = [
  'dataset_id', 'tile_key', 'min_lat', 'min_lon', 'max_lat', 'max_lon',
  'raster_width', 'raster_height', 'pixel_size_m', 'storage_bucket', 'storage_path',
  'raster_format', 'nodata_value', 'min_elevation_m', 'max_elevation_m',
  'checksum', 'status', 'metadata',
].join(',')

/**
 * Shared server-side persistence bridge for planetary terrain datasets.
 *
 * Only rows already marked `ready` in persistence are candidates, and each
 * candidate is revalidated against private object storage before becoming
 * runtime-visible. This deliberately keeps database metadata and object-store
 * integrity as separate gates.
 */
export async function loadPersistedTerrainRuntimeCatalogue(
  supabase: SupabaseClient,
  datasetId: string,
) {
  const { data, error } = await supabase
    .from('terrain_tiles')
    .select(TILE_SELECT)
    .eq('dataset_id', datasetId)
    .eq('status', 'ready')
    .order('pixel_size_m', { ascending: true })

  if (error) throw new Error(`Terrain tile query failed for ${datasetId}: ${error.message}`)

  const rows = (data ?? []) as unknown as PersistedTerrainTileRow[]
  const store = new SupabaseTerrainObjectStore(supabase)
  const validator = new StoredTerrainTileValidator(store)
  return hydrateTerrainRuntimeCatalogue(datasetId, rows, validator)
}
