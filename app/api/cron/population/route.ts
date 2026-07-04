// route.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; Lazy-Tick-Fallback
// Version:      0.3.0
// app/api/cron/population/route.ts
// Fallback-Herzschlag der Lazy-Tick-Engine.
//
// Der eigentliche Herzschlag kommt aus der world-Route (vom Dashboard alle 30s
// gepollt). Dieser Cron rechnet nur nach, falls lange niemand online war.
// Ein vollständiger Tick (Population + Preise + Aufträge) lebt in
// lib/game/tick.ts; claim_due_ticks() schützt vor Doppelausführung.
// Läuft eh schon jemand, sind 0 Ticks fällig — harmlos.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { runDueTicks } from '@/lib/game/tick'

export async function GET(req: NextRequest) {
  if (req.headers.get(CRON_SECRET_HEADER) !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  const result = await runDueTicks(supabase)
  return NextResponse.json({ ok: true, ...result })
}
