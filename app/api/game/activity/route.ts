// app/api/game/activity/route.ts
// Erstellt:     28.10.2026
// Aktualisiert: 28.10.2026 — Annahme der Verhaltensaufzeichnung der Testphase (player_activity_log)
// Version:      1.0.0
//
// Nimmt gebündelte Ereignisse aus lib/telemetry/playerActivity.ts an. Nur
// angemeldete Spieler; Grenzen wie im Client (activityRules). Fehler hier
// werden geschluckt – die Aufzeichnung darf das Spiel nie stören.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cleanLabel, isActivityKind, MAX_EVENTS_PER_BATCH } from '@/lib/telemetry/activityRules'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

const MAX_DATA_CHARS = 600
const CLOCK_SKEW_MS = 10 * 60_000

function cleanData(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 12)) {
    const k = cleanLabel(key, 24)
    if (!k) continue
    if (typeof raw === 'number') out[k] = Number.isFinite(raw) ? raw : null
    else if (typeof raw === 'boolean' || raw === null) out[k] = raw
    else if (typeof raw === 'string') out[k] = cleanLabel(raw, 120)
  }
  return JSON.stringify(out).length <= MAX_DATA_CHARS ? out : null
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: { user } } = await serviceClient.auth.getUser(authHeader.slice(7))
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sessionId = cleanLabel(body?.sessionId, 40) || 'unknown'
  const events: unknown[] = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS_PER_BATCH) : []
  const now = Date.now()

  const rows = events.flatMap((item: unknown) => {
    const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    if (!isActivityKind(raw.kind)) return []
    const at = Date.parse(String(raw.at ?? ''))
    const occurredAt = Number.isFinite(at) && Math.abs(at - now) <= CLOCK_SKEW_MS ? new Date(at) : new Date(now)
    return [{
      player_profile_id: user.id,
      session_id: sessionId,
      occurred_at: occurredAt.toISOString(),
      kind: raw.kind,
      path: cleanLabel(raw.path, 120) || null,
      location: cleanLabel(raw.location, 60) || null,
      mode: cleanLabel(raw.mode, 30) || null,
      target: cleanLabel(raw.target, 160) || null,
      data: cleanData(raw.data),
    }]
  })

  if (rows.length) {
    const { error } = await serviceClient.from('player_activity_log').insert(rows)
    if (error) {
      console.error('player activity insert failed', { code: error.code })
      return NextResponse.json({ ok: false }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true, stored: rows.length })
}
