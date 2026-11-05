// lib/worldlab/terrainSource.server.ts
// Gelände der Erdkarte: Höhenzellen lesen und (beim ersten Besuch oder im
// täglichen Lauf) einmal aus der Quelle holen. NOXIA-WORLD-0004.
//
// Quelle zunächst Open-Meteo (Copernicus DEM GLO-90, 90 m). Einzelfallprüfung
// 05.11.2026: Daten CC BY 4.0 bzw. Copernicus-Lizenz mit Quellenvermerk; der
// kostenlose Zugang ist für nicht-kommerzielle Nutzung (bis 10.000 Anfragen am
// Tag). Für später: amtliche Geländemodelle der Länder (z. B. DGM1 NRW) oder
// Copernicus direkt – beide hinter derselben Tabelle, die Karte merkt davon nichts.

import type { createServiceClient } from '@/lib/supabase/service'
import { openMeteoElevationSource } from '@/lib/world/spatial/openMeteoElevationSource'
import { TERRAIN_N, TERRAIN_Z, terrainCellOf, terrainLattice, tileTerrain, type TerrainCellId } from './terrain'
import type { TileId } from './mercator'

type Supabase = ReturnType<typeof createServiceClient>

export const TERRAIN_SOURCE = {
  source: 'open-meteo',
  dataset: 'Copernicus DEM 2021 GLO-90',
  license: 'Copernicus DEM © DLR e.V. 2010–2014 und © Airbus Defence and Space GmbH 2014–2018, bereitgestellt im Rahmen von COPERNICUS durch die Europäische Union und die ESA; Abruf über Open-Meteo (CC BY 4.0)',
}

/** Fehlversuch frühestens nach dieser Zeit wiederholen */
const RETRY_AFTER_MS = 24 * 60 * 60 * 1000
const CACHE_TTL_MS = 10 * 60_000
const cache = new Map<string, { at: number; heights: Promise<number[] | null> }>()

const cellKey = (cell: TerrainCellId) => cell.x + '/' + cell.y

async function readCell(supabase: Supabase, cell: TerrainCellId): Promise<number[] | null> {
  const { data, error } = await supabase.from('earth_terrain_cells').select('heights')
    .eq('z', TERRAIN_Z).eq('x', cell.x).eq('y', cell.y).maybeSingle()
  if (error || !data || !Array.isArray(data.heights)) return null
  return (data.heights as unknown[]).map(Number)
}

/** Eckhöhen einer Kartenkachel (9 × 9) oder null, wenn es für die Gegend noch kein Gelände gibt. */
export async function tileTerrainFor(supabase: Supabase, tile: TileId): Promise<number[] | null> {
  const cell = terrainCellOf(tile), key = cellKey(cell)
  const now = Date.now()
  let hit = cache.get(key)
  if (!hit || now - hit.at > CACHE_TTL_MS) {
    hit = { at: now, heights: readCell(supabase, cell).catch(() => null) }
    cache.set(key, hit)
    if (cache.size > 500) cache.delete(cache.keys().next().value as string)
  }
  const heights = await hit.heights
  return heights ? tileTerrain(heights, tile) : null
}

export function clearTerrainCache() { cache.clear() }

/**
 * Holt fehlende Höhenzellen einmal aus der Quelle und legt sie ab. Vorhandene
 * Zellen bleiben unberührt; gescheiterte werden frühestens nach einem Tag erneut versucht.
 */
export async function fillTerrainCells(supabase: Supabase, cells: TerrainCellId[], options: { limit: number; deadline: number }) {
  const result = { wanted: cells.length, present: 0, fetched: 0, failed: 0, skipped: 0, errors: [] as string[] }
  if (!cells.length) return result
  const unique = [...new Map(cells.map(cell => [cellKey(cell), cell])).values()]
  const present = new Set<string>(), missed = new Set<string>()
  const xs = unique.map(cell => cell.x), ys = unique.map(cell => cell.y)
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
  const [{ data: have, error: haveError }, { data: misses, error: missError }] = await Promise.all([
    supabase.from('earth_terrain_cells').select('x,y').eq('z', TERRAIN_Z).gte('x', box.x0).lte('x', box.x1).gte('y', box.y0).lte('y', box.y1).limit(5000),
    supabase.from('earth_terrain_misses').select('x,y,tried_at').eq('z', TERRAIN_Z).gte('x', box.x0).lte('x', box.x1).gte('y', box.y0).lte('y', box.y1).limit(5000),
  ])
  // Ohne lesbare Tabellen (z. B. Migration noch nicht angewendet) nichts abrufen.
  if (haveError || missError) { result.skipped = unique.length; result.errors.push((haveError ?? missError)!.message); return result }
  for (const row of have ?? []) present.add(row.x + '/' + row.y)
  for (const row of misses ?? []) if (Date.now() - new Date(String(row.tried_at)).getTime() < RETRY_AFTER_MS) missed.add(row.x + '/' + row.y)

  for (const cell of unique) {
    const key = cellKey(cell)
    if (present.has(key)) { result.present++; continue }
    if (missed.has(key) || result.fetched + result.failed >= options.limit || Date.now() > options.deadline) { result.skipped++; continue }
    try {
      const samples = await openMeteoElevationSource.sample(terrainLattice(cell))
      const heights = samples.map(sample => Math.round(sample.elevationM * 10) / 10)
      if (heights.length !== TERRAIN_N * TERRAIN_N || heights.some(h => !Number.isFinite(h))) throw new Error('unvollständige Höhen')
      const { error } = await supabase.from('earth_terrain_cells').upsert({ z: TERRAIN_Z, x: cell.x, y: cell.y, n: TERRAIN_N, heights, ...TERRAIN_SOURCE, fetched_at: new Date().toISOString() })
      if (error) throw new Error(error.message)
      await supabase.from('earth_terrain_misses').delete().eq('z', TERRAIN_Z).eq('x', cell.x).eq('y', cell.y)
      cache.delete(key)
      result.fetched++
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      result.failed++
      if (result.errors.length < 5) result.errors.push(message)
      await supabase.from('earth_terrain_misses').upsert({ z: TERRAIN_Z, x: cell.x, y: cell.y, error: message.slice(0, 300), tried_at: new Date().toISOString() })
    }
  }
  return result
}
