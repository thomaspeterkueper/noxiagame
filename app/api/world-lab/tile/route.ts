// app/api/world-lab/tile/route.ts
// Prototyp „eine Welt“: liefert eine stark vereinfachte Kartenkachel.
// GET ?x=…&y=… (Kachelraster Stufe 17). Nur lesend, keine Spielwirkung.
//
// Die Antwort darf lange zwischengespeichert werden: Dieselbe Kachel sieht für
// alle gleich aus. Später werden die Kacheln einmal erzeugt und als Dateien
// abgelegt; dieser Abruf ist der Zwischenschritt dahin.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TILE_Z } from '@/lib/worldlab/mercator'
import { clearTileSourceCache, loadTile } from '@/lib/worldlab/tileSource.server'

export const revalidate = 0

// Nach einem Nachladen (/api/world-lab/refresh) schickt die Ansicht einen neuen
// Stempel mit; dann werden Regionen und Objekte einmal neu gelesen.
let freshStamp = ''

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const x = Number(params.get('x')), y = Number(params.get('y'))
  const max = 2 ** TILE_Z
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) {
    return NextResponse.json({ error: 'x und y müssen ganze Kachelnummern sein.' }, { status: 400 })
  }
  const fresh = params.get('fresh') ?? ''
  if (fresh && fresh !== freshStamp) { freshStamp = fresh; clearTileSourceCache() }
  const supabase = createServiceClient()
  return NextResponse.json(await loadTile(supabase, { x, y }), {
    // Nachgeladene Kacheln nicht am Rand zwischenspeichern; sonst eine Stunde lang.
    headers: { 'Cache-Control': fresh ? 'private, no-store, max-age=0' : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
