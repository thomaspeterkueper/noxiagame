// app/api/world-lab/refresh/route.ts
// Prototyp „eine Welt“: holt für einen Ort fehlende oder veraltete Kartendaten
// aus OpenStreetMap nach. POST { lat, lon } mit Anmeldung (Bearer).
//
// Zwei Schritte, beide über die bestehenden Importwege des Spiels:
//   1. Regionen, die den Ort umfassen und mit einem älteren Importprofil
//      geschrieben wurden, neu aufbauen (z. B. Sportflächen seit Profil 4).
//   2. Ortsdetail (Gebäude, Wohnstraßen, Wege) für die feste Zelle um den Ort
//      holen, falls es dort noch keins gibt.
// Bestehende Daten bleiben stehen, wenn ein Abruf scheitert.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { earthPlaceSlug } from '@/lib/world/spatial/earthPlaceIdentity'
import { getEarthRegion } from '@/lib/world/spatial/regions'
import { EARTH_GEOGRAPHY_IMPORT_VERSION, materializeEarthPlace } from '@/lib/world/spatial/earthPlaceMaterializer.server'
import { EARTH_LOCAL_DETAIL_SOURCE, enrichEarthLocalScene } from '@/lib/world/spatial/earthLocalEnrichment.server'
import { DETAIL_RADIUS_KM, detailCell, groundDistanceM } from '@/lib/worldlab/detailCells'

export const maxDuration = 120

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }
/** Zeitbudget: Vercel bricht nach 120 s ab und schickt dann eine Textseite statt JSON. */
const BUDGET_MS = 95_000
const TIMED_OUT = Symbol('timeout')
function withinBudget<T>(promise: Promise<T>, started: number): Promise<T | typeof TIMED_OUT> {
  const left = Math.max(1000, BUDGET_MS - (Date.now() - started))
  return Promise.race([promise, new Promise<typeof TIMED_OUT>(resolve => setTimeout(() => resolve(TIMED_OUT), left))])
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(auth.slice(7))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })

  let body: { lat?: number; lon?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400, headers: noStore }) }
  const point = { lat: Number(body.lat), lon: Number(body.lon) }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 85 || Math.abs(point.lon) > 180) {
    return NextResponse.json({ error: 'Breite und Länge erforderlich' }, { status: 400, headers: noStore })
  }

  // 1. Veraltete Regionen mit eigener Geographie, die den Ort umfassen.
  const { data: rows, error } = await supabase.from('celestial_regions')
    .select('slug,label,center_lat,center_lon,radius_km,geography_import_version,source')
    .eq('body', 'earth').gte('geography_import_version', 1).lt('geography_import_version', EARTH_GEOGRAPHY_IMPORT_VERSION)
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: noStore })
  const outdated = (rows ?? []).filter(row => row.source !== EARTH_LOCAL_DETAIL_SOURCE
    && groundDistanceM(point, { lat: Number(row.center_lat), lon: Number(row.center_lon) }) <= Number(row.radius_km ?? 0) * 1000)

  const cell = detailCell(point)
  const started = Date.now()
  const [regions, detail] = await Promise.all([
    Promise.allSettled(outdated.map(row => withinBudget((() => {
      const configured = getEarthRegion(String(row.slug))
      return materializeEarthPlace({
        slug: String(row.slug),
        label: configured?.name ?? String(row.label ?? row.slug),
        lat: Number(row.center_lat),
        lon: Number(row.center_lon),
        radiusKm: Number(row.radius_km ?? 2.2),
      })
    })(), started).then(value => { if (value === TIMED_OUT) throw new Error('Zeitüberschreitung'); return value }))),
    withinBudget(enrichEarthLocalScene({ slug: earthPlaceSlug(cell), lat: cell.lat, lon: cell.lon, radiusKm: DETAIL_RADIUS_KM }), started)
      .then(result => result === TIMED_OUT ? { ok: false as const, error: 'Zeitüberschreitung' } : { ok: true as const, result }, (reason: unknown) => ({ ok: false as const, error: reason instanceof Error ? reason.message : String(reason) })),
  ])

  return NextResponse.json({
    regions: regions.map((outcome, index) => ({
      slug: outdated[index].slug,
      ok: outcome.status === 'fulfilled' && Boolean((outcome.value as { ok?: boolean }).ok),
      error: outcome.status === 'rejected' ? String((outcome.reason as Error)?.message ?? outcome.reason) : undefined,
    })),
    detail: { cell, ...(detail.ok ? { ok: true, cached: Boolean((detail.result as { cached?: boolean }).cached), total: (detail.result as { total?: number }).total ?? 0 } : { ok: false, error: detail.error }) },
  }, { headers: noStore })
}
