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

export function createSupabaseLolaImageOpener(supabase: SupabaseClient): LolaRasterImageOpener {
  const store = new SupabaseTerrainObjectStore(supabase)
  return async (uri: string): Promise<LolaRasterImage> => {
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
  }
}
