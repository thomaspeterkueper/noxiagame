// app/api/cron/world-places/route.ts
// Erdkarte (Teilprojekt „eine Welt“, Aufgabe 11): holt gescheiterte Kartenabrufe
// nach. Läuft stündlich (vercel.json).
//
// Ein Ort, dessen Abruf scheiterte, bleibt als leere Zeile in `celestial_regions`
// stehen (Thomas, 13.10.2026: ein Hinweis, dass der Ort in die Karte gehört).
// Dieser Lauf versucht solche Orte erneut – je Lauf höchstens zwei, und jeden
// Ort frühestens drei Stunden nach dem letzten Versuch, damit die öffentlichen
// OpenStreetMap-Dienste nicht überlastet werden.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { getEarthRegion } from '@/lib/world/spatial/regions'
import { materializeEarthPlace } from '@/lib/world/spatial/earthPlaceMaterializer.server'
import { EARTH_LOCAL_DETAIL_SOURCE, enrichEarthLocalScene } from '@/lib/world/spatial/earthLocalEnrichment.server'

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

  const due = Date.now() - RETRY_AFTER_MS
  const candidates: Row[] = []
  for (const row of (regions ?? []) as Row[]) {
    if (candidates.length >= PER_RUN) break
    if (row.source_checked_at && new Date(row.source_checked_at).getTime() > due) continue
    const { count } = await supabase.from('region_features').select('id', { count: 'exact', head: true }).eq('region_id', row.id)
    if ((count ?? 0) === 0) candidates.push(row)
  }

  const results: Array<{ slug: string; ok: boolean; total?: number; error?: string }> = []
  // Geduldiger Abruf (bis rund 100 s je Ort): einen weiteren Ort nur beginnen, wenn das Zeitbudget (300 s) reicht.
  const started = Date.now()
  for (const row of candidates) {
    if (Date.now() - started > 150_000) break
    const lat = Number(row.center_lat), lon = Number(row.center_lon)
    try {
      const outcome = row.source === EARTH_LOCAL_DETAIL_SOURCE
        ? await enrichEarthLocalScene({ slug: row.slug, lat, lon, radiusKm: Number(row.radius_km ?? 0.5), patient: true })
        : await materializeEarthPlace({ slug: row.slug, label: getEarthRegion(row.slug)?.name ?? row.label ?? row.slug, lat, lon, radiusKm: Number(row.radius_km ?? 2.2), patient: true })
      results.push({ slug: row.slug, ok: Boolean((outcome as { ok?: boolean }).ok), total: (outcome as { total?: number }).total ?? 0 })
    } catch (reason) {
      results.push({ slug: row.slug, ok: false, error: reason instanceof Error ? reason.message : String(reason) })
    } finally {
      // Nächster Versuch frühestens nach RETRY_AFTER_MS – auch wenn dieser scheiterte.
      await supabase.from('celestial_regions').update({ source_checked_at: new Date().toISOString() }).eq('id', row.id)
    }
  }

  console.log('[world-places]', JSON.stringify(results))
  return NextResponse.json({ checked: candidates.length, results })
}
