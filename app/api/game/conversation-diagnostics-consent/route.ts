import { NextRequest, NextResponse } from 'next/server'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(req: NextRequest) {
  const id = await verifiedBearerUserId(req)
  if (!id) return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 401 })
  const { data, error } = await createServiceClient()
    .from('player_conversation_diagnostic_consent')
    .select('enabled,granted_at,revoked_at').eq('profile_id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Einstellung nicht verfügbar' }, { status: 503 })
  return NextResponse.json({ enabled: data?.enabled === true, granted_at: data?.granted_at ?? null }, { headers })
}

export async function POST(req: NextRequest) {
  const id = await verifiedBearerUserId(req)
  if (!id) return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'Ungültiger Wert' }, { status: 400 })
  const db = createServiceClient()
  const { data: current, error: readError } = await db
    .from('player_conversation_diagnostic_consent').select('enabled,granted_at')
    .eq('profile_id',id).maybeSingle()
  if (readError) return NextResponse.json({ error: 'Einstellung nicht verfügbar' }, { status: 503 })
  const now = new Date().toISOString()
  const data = {
    profile_id: id, enabled: body.enabled,
    // Repeated grant does not shift the lower bound. Revocation and re-grant does.
    granted_at: body.enabled ? (current?.enabled ? current.granted_at : now) : null,
    revoked_at: body.enabled ? null : now,
    updated_at: now,
  }
  const { error } = await db.from('player_conversation_diagnostic_consent').upsert(data, { onConflict: 'profile_id' })
  if (error) return NextResponse.json({ error: 'Änderung nicht gespeichert' }, { status: 503 })
  return NextResponse.json({ enabled: body.enabled, granted_at: data.granted_at }, { headers })
}
