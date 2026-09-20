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
    // BUGFIX 16.09.2026: upload(..., {upsert:true}) allein fuehrte bei einer
    // erneuten Ingestion mit gleichem Pfad zu einem Read-after-Write-
    // Konsistenzproblem -- die direkt anschliessende Verifizierung las noch
    // den alten Inhalt zurueck. Objekt daher zuerst explizit entfernen
    // (Fehlschlag ignorieren, falls es noch nicht existiert), dann frisch
    // hochladen.
    await this.supabase.storage.from(bucket).remove([path]).catch(() => {})
    const { error } = await this.supabase.storage.from(bucket).upload(path, body, {
      contentType,
      upsert: true,
    })
    if (error) throw storageError(`terrain write ${bucket}/${path}`, error)
  }
}
