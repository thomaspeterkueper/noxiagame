// Server-authoritative presence signals. Never trust user id or timestamps from clients.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

async function authorize(req: NextRequest) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return !error && user ? { supabase, userId: user.id } : null
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await auth.supabase.from('player_absence_presence')
    .select('mode,last_interaction_at,handoff_at,reason,revision')
    .eq('user_id', auth.userId).maybeSingle()
  if (error) return NextResponse.json({ error: 'presence unavailable' }, { status: 503 })
  return NextResponse.json({ presence: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const signal = body?.signal
  const sessionId = body?.sessionId
  if (!['resume', 'activity', 'logout', 'disconnect'].includes(signal)
      || typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) {
    return NextResponse.json({ error: 'invalid signal' }, { status: 400 })
  }
  const { data, error } = await auth.supabase.rpc('noxia_presence_signal', {
    p_user_id: auth.userId, p_session_id: sessionId, p_signal: signal,
  })
  if (error) {
    console.error('presence signal error', error.code)
    return NextResponse.json({ error: 'presence unavailable' }, { status: 503 })
  }
  return NextResponse.json({ presence: data }, { headers: { 'Cache-Control': 'no-store' } })
}
