// app/api/cron/world-tiles/route.ts
// Erdkarte, Aufgabe 3: Kacheln vorab erzeugen. Läuft stündlich (vercel.json).
//
// Rund um jedes NOXIA-Gebäude auf der Erde (5 × 5 Kacheln, ≈ 1 km) wird jede
// Kachel, die in world_tiles fehlt oder veraltet ist, gerechnet und abgelegt.
// Der erste Spieler, der dorthin kommt, bekommt sie dann sofort. Je Lauf höchstens
// BUILD_LIMIT neue Kacheln und höchstens TIME_BUDGET_MS, damit die Datenbank nicht
// überlastet wird; der Rest folgt im nächsten Lauf.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { geoToMerc, tileAt, type TileId } from '@/lib/worldlab/mercator'
import { loadBaseTile } from '@/lib/worldlab/tileSource.server'

export const maxDuration = 300

const RADIUS_TILES = 2
const BUILD_LIMIT = 60
const TIME_BUDGET_MS = 240_000

export async function GET(req: NextRequest) {
  if (req.headers.get(CRON_SECRET_HEADER) !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  const supabase = createServiceClient()
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  if (!earth) return NextResponse.json({ ok: true, tiles: 0 })
  const { data: buildings, error } = await supabase.from('tile_entities').select('latitude_deg,longitude_deg')
    .eq('location_id', earth.id).eq('entity_type', 'building').eq('status', 'active').not('latitude_deg', 'is', null).limit(2000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const wanted = new Map<string, TileId>()
  for (const row of buildings ?? []) {
    const centre = tileAt(geoToMerc({ lat: Number(row.latitude_deg), lon: Number(row.longitude_deg) }))
    for (let dy = -RADIUS_TILES; dy <= RADIUS_TILES; dy++) for (let dx = -RADIUS_TILES; dx <= RADIUS_TILES; dx++) {
      const tile = { x: centre.x + dx, y: centre.y + dy }
      wanted.set(tile.x + '/' + tile.y, tile)
    }
  }

  let stored = 0, built = 0, failed = 0, unchecked = 0
  for (const tile of wanted.values()) {
    if (built >= BUILD_LIMIT || Date.now() - started > TIME_BUDGET_MS) { unchecked++; continue }
    try {
      const result = await loadBaseTile(supabase, tile)
      if (result.origin === 'stored') stored++
      else built++
    } catch { failed++ }
  }
  const summary = { ok: true, tiles: wanted.size, stored, built, failed, unchecked, ms: Date.now() - started }
  console.log('[world-tiles]', JSON.stringify(summary))
  return NextResponse.json(summary)
}
