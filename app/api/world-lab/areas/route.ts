// app/api/world-lab/areas/route.ts
// Friedhofsflächen für die Weltkarte nachholen (lib/worldlab/placeAreas.server.ts) –
// je Zelle (~450 × 420 m) einmal. POST { lat, lon } (angemeldet).
// Gescheiterte Zellen frühestens nach einer Stunde erneut.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { parcelCell } from '@/lib/worldlab/alkis'
import { fetchCemeteries, regionFor, storeCemeteries } from '@/lib/worldlab/placeAreas.server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { lat?: number; lon?: number }
  const point = { lat: Number(body.lat), lon: Number(body.lon) }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 85) return NextResponse.json({ error: 'lat/lon fehlt' }, { status: 400 })
  const cell = parcelCell(point)
  const supabase = createServiceClient()
  const { data: known } = await supabase.from('earth_area_cells').select('areas,error,fetched_at').eq('cell', cell.key).maybeSingle()
  if (known && (!known.error || Date.now() - Date.parse(known.fetched_at) < 3600_000)) return NextResponse.json({ ok: !known.error, cached: true, areas: known.areas })
  try {
    const regionId = await regionFor(supabase, point)
    if (!regionId) return NextResponse.json({ ok: true, cached: false, areas: 0, outside: true })
    const added = await storeCemeteries(supabase, regionId, await fetchCemeteries(cell))
    await supabase.from('earth_area_cells').upsert({ cell: cell.key, areas: added, error: null, fetched_at: new Date().toISOString() })
    return NextResponse.json({ ok: true, cached: false, areas: added })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[world-lab areas]', cell.key, message)
    await supabase.from('earth_area_cells').upsert({ cell: cell.key, areas: 0, error: message.slice(0, 500), fetched_at: new Date().toISOString() })
    return NextResponse.json({ ok: false, error: 'Kartendienst gerade nicht erreichbar.' })
  }
}
