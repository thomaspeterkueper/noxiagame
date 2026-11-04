import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

export async function POST(req: NextRequest) {
  const adminId = await verifiedBearerUserId(req)
  if (!adminId) return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 401 })
  const db = createServiceClient()
  const { data: admin, error: authError } = await db.from('admin_profiles')
    .select('profile_id').eq('profile_id', adminId).maybeSingle()
  if (authError || !admin) return NextResponse.json({ error: 'Keine Adminberechtigung' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const playerId = String(body.playerId ?? '')
  const requestId = String(body.requestId ?? '')
  const amount = Number(body.amount)
  const reason = String(body.reason ?? '').trim()
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuid.test(playerId) || !uuid.test(requestId) || !Number.isSafeInteger(amount)
    || amount < 1 || amount > 5000 || reason.length < 5 || reason.length > 200) {
    return NextResponse.json({ error: 'Spieler, Vorgangs-ID, Betrag (1–5000) und Grund (5–200 Zeichen) erforderlich' }, { status: 400 })
  }
  if (playerId === adminId) return NextResponse.json({ error: 'Keine Selbstzuweisung' }, { status: 403 })
  const { data, error } = await db.rpc('noxia_admin_grant_credits', {
    p_admin: adminId,
    p_player: playerId,
    p_amount: amount,
    p_reason: reason,
    p_request_id: requestId,
  })
  if (error) return NextResponse.json({ error: 'Credit-Vergabe fehlgeschlagen; keine Teilbuchung vorgenommen' }, { status: 409 })
  return NextResponse.json({ ok: true, result: data }, { headers: { 'Cache-Control': 'private, no-store' } })
}
