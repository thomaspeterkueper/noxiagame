// Independent authoritative timeout check: survives closed tabs and disconnected clients.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get(CRON_SECRET_HEADER) !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { data, error } = await createServiceClient().rpc('noxia_advance_presence')
  if (error) {
    console.error('presence tick failed', error.code)
    return NextResponse.json({ error: 'presence tick failed' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, ...data?.[0] })
}
