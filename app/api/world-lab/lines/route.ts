// app/api/world-lab/lines/route.ts
// Genaue Hauptstraßen, Kreisverkehre und Gleise für die Weltkarte holen
// (lib/worldlab/lineDetails.server.ts) – je Zelle (~450 × 420 m) einmal.
// POST { lat, lon } (angemeldet). Gescheiterte Zellen frühestens nach einer Stunde erneut.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { parcelCell } from '@/lib/worldlab/alkis'
import { fetchLineDetails } from '@/lib/worldlab/lineDetails.server'
import { clearTileSourceCache } from '@/lib/worldlab/tileSource.server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { lat?: number; lon?: number }
  const point = { lat: Number(body.lat), lon: Number(body.lon) }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 85) return NextResponse.json({ error: 'lat/lon fehlt' }, { status: 400 })
  const cell = parcelCell(point)
  const supabase = createServiceClient()
  const { data: known } = await supabase.from('earth_line_cells').select('lines,error,fetched_at').eq('cell', cell.key).maybeSingle()
  if (known && (!known.error || Date.now() - Date.parse(known.fetched_at) < 3600_000)) return NextResponse.json({ ok: !known.error, cached: true, lines: known.lines })
  try {
    const rows = await fetchLineDetails(cell)
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from('earth_line_details').upsert(rows.slice(i, i + 200), { onConflict: 'id' })
      if (error) throw error
    }
    await supabase.from('earth_line_cells').upsert({ cell: cell.key, lines: rows.length, error: null, fetched_at: new Date().toISOString() })
    clearTileSourceCache()
    return NextResponse.json({ ok: true, cached: false, lines: rows.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[world-lab lines]', cell.key, message)
    await supabase.from('earth_line_cells').upsert({ cell: cell.key, lines: 0, error: message.slice(0, 500), fetched_at: new Date().toISOString() })
    return NextResponse.json({ ok: false, error: 'Kartendienst gerade nicht erreichbar.' })
  }
}
