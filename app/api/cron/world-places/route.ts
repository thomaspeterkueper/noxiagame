// app/api/cron/world-places/route.ts
// Erdkarte (Teilprojekt „eine Welt“, Aufgabe 11): holt gescheiterte Kartenabrufe
// nach. Läuft stündlich (vercel.json).
//
// Ein Ort, dessen Abruf scheiterte, bleibt als leere Zeile in `celestial_regions`
// stehen (Thomas, 13.10.2026: ein Hinweis, dass der Ort in die Karte gehört).
// Dieser Lauf versucht solche Orte erneut – je Lauf höchstens zwei, und jeden
// Ort frühestens drei Stunden nach dem letzten Versuch, damit die öffentlichen
// OpenStreetMap-Dienste nicht überlastet werden.
//
// Seit 28.10.2026 außerdem (lib/worldlab/worldPlaceQueue.ts): Orte, die nur mit
// dem Notprofil ankamen, werden mit dem vollen Profil nachgeholt (leere Orte
// zuerst), und benannte Orte bekommen eine Ortsdetail-Zelle an ihrer Mitte.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { getEarthRegion } from '@/lib/world/spatial/regions'
import { materializeEarthPlace } from '@/lib/world/spatial/earthPlaceMaterializer.server'
import { EARTH_LOCAL_DETAIL_SOURCE, enrichEarthLocalScene } from '@/lib/world/spatial/earthLocalEnrichment.server'
import { earthPlaceSlug } from '@/lib/world/spatial/earthPlaceIdentity'
import { DETAIL_RADIUS_KM } from '@/lib/worldlab/detailCells'
import { missingCenterCells, pickWorldPlaceTasks, worldPlaceTask, type WorldPlaceTask } from '@/lib/worldlab/worldPlaceQueue'

export const maxDuration = 300

const PER_RUN = 2
const RETRY_AFTER_MS = 3 * 60 * 60 * 1000

type Row = { id: string; slug: string; label: string | null; source: string | null; center_lat: number; center_lon: number; radius_km: number | null; source_checked_at: string | null }

export async function GET(req: NextRequest) {
  if (req.headers.get(CRON_SECRET_HEADER) !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()

  // Leere Orte: keine einzige Zeile in region_features.
  const { data: regions, error } = await supabase.from('celestial_regions')
    .select('id,slug,label,source,center_lat,center_lon,radius_km,source_checked_at')
    .eq('body', 'earth')
    .order('source_checked_at', { ascending: true, nullsFirst: true })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (regions ?? []) as Row[]

  // Ortsdetail-Zelle an der Mitte benannter Orte anlegen (leer – der Lauf füllt sie).
  const seeds = missingCenterCells(rows, earthPlaceSlug)
  if (seeds.length) {
    const { error: seedError } = await supabase.from('celestial_regions').upsert(seeds.map(cell => {
      const dLat = DETAIL_RADIUS_KM / 111.195, dLon = dLat / Math.max(0.05, Math.cos(cell.lat * Math.PI / 180))
      return {
        body: 'earth', slug: cell.slug, label: 'Lokaldetail ' + cell.lat.toFixed(5) + ', ' + cell.lon.toFixed(5),
        center_lat: cell.lat, center_lon: cell.lon, radius_km: DETAIL_RADIUS_KM,
        bounds: { south: cell.lat - dLat, north: cell.lat + dLat, west: cell.lon - dLon, east: cell.lon + dLon },
        source: EARTH_LOCAL_DETAIL_SOURCE, imported_at: null, source_checked_at: null,
      }
    }), { onConflict: 'slug', ignoreDuplicates: true })
    if (seedError) console.warn('[world-places] seed', seedError.message)
    else rows.unshift(...seeds.map(cell => ({ id: '', slug: cell.slug, label: null, source: EARTH_LOCAL_DETAIL_SOURCE, center_lat: cell.lat, center_lon: cell.lon, radius_km: DETAIL_RADIUS_KM, source_checked_at: null })))
  }

  const due = Date.now() - RETRY_AFTER_MS
  const tasks: Array<{ row: Row; task: WorldPlaceTask }> = []
  for (const row of rows) {
    if (tasks.filter(item => item.task === 'fill').length >= PER_RUN) break
    if (row.source_checked_at && new Date(row.source_checked_at).getTime() > due) continue
    if (!row.id) { tasks.push({ row, task: 'fill' }); continue }
    const { count } = await supabase.from('region_features').select('id', { count: 'exact', head: true }).eq('region_id', row.id)
    tasks.push({ row, task: worldPlaceTask(row, count ?? 0, due) })
  }
  const picked = pickWorldPlaceTasks(tasks, PER_RUN)
  const candidates = picked.map(item => item.row)

  const results: Array<{ slug: string; task: string; ok: boolean; total?: number; error?: string }> = []
  // Geduldiger Abruf (bis rund 100 s je Ort): einen weiteren Ort nur beginnen, wenn das Zeitbudget (300 s) reicht.
  const started = Date.now()
  for (const { row, task } of picked) {
    if (Date.now() - started > 150_000) break
    const lat = Number(row.center_lat), lon = Number(row.center_lon)
    try {
      const outcome = row.source === EARTH_LOCAL_DETAIL_SOURCE
        ? await enrichEarthLocalScene({ slug: row.slug, lat, lon, radiusKm: Number(row.radius_km ?? 0.5), patient: true })
        : await materializeEarthPlace({ slug: row.slug, label: getEarthRegion(row.slug)?.name ?? row.label ?? row.slug, lat, lon, radiusKm: Number(row.radius_km ?? 2.2), patient: true, refreshGeography: task === 'upgrade', requireFull: task === 'upgrade' })
      const o = outcome as { ok?: boolean; total?: number; refreshFailed?: boolean; source?: string }
      results.push({ slug: row.slug, task, ok: Boolean(o.ok) && !o.refreshFailed, total: o.total ?? 0 })
    } catch (reason) {
      results.push({ slug: row.slug, task, ok: false, error: reason instanceof Error ? reason.message : String(reason) })
    } finally {
      // Nächster Versuch frühestens nach RETRY_AFTER_MS – auch wenn dieser scheiterte.
      await supabase.from('celestial_regions').update({ source_checked_at: new Date().toISOString() }).eq('slug', row.slug)
    }
  }

  console.log('[world-places]', JSON.stringify(results))
  return NextResponse.json({ checked: candidates.length, results })
}
