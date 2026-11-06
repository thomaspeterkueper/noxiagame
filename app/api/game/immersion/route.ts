// app/api/game/immersion/route.ts
// Erlebnis-Studio (immersion_studio): Angebote mit Preis, Sitzungen im Pod, gemeinsames Erleben (Thomas, 06.11.2026).
//
// GET  ?studio=<tile_entities.id>                         → Angebote (Preis je Person), offene Gruppen, eigene Sitzung, Credits
// POST { action: 'start', studio, experience, join? }     → Pod beziehen (join = Gruppenkennung: gemeinsam erleben)
// POST { action: 'end' }                                  → aufwachen
//
// Preis, Dauer und Rabatt rechnet der Server (lib/game/immersion.ts); gebucht wird in
// noxia_start_immersion (Migration 20261106110000). Nur spielbare Erlebnisse sind buchbar.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { CHRONOMAPS, experiencesAt } from '@/lib/worldlab/chronomaps'
import { IMMERSION_PARTY_MAX, immersionPrice, immersionSeconds } from '@/lib/game/immersion'

type Supabase = ReturnType<typeof createServiceClient>
const noStore = { 'Cache-Control': 'no-store' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function studio(supabase: Supabase, id: string) {
  if (!UUID.test(id)) return null
  const { data } = await supabase.from('tile_entities').select('id,display_name,latitude_deg,longitude_deg').eq('id', id).eq('entity_id', 'immersion_studio').eq('status', 'active').maybeSingle()
  return data ? { id: String(data.id), name: String(data.display_name ?? 'Erlebnis-Studio'), at: { lat: Number(data.latitude_deg), lon: Number(data.longitude_deg) } } : null
}

/** Offene Sitzungen im Studio, gruppiert nach Gruppe. */
async function openParties(supabase: Supabase, studioId: string) {
  const { data } = await supabase.from('immersion_sessions').select('profile_id,experience_id,category,party_id,ends_at').eq('studio_entity_id', studioId).is('ended_at', null).gt('ends_at', new Date().toISOString())
  const rows = data ?? []
  const names = new Map<string, string>()
  if (rows.length) {
    const { data: profiles } = await supabase.from('profiles').select('id,username').in('id', rows.map(row => row.profile_id))
    for (const profile of profiles ?? []) names.set(String(profile.id), String(profile.username ?? 'Gast'))
  }
  const parties = new Map<string, { partyId: string; experienceId: string; category: string; names: string[]; endsAt: string }>()
  for (const row of rows) {
    const key = String(row.party_id)
    const party = parties.get(key) ?? { partyId: key, experienceId: String(row.experience_id), category: String(row.category), names: [], endsAt: String(row.ends_at) }
    party.names.push(names.get(String(row.profile_id)) ?? 'Gast')
    if (row.ends_at < party.endsAt) party.endsAt = String(row.ends_at)
    parties.set(key, party)
  }
  return [...parties.values()].filter(party => party.names.length < IMMERSION_PARTY_MAX)
}

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const place = await studio(supabase, req.nextUrl.searchParams.get('studio') ?? '')
  if (!place) return NextResponse.json({ error: 'Dieses Studio gibt es nicht.' }, { status: 404 })
  const [parties, { data: wallet }, { data: mine }] = await Promise.all([
    openParties(supabase, place.id),
    supabase.from('profiles').select('credits,username').eq('id', profileId).maybeSingle(),
    supabase.from('immersion_sessions').select('*').eq('profile_id', profileId).is('ended_at', null).gt('ends_at', new Date().toISOString()).maybeSingle(),
  ])
  const offers = experiencesAt(place.at).map(map => ({
    id: map.id, title: map.title, era: map.era, category: map.category, playable: map.status === 'playable',
    price: immersionPrice(map.category), minutes: immersionSeconds(map.category) / 60,
    priceInGroup: { 2: immersionPrice(map.category, 2), 3: immersionPrice(map.category, 3) },
  }))
  return NextResponse.json({ ok: true, studio: place, offers, parties, session: mine ?? null, credits: Number(wallet?.credits ?? 0), me: { profileId, name: String(wallet?.username ?? 'Gast') } }, { headers: noStore })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { action?: string; studio?: string; experience?: string; join?: string }
  const supabase = createServiceClient()

  if (body.action === 'end') {
    const { data, error } = await supabase.rpc('noxia_end_immersion', { p_profile_id: profileId })
    if (error) return NextResponse.json({ error: 'Aufwachen nicht möglich.' }, { status: 500 })
    return NextResponse.json(data, { headers: noStore })
  }
  if (body.action !== 'start') return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })

  const place = await studio(supabase, String(body.studio ?? ''))
  if (!place) return NextResponse.json({ error: 'Dieses Studio gibt es nicht.' }, { status: 404 })
  const offered = experiencesAt(place.at).find(map => map.id === body.experience)
  if (!offered || !CHRONOMAPS.includes(offered)) return NextResponse.json({ error: 'Dieses Erlebnis gibt es hier nicht.' }, { status: 404 })
  if (offered.status !== 'playable') return NextResponse.json({ error: 'Dieses Erlebnis ist noch in Vorbereitung.' }, { status: 409 })

  let partyId: string | null = null
  let size = 1
  if (body.join) {
    if (!UUID.test(body.join)) return NextResponse.json({ error: 'Diese Gruppe gibt es nicht.' }, { status: 400 })
    const party = (await openParties(supabase, place.id)).find(item => item.partyId === body.join && item.experienceId === offered.id)
    if (!party) return NextResponse.json({ error: 'Diese Gruppe ist nicht mehr offen.' }, { status: 409 })
    partyId = party.partyId
    size = party.names.length + 1
  }
  const { data, error } = await supabase.rpc('noxia_start_immersion', {
    p_profile_id: profileId, p_studio_entity_id: place.id, p_experience_id: offered.id, p_category: offered.category,
    p_party_id: partyId, p_price: immersionPrice(offered.category, size), p_duration_seconds: immersionSeconds(offered.category), p_party_max: IMMERSION_PARTY_MAX,
  })
  if (error) {
    const message = error.message ?? ''
    const short = message.match(/NOXIA_IMMERSION_INSUFFICIENT:(\d+):(\d+)/)
    if (short) return NextResponse.json({ error: `Das kostet ${short[1]} Cr – nicht genug Credits (${short[2]} Cr).` }, { status: 400 })
    if (message.includes('NOXIA_IMMERSION_ALREADY_ACTIVE')) return NextResponse.json({ error: 'Du liegst bereits in einem Pod.' }, { status: 409 })
    if (message.includes('NOXIA_IMMERSION_PARTY_GONE')) return NextResponse.json({ error: 'Diese Gruppe ist nicht mehr offen.' }, { status: 409 })
    if (message.includes('NOXIA_IMMERSION_PARTY_FULL')) return NextResponse.json({ error: 'Die Gruppe ist voll.' }, { status: 409 })
    return NextResponse.json({ error: 'Buchung fehlgeschlagen.' }, { status: 500 })
  }
  return NextResponse.json(data, { headers: noStore })
}
