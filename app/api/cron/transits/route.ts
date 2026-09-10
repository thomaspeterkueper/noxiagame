// app/api/cron/transits/route.ts
// Scheduler adapter only: finds due transits and delegates each completion to
// the idempotent transactional Game Core command.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { completeTransitCommand } from '@/lib/game/core/commands'
import { CRON_SECRET_HEADER } from '@/lib/game/config'

export async function GET(req: NextRequest) {
  const secret = req.headers.get(CRON_SECRET_HEADER)
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const completed: string[] = []
  const failed: string[] = []

  const { data: dueShips, error } = await supabase
    .from('ships')
    .select('id')
    .eq('status', 'transit')
    .lte('arrives_at', now)
    .order('arrives_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('Transit cron lookup failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const ship of dueShips ?? []) {
    try {
      const result = await completeTransitCommand(ship.id)
      if (result.completed) completed.push(ship.id)
    } catch (err) {
      console.error(`Transit ${ship.id} completion failed:`, err)
      failed.push(ship.id)
    }
  }

  return NextResponse.json({
    ok: true,
    tick: 'transits',
    due: dueShips?.length ?? 0,
    completed: completed.length,
    failed: failed.length,
  })
}
