import { strict as assert } from 'node:assert'
import { hydrateTerrainRuntimeCatalogue } from './terrainRuntimeCatalogue'
import type { PersistedTerrainTileRow } from './terrainTilePersistence'

const base: PersistedTerrainTileRow = {
  dataset_id: 'mars_mgs_mola_463m',
  tile_key: 'mars-tharsis-a',
  min_lat: 13,
  min_lon: -103,
  max_lat: 15,
  max_lon: -101,
  raster_width: 512,
  raster_height: 512,
  pixel_size_m: 463.0836,
  storage_bucket: 'terrain',
  storage_path: 'mars/mola/tharsis-a.tif',
  raster_format: 'geotiff',
  nodata_value: -32768,
  min_elevation_m: -5000,
  max_elevation_m: 12000,
  checksum: 'a'.repeat(64),
  status: 'ready',
  metadata: { byte_size: 4096 },
}

const validated: string[] = []
const runtime = await hydrateTerrainRuntimeCatalogue(
  'mars_mgs_mola_463m',
  [
    base,
    { ...base, tile_key: 'mars-tharsis-invalid', metadata: {} },
    { ...base, tile_key: 'mars-tharsis-pending', status: 'catalogued' },
    { ...base, dataset_id: 'moon_lro_lola_118m', tile_key: 'moon-other-dataset' },
  ],
  {
    async validate(manifest) {
      validated.push(manifest.tileKey)
    },
  },
)

assert.equal(runtime.status.datasetId, 'mars_mgs_mola_463m')
assert.equal(runtime.status.persistedReadyTiles, 2)
assert.equal(runtime.status.runtimeReadyTiles, 1)
assert.deepEqual(validated, ['mars-tharsis-a'])
assert.equal(runtime.status.rejectedTiles.length, 1)
assert.equal(runtime.status.rejectedTiles[0]?.tileKey, 'mars-tharsis-invalid')
assert.ok(runtime.status.rejectedTiles[0]?.details.includes('metadata.byte_size'))

const ready = runtime.catalogue.readyTileAt(
  { body: 'mars', latDeg: 14, lonDeg: -102, elevationM: 0 },
  'mars_mgs_mola_463m',
)
assert.equal(ready?.manifest.tileKey, 'mars-tharsis-a')

const checksumFailure = await hydrateTerrainRuntimeCatalogue(
  'mars_mgs_mola_463m',
  [base],
  {
    async validate() {
      throw new Error('checksum mismatch')
    },
  },
)
assert.equal(checksumFailure.status.persistedReadyTiles, 1)
assert.equal(checksumFailure.status.runtimeReadyTiles, 0)
assert.deepEqual(checksumFailure.status.rejectedTiles, [
  { tileKey: 'mars-tharsis-a', details: ['checksum mismatch'] },
])

console.log('terrain runtime catalogue contract ok')
