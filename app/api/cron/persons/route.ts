// app/api/cron/persons/route.ts
// Named-person simulation heartbeat. Deterministic; no LLM decisions.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'
import { loadColonyPressures } from '@/lib/game/colonyPressure'
import { runPersonTick } from '@/lib/game/personBrain'

export async function GET(req: NextRequest) {
  if (req.headers.get(CRON_SECRET_HEADER) !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: tickRow } = await supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle()
  const tick = Number(tickRow?.tick_number ?? 0)
  const pressures = await loadColonyPressures(supabase)
  const result = await runPersonTick(supabase, tick, pressures)

  return NextResponse.json({ ok: true, tick, locationsWithPressure: pressures.size, ...result })
}
