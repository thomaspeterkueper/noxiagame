import { createHash } from 'node:crypto'
import type { TerrainRasterTileManifest } from './terrainRaster'

/**
 * Byte-level terrain storage boundary. Concrete object storage belongs behind
 * this interface so spatial/gameplay code never depends on a storage vendor.
 */
export interface TerrainObjectStore {
  read(bucket: string, path: string): Promise<Uint8Array>
  write(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void>
}

export function sha256Hex(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

export class StoredTerrainTileValidator {
  constructor(private readonly store: TerrainObjectStore) {}

  async validate(manifest: TerrainRasterTileManifest) {
    const bytes = await this.store.read(manifest.storageBucket, manifest.storagePath)
    if (bytes.byteLength !== manifest.byteSize) {
      throw new Error(`terrain tile byte size mismatch for ${manifest.tileKey}: expected ${manifest.byteSize}, got ${bytes.byteLength}`)
    }
    const checksum = sha256Hex(bytes)
    if (checksum.toLowerCase() !== manifest.checksum.toLowerCase()) {
      throw new Error(`terrain tile checksum mismatch for ${manifest.tileKey}`)
    }
  }
}

export async function storeTerrainTile(
  store: TerrainObjectStore,
  manifest: TerrainRasterTileManifest,
  bytes: Uint8Array,
) {
  const checksum = sha256Hex(bytes)
  if (bytes.byteLength !== manifest.byteSize) {
    throw new Error(`terrain tile byte size mismatch for ${manifest.tileKey}`)
  }
  if (checksum.toLowerCase() !== manifest.checksum.toLowerCase()) {
    throw new Error(`terrain tile checksum mismatch for ${manifest.tileKey}`)
  }

  const contentType = manifest.rasterFormat === 'geotiff' ? 'image/tiff' : 'application/octet-stream'
  await store.write(manifest.storageBucket, manifest.storagePath, bytes, contentType)
}
