import { TerrainTileCatalogue, type TerrainTileValidator } from './terrainTileCatalogue'
import {
  resolvePersistedTerrainTileManifest,
  type PersistedTerrainTileRow,
} from './terrainTilePersistence'

export interface TerrainRuntimeCatalogueStatus {
  datasetId: string
  persistedReadyTiles: number
  runtimeReadyTiles: number
  rejectedTiles: Array<{ tileKey: string; details: string[] }>
}

export interface TerrainRuntimeCatalogue {
  catalogue: TerrainTileCatalogue
  status: TerrainRuntimeCatalogueStatus
}

/**
 * Rebuild a validated runtime terrain catalogue from persisted ready rows.
 *
 * The relational `terrain_tiles.status = ready` flag is not sufficient by itself:
 * every row is converted back into the strict runtime manifest and its referenced
 * object bytes/checksum are validated again through the injected validator before
 * gameplay can see the tile as runtime-ready.
 *
 * This function is body- and dataset-independent. Moon/LOLA, Mars/MOLA and later
 * planetary DEM families all share this lifecycle; source-specific raster and
 * vertical-datum semantics remain in their individual raster adapters.
 */
export async function hydrateTerrainRuntimeCatalogue(
  datasetId: string,
  rows: readonly PersistedTerrainTileRow[],
  validator: TerrainTileValidator,
): Promise<TerrainRuntimeCatalogue> {
  const catalogue = new TerrainTileCatalogue(validator)
  const rejectedTiles: Array<{ tileKey: string; details: string[] }> = []
  let persistedReadyTiles = 0

  for (const row of rows) {
    if (row.dataset_id !== datasetId || row.status !== 'ready') continue
    persistedReadyTiles += 1

    const resolution = resolvePersistedTerrainTileManifest(row)
    if (!resolution.ok) {
      rejectedTiles.push({ tileKey: row.tile_key, details: resolution.details })
      continue
    }

    try {
      catalogue.catalogue(resolution.manifest)
      const record = await catalogue.ingest(resolution.manifest.tileKey)
      if (record.state !== 'ready') {
        rejectedTiles.push({
          tileKey: resolution.manifest.tileKey,
          details: [record.error ?? `unexpected ingestion state ${record.state}`],
        })
      }
    } catch (error) {
      rejectedTiles.push({
        tileKey: resolution.manifest.tileKey,
        details: [error instanceof Error ? error.message : String(error)],
      })
    }
  }

  const runtimeReadyTiles = catalogue.snapshot().filter(tile => tile.state === 'ready').length
  return {
    catalogue,
    status: {
      datasetId,
      persistedReadyTiles,
      runtimeReadyTiles,
      rejectedTiles,
    },
  }
}
