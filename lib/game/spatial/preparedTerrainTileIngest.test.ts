import { strict as assert } from 'node:assert'
import { ingestPreparedGeoTiffTile } from './preparedTerrainTileIngest'
import type { TerrainObjectStore } from './terrainStorage'

const FIXTURE = 'SUkqAAgAAAASAAABBAABAAAAAgAAAAEBBAABAAAAAgAAAAIBAwABAAAAEAAAAAMBAwABAAAAAQAAAAYBAwABAAAAAQAAAA4BAgASAAAA5gAAABEBBAABAAAAgAEAABUBAwABAAAAAQAAABYBBAABAAAAAgAAABcBBAABAAAACAAAABoBBQABAAAACAEAABsBBQABAAAAEAEAACgBAwABAAAAAQAAADEBAgAMAAAAGAEAAFMBAwABAAAAAgAAAA6DDAADAAAAJAEAAIKEDAAGAAAAPAEAAIGkAgAHAAAAbAEAAAAAAAB7InNoYXBlIjogWzIsIDJdfQAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAABAAAAAQAAAHRpZmZmaWxlLnB5AAAAAAAAAPA/AAAAAAAA8D8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwFnAAAAAAAAALkAAAAAAAAAAAC0zMjc2OAAAAAAAAAAAAAAAAAAAZADIACwBkAE='

class MemoryStore implements TerrainObjectStore {
  objects = new Map<string, Uint8Array>()
  events: string[] = []

  async read(bucket: string, path: string) {
    this.events.push(`read:${bucket}/${path}`)
    const value = this.objects.get(`${bucket}/${path}`)
    if (!value) throw new Error('missing object')
    return value
  }

  async write(bucket: string, path: string, bytes: Uint8Array) {
    this.events.push(`write:${bucket}/${path}`)
    this.objects.set(`${bucket}/${path}`, Uint8Array.from(bytes))
  }
}

async function main() {
  const store = new MemoryStore()
  let readyAtEvent = -1
  const manifest = await ingestPreparedGeoTiffTile(store, {
    async markReady(value) {
      readyAtEvent = store.events.length
      store.events.push(`ready:${value.tileKey}`)
    },
  }, {
    datasetId: 'mars_mgs_mola_463m',
    tileKey: 'tharsis-fixture',
    bytes: Uint8Array.from(Buffer.from(FIXTURE, 'base64')),
    storagePath: 'mars/mola/tharsis-fixture.tif',
    pixelSizeM: 463.0836,
    sourceUri: 'pds://mgs/mola/meg128/megt44n180hb.img',
    sourceProduct: 'MGS MOLA MEGDR 128 px/deg',
  })

  assert.equal(manifest.rasterWidth, 2)
  assert.equal(manifest.rasterHeight, 2)
  assert.equal(manifest.minLonDeg, -103)
  assert.equal(manifest.maxLonDeg, -101)
  assert.equal(manifest.minLatDeg, 13)
  assert.equal(manifest.maxLatDeg, 15)
  assert.equal(manifest.nodataValue, -32768)
  assert.equal(manifest.pixelSizeM, 463.0836)
  assert.equal(manifest.storageBucket, 'terrain')
  assert.equal(manifest.status, 'ready')
  assert.equal(manifest.metadata?.source_product, 'MGS MOLA MEGDR 128 px/deg')
  assert.equal(manifest.metadata?.byte_size, manifest.byteSize)
  assert.match(manifest.checksum, /^[a-f0-9]{64}$/)

  assert.deepEqual(store.events, [
    'write:terrain/mars/mola/tharsis-fixture.tif',
    'read:terrain/mars/mola/tharsis-fixture.tif',
    'ready:tharsis-fixture',
  ])
  assert.equal(readyAtEvent, 2, 'manifest must become ready only after persisted bytes are re-read and validated')

  console.log('prepared terrain GeoTIFF ingest contract ok')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
