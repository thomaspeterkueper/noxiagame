// app/api/cron/world-terrain/route.ts
// Gelände der Erdkarte (NOXIA-WORLD-0004): täglicher Ergänzungslauf.
//
// Holt fehlende Höhenzellen (Stufe 15, 9 × 9 Punkte) einmal aus der Quelle,
// zuerst dort, wo das Spiel tatsächlich stattfindet:
//   1. wo Spieler in den letzten 14 Tagen auf der Erde unterwegs waren,
//   2. rund um NOXIA-Gebäude auf der Erde,
//   3. rund um benannte Orte (celestial_regions).
// Je Lauf höchstens CELL_LIMIT Zellen; der Rest folgt am nächsten Tag.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { geoToMerc, tileAt } from '@/lib/worldlab/mercator'
import { terrainCellOf, terrainCellsAround, type TerrainCellId } from '@/lib/worldlab/terrain'
import { fillTerrainCells } from '@/lib/worldlab/terrainSource.server'

export const maxDuration = 300

const CELL_LIMIT = 300
const TIME_BUDGET_MS = 240_000
const PLAYER_DAYS = 14

export async function GET(req: NextRequest) {
  if (req.headers.get(CRON_SECRET_HEADER) !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  const supabase = createServiceClient()
  const cells: TerrainCellId[] = []
  const around = (lat: number, lon: number, radius: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85) return
    cells.push(...terrainCellsAround(terrainCellOf(tileAt(geoToMerc({ lat, lon }))), radius))
  }

  // 1. Spielerpositionen (Bodenmeter, siehe earthPathPoint in lib/telemetry/activityRules.ts)
  const since = new Date(Date.now() - PLAYER_DAYS * 86_400_000).toISOString()
  const { data: positions } = await supabase.from('player_activity_log').select('data')
    .eq('kind', 'position').eq('location', 'earth').eq('target', 'earth').gte('created_at', since).limit(5000)
  const seen = new Set<string>()
  for (const row of positions ?? []) {
    const d = row.data as { x?: number; y?: number } | null
    const x = Number(d?.x), y = Number(d?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) continue
    const key = Math.round(x / 500) + '/' + Math.round(y / 500)
    if (seen.has(key)) continue
    seen.add(key)
    const lat = y / 110_574
    around(lat, x / (111_320 * Math.cos(lat * Math.PI / 180)), 2)
  }

  // 2. NOXIA-Gebäude auf der Erde
  const { data: earth } = await supabase.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  if (earth) {
    const { data: buildings } = await supabase.from('tile_entities').select('latitude_deg,longitude_deg')
      .eq('location_id', earth.id).eq('entity_type', 'building').eq('status', 'active').not('latitude_deg', 'is', null).limit(2000)
    for (const row of buildings ?? []) around(Number(row.latitude_deg), Number(row.longitude_deg), 1)
  }

  // 3. Benannte Orte
  const { data: regions } = await supabase.from('celestial_regions').select('center_lat,center_lon,source').eq('body', 'earth').limit(1000)
  for (const row of regions ?? []) if (row.source !== 'noxia:local-detail') around(Number(row.center_lat), Number(row.center_lon), 1)

  const result = await fillTerrainCells(supabase, cells, { limit: CELL_LIMIT, deadline: started + TIME_BUDGET_MS })
  const summary = { ok: true, ...result, ms: Date.now() - started }
  console.log('[world-terrain]', JSON.stringify(summary))
  return NextResponse.json(summary)
}
