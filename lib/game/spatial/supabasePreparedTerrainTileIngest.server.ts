import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TerrainRasterTileManifest } from './terrainRaster'
import { ingestPreparedGeoTiffTile, type PreparedTerrainTileInput } from './preparedTerrainTileIngest'
import { SupabaseTerrainObjectStore } from './supabaseTerrainObjectStore'

function terrainTileRow(manifest: TerrainRasterTileManifest) {
  return {
    dataset_id: manifest.datasetId,
    tile_key: manifest.tileKey,
    min_lat: manifest.minLatDeg,
    min_lon: manifest.minLonDeg,
    max_lat: manifest.maxLatDeg,
    max_lon: manifest.maxLonDeg,
    raster_width: manifest.rasterWidth,
    raster_height: manifest.rasterHeight,
    pixel_size_m: manifest.pixelSizeM ?? null,
    storage_bucket: manifest.storageBucket,
    storage_path: manifest.storagePath,
    raster_format: manifest.rasterFormat,
    nodata_value: manifest.nodataValue ?? null,
    min_elevation_m: manifest.minElevationM ?? null,
    max_elevation_m: manifest.maxElevationM ?? null,
    checksum: manifest.checksum,
    status: 'ready',
    metadata: manifest.metadata ?? {},
  }
}

/**
 * Production persistence wrapper for a prepared terrain GeoTIFF.
 *
 * The object is uploaded and byte/checksum validated before the relational row
 * is upserted as ready. A database failure can therefore leave only an inert
 * orphan object; it cannot advertise a missing/corrupt raster to gameplay.
 */
export async function ingestPreparedTerrainTileToSupabase(
  supabase: SupabaseClient,
  input: PreparedTerrainTileInput,
) {
  const store = new SupabaseTerrainObjectStore(supabase)
  return ingestPreparedGeoTiffTile(store, {
    async markReady(manifest) {
      const { error } = await supabase
        .from('terrain_tiles')
        .upsert(terrainTileRow(manifest), { onConflict: 'dataset_id,tile_key' })
      if (error) throw new Error(`Terrain tile manifest persistence failed: ${error.message}`)
    },
  }, input)
}
