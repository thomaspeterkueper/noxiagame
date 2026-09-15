import { strict as assert } from 'node:assert'
import { TerrainTileCatalogue } from './terrainTileCatalogue'
import type { TerrainRasterTileManifest } from './terrainRaster'

const manifest = (
  datasetId: string,
  tileKey: string,
  pixelSizeM: number,
  minLonDeg = -110,
  maxLonDeg = -90,
): TerrainRasterTileManifest => ({
  datasetId,
  tileKey,
  minLatDeg: 10,
  minLonDeg,
  maxLatDeg: 20,
  maxLonDeg,
  rasterWidth: 100,
  rasterHeight: 100,
  pixelSizeM,
  storageBucket: 'terrain',
  storagePath: `${datasetId}/${tileKey}.tif`,
  rasterFormat: 'geotiff',
  checksum: 'a'.repeat(64),
  checksumAlgorithm: 'sha256',
  byteSize: 4096,
  status: 'catalogued',
})

const catalogue = new TerrainTileCatalogue({
  async validate(tile) {
    if (tile.tileKey === 'bad') throw new Error('checksum mismatch')
  },
})

catalogue.catalogue(manifest('mars_mgs_mola_463m', 'mola-coarse', 463))
catalogue.catalogue(manifest('mars_mgs_mola_463m', 'mola-fine', 200))
catalogue.catalogue(manifest('other_dataset', 'other-finer', 50))
catalogue.catalogue(manifest('mars_mgs_mola_463m', 'bad', 10))

assert.equal(catalogue.readyTileAt({ latDeg: 14, lonDeg: 258 }, 'mars_mgs_mola_463m'), null, 'pending coverage must stay unresolved')

await catalogue.ingest('mola-coarse')
await catalogue.ingest('mola-fine')
await catalogue.ingest('other-finer')
const invalid = await catalogue.ingest('bad')
assert.equal(invalid.state, 'invalid')
assert.equal(invalid.manifest.status, 'failed')

const selected = catalogue.readyTileAt({ latDeg: 14, lonDeg: 258 }, 'mars_mgs_mola_463m')
assert.ok(selected)
assert.equal(selected.manifest.tileKey, 'mola-fine', 'highest-resolution ready tile in the requested dataset must win')

const other = catalogue.readyTileAt({ latDeg: 14, lonDeg: -102 }, 'other_dataset')
assert.ok(other)
assert.equal(other.manifest.tileKey, 'other-finer', 'dataset filtering must prevent cross-dataset terrain substitution')

const missing = catalogue.readyTileAt({ latDeg: 25, lonDeg: -102 }, 'mars_mgs_mola_463m')
assert.equal(missing, null)

console.log('Terrain tile catalogue tests passed')
