import { sha256Hex, StoredTerrainTileValidator, storeTerrainTile, type TerrainObjectStore } from './terrainStorage'
import type { TerrainRasterTileManifest } from './terrainRaster'
import { ingestPreparedGeoTiffTile } from './preparedTerrainTileIngest'

const GEOTIFF_FIXTURE = 'SUkqAAgAAAASAAABBAABAAAAAgAAAAEBBAABAAAAAgAAAAIBAwABAAAAEAAAAAMBAwABAAAAAQAAAAYBAwABAAAAAQAAAA4BAgASAAAA5gAAABEBBAABAAAAgAEAABUBAwABAAAAAQAAABYBBAABAAAAAgAAABcBBAABAAAACAAAABoBBQABAAAACAEAABsBBQABAAAAEAEAACgBAwABAAAAAQAAADEBAgAMAAAAGAEAAFMBAwABAAAAAgAAAA6DDAADAAAAJAEAAIKEDAAGAAAAPAEAAIGkAgAHAAAAbAEAAAAAAAB7InNoYXBlIjogWzIsIDJdfQAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAABAAAAAQAAAHRpZmZmaWxlLnB5AAAAAAAAAPA/AAAAAAAA8D8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwFnAAAAAAAAALkAAAAAAAAAAAC0zMjc2OAAAAAAAAAAAAAAAAAAAZADIACwBkAE='

async function main() {

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

const ingestObjects = new Map<string, Uint8Array>()
const ingestEvents: string[] = []
const ingestStore: TerrainObjectStore = {
  async read(bucket, path) {
    ingestEvents.push(`read:${bucket}/${path}`)
    const value = ingestObjects.get(`${bucket}/${path}`)
    if (!value) throw new Error('missing object')
    return value
  },
  async write(bucket, path, value) {
    ingestEvents.push(`write:${bucket}/${path}`)
    ingestObjects.set(`${bucket}/${path}`, Uint8Array.from(value))
  },
}

const prepared = await ingestPreparedGeoTiffTile(ingestStore, {
  async markReady(value) {
    ingestEvents.push(`ready:${value.tileKey}`)
  },
}, {
  datasetId: 'mars_mgs_mola_463m',
  tileKey: 'tharsis-fixture',
  bytes: Uint8Array.from(Buffer.from(GEOTIFF_FIXTURE, 'base64')),
  storagePath: 'mars/mola/tharsis-fixture.tif',
  pixelSizeM: 463.0836,
  sourceUri: 'pds://mgs/mola/meg128/megt44n180hb.img',
  sourceProduct: 'MGS MOLA MEGDR 128 px/deg',
})

assert(prepared.rasterWidth === 2 && prepared.rasterHeight === 2, 'prepared ingest must derive raster dimensions from GeoTIFF')
assert(prepared.minLonDeg === -103 && prepared.maxLonDeg === -101, 'prepared ingest must derive longitude bounds from GeoTIFF')
assert(prepared.minLatDeg === 13 && prepared.maxLatDeg === 15, 'prepared ingest must derive latitude bounds from GeoTIFF')
assert(prepared.nodataValue === -32768, 'prepared ingest must preserve GeoTIFF NoData')
assert(prepared.pixelSizeM === 463.0836, 'prepared ingest must preserve declared source resolution')
assert(prepared.metadata?.source_product === 'MGS MOLA MEGDR 128 px/deg', 'prepared ingest must preserve source-product provenance')
assert(prepared.metadata?.byte_size === prepared.byteSize, 'prepared ingest must persist object byte size in metadata')
assert(/^[a-f0-9]{64}$/.test(prepared.checksum), 'prepared ingest must derive SHA-256 checksum')
assert(ingestEvents.join('|') === [
  'write:terrain/mars/mola/tharsis-fixture.tif',
  'read:terrain/mars/mola/tharsis-fixture.tif',
  'ready:tharsis-fixture',
].join('|'), 'manifest must become ready only after stored bytes are re-read and validated')

console.log('terrain storage and prepared GeoTIFF ingest tests passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
