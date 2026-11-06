// app/api/game/credits/route.ts
// Erstellt: 04.11.2026 — Credits untereinander (Thomas: „generell Credits untereinander austauschen“)
// GET  → { credits, transfers: [{ at, direction, channel, amount, who, note, place }], known: [{ id, name }] }
// POST { channel: 'cash'|'bank', amount, toUsername? | toPersonId?, note?, place?, requestId }
//      → Spieler gibt bar (wen er trifft) oder überweist bei der Bank (Spieler oder Bewohner,
//        dessen Namen er kennt). Gebucht in noxia_player_give_credits (20261104190000_credit_transfers.sql).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { currentKnownName } from '@/lib/game/population/playerIdentityKnowledge'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ERRORS: Record<string, { status: number; error: string }> = {
  NOXIA_CREDITS_INSUFFICIENT: { status: 402, error: 'So viele Credits hast du nicht.' },
  NOXIA_TRANSFER_AMOUNT: { status: 400, error: 'Betrag zwischen 1 und 10 000 Cr.' },
  NOXIA_TRANSFER_RECIPIENT_UNKNOWN: { status: 404, error: 'Empfänger nicht gefunden.' },
  NOXIA_TRANSFER_SELF: { status: 400, error: 'An dich selbst geht das nicht.' },
  NOXIA_TRANSFER_NAME_UNKNOWN: { status: 403, error: 'Überweisen kannst du nur an jemanden, dessen Namen du kennst.' },
  NOXIA_TRANSFER_REQUEST_CONFLICT: { status: 409, error: 'Diese Überweisung gehört zu einem anderen Konto.' },
}

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const [{ data: profile }, { data: rows }, { data: known }] = await Promise.all([
    supabase.from('profiles').select('credits').eq('id', profileId).maybeSingle(),
    supabase.from('credit_transfers').select('created_at,channel,amount,note,place,from_profile_id,from_person_id,to_profile_id,to_person_id')
      .or(`from_profile_id.eq.${profileId},to_profile_id.eq.${profileId}`).order('created_at', { ascending: false }).limit(20),
    supabase.from('player_person_identity_knowledge').select('person_id,known_name,people(display_name)').eq('profile_id', profileId).eq('identity_state', 'known').limit(200),
  ])
  const nameOf = (row: any) => currentKnownName(row.known_name, (Array.isArray(row.people) ? row.people[0] : row.people)?.display_name) ?? ''
  const knownName = new Map((known ?? []).map((row: any) => [String(row.person_id), nameOf(row)]))
  const profileIds = [...new Set((rows ?? []).flatMap((r: any) => [r.from_profile_id, r.to_profile_id]).filter((id: any) => id && id !== profileId))]
  const { data: names } = profileIds.length ? await supabase.from('profiles').select('id,username').in('id', profileIds) : { data: [] as any[] }
  const username = new Map((names ?? []).map((row: any) => [String(row.id), String(row.username ?? 'ein Spieler')]))
  const transfers = (rows ?? []).map((r: any) => {
    const out = r.from_profile_id === profileId
    const otherProfile = out ? r.to_profile_id : r.from_profile_id
    const otherPerson = out ? r.to_person_id : r.from_person_id
    // Namen von Bewohnern nur, wenn der Spieler sie kennt (playerIdentityKnowledge).
    const who = otherProfile ? username.get(String(otherProfile)) ?? 'ein Spieler' : (otherPerson && knownName.get(String(otherPerson))) || 'jemand aus dem Ort'
    return { at: r.created_at, direction: out ? 'out' : 'in', channel: r.channel, amount: r.amount, who, note: r.note, place: r.place }
  })
  return NextResponse.json({ credits: Number(profile?.credits ?? 0), transfers, known: (known ?? []).filter((r: any) => nameOf(r)).map((r: any) => ({ id: String(r.person_id), name: nameOf(r) })) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const channel = body?.channel === 'bank' ? 'bank' : body?.channel === 'cash' ? 'cash' : null
  const amount = Math.round(Number(body?.amount))
  const requestId = String(body?.requestId ?? '')
  const toPersonId = body?.toPersonId ? String(body.toPersonId) : null
  const toUsername = body?.toUsername ? String(body.toUsername).trim().slice(0, 60) : null
  if (!channel || !Number.isFinite(amount) || !UUID_RE.test(requestId) || (!toPersonId && !toUsername) || (toPersonId && !UUID_RE.test(toPersonId))) {
    return NextResponse.json({ error: 'Angaben unvollständig.' }, { status: 400 })
  }
  // Bar an Spieler: seit 04.11.2026 sieht man andere Spieler im Raum (roomPresence) – die Tagesgrenze gilt wie bei Überweisungen.
  const { data, error } = await createServiceClient().rpc('noxia_player_give_credits', {
    p_profile_id: profileId, p_request_id: requestId, p_channel: channel, p_amount: amount,
    p_to_username: toPersonId ? null : toUsername, p_to_person_id: toPersonId,
    p_note: body?.note ? String(body.note).slice(0, 120) : null, p_place: body?.place ? String(body.place).slice(0, 80) : null,
  })
  if (error) {
    const message = String(error.message ?? '')
    const limit = message.match(/NOXIA_TRANSFER_DAILY_LIMIT:(\d+)/)
    if (limit) return NextResponse.json({ error: `An andere Spieler gehen höchstens 2000 Cr am Tag – heute noch ${limit[1]} Cr.` }, { status: 429 })
    const code = Object.keys(ERRORS).find(key => message.includes(key))
    return code ? NextResponse.json({ error: ERRORS[code].error, code }, { status: ERRORS[code].status }) : NextResponse.json({ error: 'Nicht gebucht.' }, { status: 500 })
  }
  return NextResponse.json(data)
}
