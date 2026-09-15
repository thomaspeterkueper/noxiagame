import { strict as assert } from 'node:assert'
import { resolvePersistedTerrainTileManifest, type PersistedTerrainTileRow } from './terrainTilePersistence'

const base: PersistedTerrainTileRow = {
  dataset_id: 'moon_lro_lola_118m',
  tile_key: 'shackleton-demo',
  min_lat: -90,
  min_lon: 0,
  max_lat: -88,
  max_lon: 2,
  raster_width: 512,
  raster_height: 512,
  pixel_size_m: 118.4505876,
  storage_bucket: 'terrain',
  storage_path: 'moon/lola/shackleton-demo.tif',
  raster_format: 'geotiff',
  nodata_value: -32768,
  min_elevation_m: -9000,
  max_elevation_m: 3000,
  checksum: 'a'.repeat(64),
  status: 'ready',
  metadata: { byte_size: 4096 },
}

{
  const resolution = resolvePersistedTerrainTileManifest(base)
  assert.equal(resolution.ok, true)
  if (resolution.ok) {
    assert.equal(resolution.manifest.byteSize, 4096)
    assert.equal(resolution.manifest.checksumAlgorithm, 'sha256')
    assert.equal(resolution.manifest.storageBucket, 'terrain')
  }
}

{
  const resolution = resolvePersistedTerrainTileManifest({
    ...base,
    metadata: {},
  })
  assert.equal(resolution.ok, false)
  if (!resolution.ok) assert.deepEqual(resolution.details, ['metadata.byte_size'])
}

{
  const resolution = resolvePersistedTerrainTileManifest({
    ...base,
    storage_path: null,
    checksum: 'not-a-checksum',
  })
  assert.equal(resolution.ok, false)
  if (!resolution.ok) {
    assert.ok(resolution.details.includes('storage_path'))
    assert.ok(resolution.details.includes('checksum'))
  }
}

console.log('terrainTilePersistence contract ok')
