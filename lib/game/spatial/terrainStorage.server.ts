import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { TerrainObjectStore } from './terrainStorage'

export class SupabaseTerrainObjectStore implements TerrainObjectStore {
  async read(bucket: string, path: string): Promise<Uint8Array> {
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage.from(bucket).download(path)
    if (error) throw new Error(`terrain storage read failed: ${error.message}`)
    if (!data) throw new Error(`terrain storage read returned no data for ${bucket}/${path}`)
    return new Uint8Array(await data.arrayBuffer())
  }

  async write(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const supabase = createServiceClient()
    const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType,
      upsert: true,
    })
    if (error) throw new Error(`terrain storage write failed: ${error.message}`)
  }
}
