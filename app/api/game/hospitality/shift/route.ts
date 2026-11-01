// app/api/game/hospitality/shift/route.ts
// Erstellt: 30.10.2026 — Spieler arbeiten bezahlt im Lokal (R-20)
// Thomas, 30.10.2026: „Geld gibt es nur, wenn auch die Aufgaben erfüllt wurden,
// sonst Abzüge … keine Folgeanstellung am selben Ort, wenn bei drei Schichten
// immer noch keine Aufgaben erledigt wurden … für Nichtstun gibt es kein Geld.“
// Regeln in der Datenbank (20261030090000_player_shifts_paid.sql), gespiegelt in
// lib/game/hospitality/playerShift.ts (shiftPay, shiftStanding).
// GET  ?tileEntityId=…                         → { open, wages, active, employer, standing, rules }
// POST { tileEntityId, action:'start', role, referral? } → { shiftId, startedAt, wagePerHour, gameHours }
// POST { tileEntityId, action:'task', shiftId, taskKey, kind, guest } → { tasks, tip }
// POST { tileEntityId, action:'end', shiftId } → { wage, full, deduction, tasks, required, credits, standing }

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ROLES = new Set(['door', 'bar', 'dj', 'service', 'reception', 'cleaning'])

const ERRORS: Record<string, { status: number; error: string }> = {
  NOXIA_SHIFT_VENUE_NOT_FOUND: { status: 404, error: 'Lokal nicht gefunden.' },
  NOXIA_SHIFT_ALREADY_ACTIVE: { status: 409, error: 'Du hast schon eine Schicht.' },
  NOXIA_SHIFT_BLOCKED: { status: 403, error: 'Hier wirst du nicht mehr eingestellt: drei Schichten ohne eine erledigte Aufgabe.' },
  NOXIA_SHIFT_COOLDOWN: { status: 409, error: 'Hier hattest du eben erst eine Schicht – die nächste gibt es später.' },
  NOXIA_SHIFT_ROLE_NOT_OPEN: { status: 409, error: 'Die Stelle ist gerade nicht frei.' },
  NOXIA_SHIFT_NOT_ACTIVE: { status: 409, error: 'Die Schicht ist schon vorbei.' },
  NOXIA_SHIFT_NOT_FOUND: { status: 404, error: 'Schicht nicht gefunden.' },
  NOXIA_SHIFT_TASK_INVALID: { status: 400, error: 'Diese Aufgabe zählt nicht.' },
  NOXIA_SHIFT_TASK_TOO_FAST: { status: 429, error: 'Langsam – eins nach dem anderen.' },
}

function fail(error: any) {
  const code = Object.keys(ERRORS).find(key => String(error?.message ?? '').includes(key))
  return code
    ? NextResponse.json({ error: ERRORS[code].error, code }, { status: ERRORS[code].status })
    : NextResponse.json({ error: 'Die Schicht konnte nicht gebucht werden.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tileEntityId = new URL(req.url).searchParams.get('tileEntityId') ?? ''
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'tileEntityId fehlt.' }, { status: 400 })
  const { data, error } = await createServiceClient().rpc('noxia_player_shift_state', { p_profile_id: profileId, p_tile_entity_id: tileEntityId })
  if (error) return fail(error)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const tileEntityId = String(body?.tileEntityId ?? '')
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'tileEntityId fehlt.' }, { status: 400 })
  const supabase = createServiceClient()
  const action = body?.action
  const shiftId = String(body?.shiftId ?? '')

  if (action === 'start') {
    const role = String(body?.role ?? '')
    if (!ROLES.has(role)) return NextResponse.json({ error: 'Unbekannte Stelle.' }, { status: 400 })
    const ref = body?.referral && typeof body.referral === 'object' ? body.referral as Record<string, unknown> : null
    const referral = ref ? { by: String(ref.by ?? '').slice(0, 60), issuedAt: String(ref.issuedAt ?? '').slice(0, 40) } : null
    const { data, error } = await supabase.rpc('noxia_start_player_shift', { p_profile_id: profileId, p_tile_entity_id: tileEntityId, p_role: role, p_referral: referral })
    return error ? fail(error) : NextResponse.json(data)
  }
  if (!UUID_RE.test(shiftId)) return NextResponse.json({ error: 'shiftId fehlt.' }, { status: 400 })
  if (action === 'task') {
    const { data, error } = await supabase.rpc('noxia_player_shift_task', {
      p_profile_id: profileId, p_shift_id: shiftId, p_task_key: String(body?.taskKey ?? '').slice(0, 120),
      p_kind: String(body?.kind ?? '').slice(0, 20), p_guest: Boolean(body?.guest),
    })
    return error ? fail(error) : NextResponse.json(data)
  }
  if (action === 'end') {
    const { data, error } = await supabase.rpc('noxia_end_player_shift', { p_profile_id: profileId, p_shift_id: shiftId })
    return error ? fail(error) : NextResponse.json(data)
  }
  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
}
