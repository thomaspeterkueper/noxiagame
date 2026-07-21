// app/api/cron/npc/route.ts
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — NPC Phase C Cron
// Version:      1.0.0
//
// Führt pro Tick alle NPC-Entscheidungen aus:
//   1. Alle aktiven actors laden
//   2. Brain entscheidet (deterministisch)
//   3. runNpcTick schreibt in DB

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runNpcTick } from '@/lib/game/npcBrain'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Aktuellen Tick bestimmen
  const { data: lastTick } = await supabase
    .from('tick_log')
    .select('tick_number')
    .order('tick_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const tick = Number(lastTick?.tick_number ?? 0)

  // Alle aktiven NPC-Actors laden
  const { data: actors } = await supabase
    .from('actors')
    .select('id, display_name')
    .order('created_at')

  if (!actors || actors.length === 0) {
    return NextResponse.json({ ok: true, tick, actors: 0, results: [] })
  }

  // Alle NPCs parallel abarbeiten
  const results = await Promise.allSettled(
    actors.map(a => runNpcTick(supabase, a.id, tick))
  )

  const summary = results.map((r, i) => {
    if (r.status === 'fulfilled') {
      return {
        name:     r.value.name,
        aktionen: r.value.aktionen.length,
        errors:   r.value.errors,
      }
    }
    return { name: actors[i].display_name, aktionen: 0, errors: [String(r.reason)] }
  })

  console.log('[npc-cron] tick', tick, 'actors:', summary)
  return NextResponse.json({ ok: true, tick, actors: actors.length, results: summary })
}
