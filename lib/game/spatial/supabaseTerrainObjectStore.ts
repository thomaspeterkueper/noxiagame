import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TerrainObjectStore } from './terrainStorage'

function storageError(action: string, error: { message?: string }) {
  return new Error(`${action}: ${error.message ?? 'unknown storage error'}`)
}

/**
 * Server-only implementation of the vendor-neutral TerrainObjectStore boundary.
 * The terrain bucket remains private; gameplay clients never receive raw DEM bytes.
 */
export class SupabaseTerrainObjectStore implements TerrainObjectStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async read(bucket: string, path: string): Promise<Uint8Array> {
    const { data, error } = await this.supabase.storage.from(bucket).download(path)
    if (error || !data) throw storageError(`terrain read ${bucket}/${path}`, error ?? {})
    return new Uint8Array(await data.arrayBuffer())
  }

  async write(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const body = bytes.slice().buffer
    const { error } = await this.supabase.storage.from(bucket).upload(path, body, {
      contentType,
      upsert: true,
    })
    if (error) throw storageError(`terrain write ${bucket}/${path}`, error)
  }
}
