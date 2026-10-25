// app/api/game/hospitality/guests/route.ts
// GET ?tileEntityId=… → der Zustand eines Lokals, wie er sich aus dem
// wirklichen Geschehen ergibt: wer in der letzten Stunde gekauft hat, wie spät
// es ist, ob es ein Obergeschoss gibt und was das Personal mitbekommen hat.
// Quelle sind die echten Käufe der Bewohner (person_consumption_events); es
// wird nichts erfunden und nichts geschrieben. Namen folgen dem, was der
// Spieler über die Person weiß.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { perceivedIdentityState, perceivedPersonLabel } from '@/lib/game/population/playerIdentityKnowledge'
import { appearanceFromRow, observableDescriptionFromAppearance } from '@/lib/game/population/personAppearance'
import { venueHearsay } from '@/lib/game/hospitality/hearsay'
import { ROOM_ITEM_CODE, ROOM_NIGHT_S, type VenueRooms } from '@/lib/game/hospitality/venues'

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
  const venue = await venueState(supabase, tileEntityId, profileId)
  if (personIds.length === 0) return NextResponse.json({ ok: true, guests: [], ...venue }, { headers: { 'Cache-Control': 'private, no-store' } })

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
  return NextResponse.json({ ok: true, guests, ...venue }, { headers: { 'Cache-Control': 'private, no-store' } })
}

function metres(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const rad = Math.PI / 180
  const north = (to.lat - from.lat) * 111_195
  const east = (to.lon - from.lon) * 111_195 * Math.cos(((from.lat + to.lat) / 2) * rad)
  return { distanceM: Math.hypot(north, east), bearingDeg: (Math.atan2(east, north) / rad + 360) % 360 }
}

/** Uhrzeit, Obergeschoss und was das Personal mitbekommen hat. Fehlt etwas, bleibt es weg. */
async function venueState(supabase: any, tileEntityId: string, profileId: string) {
  const [{ data: tile }, { data: tickRow }] = await Promise.all([
    supabase.from('tile_entities').select('id,location_id,latitude_deg,longitude_deg,residential_capacity,transient_capacity,footprint_width_m,footprint_depth_m').eq('id', tileEntityId).maybeSingle(),
    supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle(),
  ])
  const tick = Number(tickRow?.tick_number)
  const hour = Number.isFinite(tick) ? ((Math.trunc(tick) % 24) + 24) % 24 : null
  const upper = { homes: Math.max(0, Number(tile?.residential_capacity ?? 0)), guestRooms: Math.max(0, Number(tile?.transient_capacity ?? 0)) }
  // Grundfläche des Hauses – bestimmt, wie viele Tische hineinpassen.
  const areaM2 = tile?.footprint_width_m && tile?.footprint_depth_m ? Number(tile.footprint_width_m) * Number(tile.footprint_depth_m) : null
  if (!tile) return { hour, upper, heard: [] as string[], rooms: null, areaM2 }

  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString()
  const [{ data: sales }, { data: builds }, { data: events }, { data: adults }, { data: working }, { data: definitions }] = await Promise.all([
    supabase.from('person_consumption_events').select('person_id,created_at').eq('tile_entity_id', tileEntityId).gte('created_at', dayAgo).order('created_at', { ascending: false }).limit(200),
    supabase.from('player_builds').select('buildable_id,latitude_deg,longitude_deg').eq('location_id', tile.location_id).eq('target_type', 'building').eq('status', 'building').not('latitude_deg', 'is', null).limit(50),
    Number.isFinite(tick)
      ? supabase.from('population_events').select('event_type').eq('location_id', tile.location_id).gte('tick', tick - 24).in('event_type', ['person_conflict', 'person_assistance']).limit(500)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('people').select('id').eq('current_location_id', tile.location_id).eq('simulation_tier', 'active').limit(2000),
    supabase.from('person_assignments').select('person_id').eq('location_id', tile.location_id).eq('assignment_type', 'work').eq('is_active', true).limit(4000),
    supabase.from('building_definitions').select('key,name'),
  ])
  const names = new Map<string, string>((definitions ?? []).map((row: any) => [String(row.key), String(row.name)]))
  const here = tile.latitude_deg != null && tile.longitude_deg != null ? { lat: Number(tile.latitude_deg), lon: Number(tile.longitude_deg) } : null
  const employed = new Set((working ?? []).map((row: any) => row.person_id))
  const heard = venueHearsay({
    guestsToday: new Set((sales ?? []).map((row: any) => row.person_id)).size,
    hoursSinceLastGuest: sales?.length ? (Date.now() - Date.parse(sales[0].created_at)) / 3600_000 : null,
    builds: here ? (builds ?? []).flatMap((row: any) => {
      const at = metres(here, { lat: Number(row.latitude_deg), lon: Number(row.longitude_deg) })
      return at.distanceM <= 4000 ? [{ name: names.get(String(row.buildable_id)) ?? String(row.buildable_id), ...at }] : []
    }) : [],
    conflicts: (events ?? []).filter((row: any) => row.event_type === 'person_conflict').length,
    assistances: (events ?? []).filter((row: any) => row.event_type === 'person_assistance').length,
    jobSeekers: (adults ?? []).filter((row: any) => !employed.has(row.id)).length,
  })
  // Zimmer: Buchungen der letzten 24 Stunden (eine Nacht) gegen die Gästeplätze.
  let rooms: VenueRooms | null = null
  if (upper.guestRooms > 0) {
    const nightAgo = new Date(Date.now() - ROOM_NIGHT_S * 1000).toISOString()
    const { data: bookings } = await supabase.from('player_hospitality_orders').select('profile_id,created_at').eq('tile_entity_id', tileEntityId).eq('item_code', ROOM_ITEM_CODE).gte('created_at', nightAgo).limit(500)
    const byGuest = new Map<string, number>()
    for (const row of bookings ?? []) byGuest.set(String(row.profile_id), Math.max(byGuest.get(String(row.profile_id)) ?? 0, Date.parse(row.created_at)))
    const mineAt = byGuest.get(profileId)
    rooms = { capacity: upper.guestRooms, occupied: Math.min(upper.guestRooms, byGuest.size), mineForS: mineAt ? Math.max(0, Math.round((mineAt + ROOM_NIGHT_S * 1000 - Date.now()) / 1000)) : null }
  }
  return { hour, upper, heard, rooms, areaM2 }
}
