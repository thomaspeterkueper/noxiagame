import { sha256Hex, StoredTerrainTileValidator, storeTerrainTile, type TerrainObjectStore } from './terrainStorage'
import type { TerrainRasterTileManifest } from './terrainRaster'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const bytes = new TextEncoder().encode('noxia terrain fixture')
const checksum = sha256Hex(bytes)

const manifest: TerrainRasterTileManifest = {
  datasetId: 'moon_lro_lola_118m',
  tileKey: 'fixture-001',
  minLatDeg: -90,
  minLonDeg: 120,
  maxLatDeg: -89,
  maxLonDeg: 140,
  rasterWidth: 2,
  rasterHeight: 2,
  storageBucket: 'terrain',
  storagePath: 'moon/lola/fixture-001.tif',
  rasterFormat: 'geotiff',
  checksum,
  checksumAlgorithm: 'sha256',
  byteSize: bytes.byteLength,
  status: 'catalogued',
}

const objects = new Map<string, Uint8Array>()
let contentType = ''
const store: TerrainObjectStore = {
  async read(bucket, path) {
    const value = objects.get(`${bucket}/${path}`)
    if (!value) throw new Error('missing object')
    return value
  },
  async write(bucket, path, value, type) {
    objects.set(`${bucket}/${path}`, value)
    contentType = type
  },
}

await storeTerrainTile(store, manifest, bytes)
assert(contentType === 'image/tiff', 'GeoTIFF tiles must retain TIFF content type')
await new StoredTerrainTileValidator(store).validate(manifest)

let rejectedTamperedBytes = false
objects.set('terrain/moon/lola/fixture-001.tif', new TextEncoder().encode('tampered'))
try {
  await new StoredTerrainTileValidator(store).validate(manifest)
} catch {
  rejectedTamperedBytes = true
}
assert(rejectedTamperedBytes, 'checksum/size validation must reject modified stored bytes')

let rejectedWrongManifestChecksum = false
try {
  await storeTerrainTile(store, { ...manifest, checksum: '0'.repeat(64) }, bytes)
} catch {
  rejectedWrongManifestChecksum = true
}
assert(rejectedWrongManifestChecksum, 'upload must reject bytes that do not match manifest checksum')

console.log('terrain storage checksum tests passed')
