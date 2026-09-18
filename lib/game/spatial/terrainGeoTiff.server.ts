import 'server-only'

import { fromArrayBuffer } from 'geotiff'
import type { TerrainObjectStore } from './terrainStorage'

export interface TerrainGeoTiffImage {
  getWidth(): number
  getHeight(): number
  getBoundingBox(): [number, number, number, number]
  getGDALNoData?(): number | string | null
  readRasters(options: {
    window: [number, number, number, number]
    samples: number[]
    interleave: true
  }): Promise<ArrayLike<number>>
}

export type TerrainGeoTiffImageOpener = (uri: string) => Promise<TerrainGeoTiffImage>

export interface TerrainStorageLocation {
  bucket: string
  path: string
}

export function parseTerrainStorageUri(uri: string): TerrainStorageLocation {
  let parsed: URL
  try {
    parsed = new URL(uri)
  } catch {
    throw new Error(`Invalid terrain storage URI: ${uri}`)
  }
  if (parsed.protocol !== 'terrain:' || !parsed.hostname) {
    throw new Error(`Unsupported terrain storage URI: ${uri}`)
  }
  const path = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  if (!path) throw new Error(`Terrain storage URI has no object path: ${uri}`)
  return { bucket: parsed.hostname, path }
}

/**
 * Decode a validated cached GeoTIFF directly from the vendor-neutral terrain
 * object store. This opener intentionally accepts only `terrain://` URIs: remote
 * HTTP DEM access is an ingestion concern, never a gameplay-runtime fallback.
 */
export function createTerrainGeoTiffOpener(store: TerrainObjectStore): TerrainGeoTiffImageOpener {
  return async uri => {
    const location = parseTerrainStorageUri(uri)
    const bytes = await store.read(location.bucket, location.path)
    const arrayBuffer = Uint8Array.from(bytes).buffer
    const tiff = await fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()

    return {
      getWidth: () => image.getWidth(),
      getHeight: () => image.getHeight(),
      getBoundingBox: () => image.getBoundingBox() as [number, number, number, number],
      getGDALNoData: () => image.getGDALNoData(),
      readRasters: async options => image.readRasters(options) as Promise<ArrayLike<number>>,
    }
  }
}
