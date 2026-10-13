// app/api/game/hospitality/guests/route.ts
// GET ?tileEntityId=… → wer in der letzten Stunde in diesem Lokal gekauft hat.
// Quelle sind die echten Käufe der Bewohner (person_consumption_events); es
// wird nichts erfunden und nichts geschrieben. Namen folgen dem, was der
// Spieler über die Person weiß.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { perceivedIdentityState, perceivedPersonLabel } from '@/lib/game/population/playerIdentityKnowledge'
import { appearanceFromRow, observableDescriptionFromAppearance } from '@/lib/game/population/personAppearance'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab0-9a-f]{12}$/i
const WINDOW_S = 60 * 60
const SERVICE_LABEL: Record<string, string> = { cafe_meal: 'Mahlzeit', food_hall_meal: 'Mahlzeit' }

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tileEntityId = new URL(req.url).searchParams.get('tileEntityId') ?? ''
  if (!UUID_RE.test(tileEntityId)) return NextResponse.json({ error: 'tileEntityId fehlt.' }, { status: 400 })

  const supabase = createServiceClient()
  const since = new Date(Date.now() - WINDOW_S * 1000).toISOString()
  const { data: events } = await supabase
    .from('person_consumption_events')
    .select('person_id,service_code,created_at')
    .eq('tile_entity_id', tileEntityId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(40)
  // Je Person zählt der jüngste Kauf.
  const latest = new Map<string, { serviceCode: string; at: string }>()
  for (const event of events ?? []) if (!latest.has(event.person_id)) latest.set(event.person_id, { serviceCode: String(event.service_code), at: String(event.created_at) })
  const personIds = [...latest.keys()]
  if (personIds.length === 0) return NextResponse.json({ ok: true, guests: [] }, { headers: { 'Cache-Control': 'private, no-store' } })

  const [{ data: people }, { data: identities }] = await Promise.all([
    supabase.from('people').select('id,display_name,observable_description,activity_state,last_action,birth_year,person_appearance(person_id,gender_presentation,body_frame,skin_tone_code,hair_style_code,hair_color_code,facial_hair_code,visible_age_band,clothing_profile)').in('id', personIds),
    supabase.from('player_person_identity_knowledge').select('person_id,identity_state,inferred_name,known_name').eq('profile_id', profileId).in('person_id', personIds),
  ])
  const identityByPerson = new Map((identities ?? []).map((row: any) => [row.person_id, row]))
  const now = Date.now()
  const guests = (people ?? []).map((person: any) => {
    const identity = identityByPerson.get(person.id) as any
    const identityState = perceivedIdentityState(identity)
    const rawAppearance = Array.isArray(person.person_appearance) ? person.person_appearance[0] : person.person_appearance
    const appearance = appearanceFromRow(rawAppearance)
    const observableDescription = person.observable_description?.trim() || observableDescriptionFromAppearance(appearance)
    const visit = latest.get(person.id)!
    return {
      resident: {
        id: person.id,
        displayName: perceivedPersonLabel({ state: identityState, observableDescription, inferredName: identity?.inferred_name ?? null, knownName: identity?.known_name ?? null }),
        identityState, observableDescription, appearance,
        birthYear: person.birth_year, activityState: person.activity_state, lastAction: person.last_action,
        assignments: [], needs: [], skills: [],
      },
      ageSeconds: Math.max(0, Math.round((now - Date.parse(visit.at)) / 1000)),
      label: SERVICE_LABEL[visit.serviceCode] ?? 'Bestellung',
    }
  })
  return NextResponse.json({ ok: true, guests }, { headers: { 'Cache-Control': 'private, no-store' } })
}
