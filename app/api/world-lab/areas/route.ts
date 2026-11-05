// app/api/world-lab/areas/route.ts
// Friedhofsflächen für die Weltkarte nachholen (lib/worldlab/placeAreas.server.ts) –
// je Zelle (~450 × 420 m) einmal. POST { lat, lon } (angemeldet).
// Gescheiterte Zellen frühestens nach einer Stunde erneut.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { parcelCell } from '@/lib/worldlab/alkis'
import { fetchCemeteries, importCemeteryCell } from '@/lib/worldlab/placeAreas.server'

export const maxDuration = 60

/** GET ?lat=…&lon=…&dry=1: nur abfragen, nichts speichern – zur Prüfung, welche Friedhöfe OSM dort kennt. */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat')), lon = Number(req.nextUrl.searchParams.get('lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || req.nextUrl.searchParams.get('dry') !== '1') return NextResponse.json({ error: 'lat, lon und dry=1' }, { status: 400 })
  const cell = parcelCell({ lat, lon })
  try {
    const rows = await fetchCemeteries(cell)
    return NextResponse.json({ cell, cemeteries: rows.map(row => ({ id: row.properties.noxia_source_id, name: (row.properties as { name?: string }).name ?? null, points: row.geometry.coordinates.length, first: row.geometry.coordinates[0] })) })
  } catch (error) { return NextResponse.json({ cell, error: error instanceof Error ? error.message : String(error) }) }
}

export async function POST(req: NextRequest) {
  if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { lat?: number; lon?: number }
  const point = { lat: Number(body.lat), lon: Number(body.lon) }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 85) return NextResponse.json({ error: 'lat/lon fehlt' }, { status: 400 })
  const cell = parcelCell(point)
  const supabase = createServiceClient()
  const { data: known } = await supabase.from('earth_area_cells').select('areas,error,fetched_at').eq('cell', cell.key).maybeSingle()
  if (known && (!known.error || Date.now() - Date.parse(known.fetched_at) < 3600_000)) return NextResponse.json({ ok: !known.error, cached: true, areas: known.areas })
  const result = await importCemeteryCell(supabase, cell, point)
  if (!result.ok) { console.error('[world-lab areas]', cell.key, result.error); return NextResponse.json({ ok: false, error: 'Kartendienst gerade nicht erreichbar.' }) }
  return NextResponse.json({ ok: true, cached: false, areas: result.added })
}
