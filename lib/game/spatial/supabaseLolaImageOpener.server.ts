// lib/game/spatial/supabaseLolaImageOpener.server.ts
// Erstellt: 16.09.2026
//
// Konkreter LolaRasterImageOpener: liest eine validierte, bereits im
// terrain-Bucket gespeicherte Kachel (terrain://bucket/path) und dekodiert
// sie mit geotiff.js. Bewusst getrennt von der raeumlichen Domainlogik
// (lolaTerrainAdapter.ts) -- genau das injizierbare Stueck, das dort als
// "TIFF decoding is injected deliberately" beschrieben ist.

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fromArrayBuffer } from 'geotiff'
import type { LolaRasterImage, LolaRasterImageOpener } from './lolaTerrainAdapter'
import { SupabaseTerrainObjectStore } from './supabaseTerrainObjectStore'

function parseTerrainUri(uri: string): { bucket: string; path: string } {
  const match = /^terrain:\/\/([^/]+)\/(.+)$/.exec(uri)
  if (!match) throw new Error(`Unerwartetes Terrain-URI-Format: ${uri}`)
  return { bucket: match[1], path: match[2] }
}

// Module-level on purpose: multiple terrain runtime/adaptor instances can be
// created during one warm Vercel process. A Site04 raster is ~41 MB, therefore
// reopening it for every sampler or every sample is prohibitively expensive.
// Promise caching also coalesces concurrent first readers into one download and
// one GeoTIFF decode. Failed opens are evicted so a later request can retry.
const imageCache = new Map<string, Promise<LolaRasterImage>>()
const MAX_CACHED_IMAGES = 4

function cacheImage(uri: string, loader: () => Promise<LolaRasterImage>) {
  const existing = imageCache.get(uri)
  if (existing) return existing

  const pending = loader().catch(error => {
    imageCache.delete(uri)
    throw error
  })
  imageCache.set(uri, pending)

  if (imageCache.size > MAX_CACHED_IMAGES) {
    const oldest = imageCache.keys().next().value as string | undefined
    if (oldest && oldest !== uri) imageCache.delete(oldest)
  }
  return pending
}

export function createSupabaseLolaImageOpener(supabase: SupabaseClient): LolaRasterImageOpener {
  const store = new SupabaseTerrainObjectStore(supabase)
  return async (uri: string): Promise<LolaRasterImage> => cacheImage(uri, async () => {
    const { bucket, path } = parseTerrainUri(uri)
    const bytes = await store.read(bucket, path)
    // TS2345: .buffer ist ArrayBufferLike (ArrayBuffer | SharedArrayBuffer),
    // fromArrayBuffer will strikt ArrayBuffer. Explizite Kopie erzwingt den
    // richtigen Typ und ist gleichzeitig robust gegen einen evtl. groesseren
    // zugrunde liegenden Buffer (byteOffset/length werden respektiert).
    const arrayBuffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(arrayBuffer).set(bytes)
    const tiff = await fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()
    return image as unknown as LolaRasterImage
  })
}
