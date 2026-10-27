// app/api/game/earth-trip/route.ts
// Reisen auf der Erde über das Reisebüro (Thomas, 27.10.2026).
//
// GET  ?lat=…&lon=…                         → Ziele mit Bahn/Flug, Preis, Dauer; offene Reise; Heimat (Reisebüro Sundern)
// POST { action: 'book', from, destination } → Ticket kaufen (destination = Regionskennung oder 'home')
// POST { action: 'arrive' }                  → Ankunft, sobald die Zeit um ist
//
// Preis und Dauer rechnet der Server (lib/game/earthTrips.ts); gebucht wird in
// noxia_book_earth_trip (Migration 20261027190000).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { distanceKm, earthTripOffers, regionName, tripMode, tripPrice, tripSeconds, type EarthDestination, type GeoPoint } from '@/lib/game/earthTrips'

type Supabase = ReturnType<typeof createServiceClient>
const noStore = { 'Cache-Control': 'no-store' }

function point(value: unknown): GeoPoint | null {
  const p = value as { lat?: unknown; lon?: unknown } | null
  const lat = Number(p?.lat), lon = Number(p?.lon)
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? { lat, lon } : null
}

/** Orte der Erde mit Kartendaten (ohne Ortsdetail-Zellen). */
async function destinations(supabase: Supabase): Promise<EarthDestination[]> {
  const { data } = await supabase.from('celestial_regions').select('id,slug,label,center_lat,center_lon,source').eq('body', 'earth').limit(200)
  const rows = (data ?? []).filter(row => row.source !== 'noxia:local-detail' && row.label)
  const withData = await Promise.all(rows.map(async row => {
    const { count } = await supabase.from('region_features').select('id', { count: 'exact', head: true }).eq('region_id', row.id).limit(1)
    return (count ?? 0) > 20 ? row : null
  }))
  return withData.flatMap(row => row ? [{ slug: String(row.slug), ...regionName(String(row.label)), at: { lat: Number(row.center_lat), lon: Number(row.center_lon) } }] : [])
}

/** Heimat: das Reisebüro in Sundern (dort beginnt und endet die Heimreise). */
async function home(supabase: Supabase): Promise<EarthDestination | null> {
  const { data } = await supabase.from('tile_entities').select('latitude_deg,longitude_deg').eq('entity_id', 'travel_agency').eq('status', 'active').order('created_at').limit(1).maybeSingle()
  if (!data) return null
  return { slug: 'home', name: 'Sundern', country: 'Deutschland', at: { lat: Number(data.latitude_deg), lon: Number(data.longitude_deg) } }
}

async function openTrip(supabase: Supabase, profileId: string) {
  const { data } = await supabase.from('earth_trips').select('*').eq('profile_id', profileId).is('arrived_at', null).order('departed_at', { ascending: false }).limit(1).maybeSingle()
  return data ?? null
}

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const from = point({ lat: req.nextUrl.searchParams.get('lat'), lon: req.nextUrl.searchParams.get('lon') })
  const [places, homePlace, trip, { data: wallet }] = await Promise.all([destinations(supabase), home(supabase), openTrip(supabase, profileId), supabase.from('profiles').select('credits').eq('id', profileId).maybeSingle()])
  const offers = from ? earthTripOffers(from, places) : []
  const homeOffer = from && homePlace && distanceKm(from, homePlace.at) >= 15
    ? { ...homePlace, mode: tripMode(distanceKm(from, homePlace.at)), distanceKm: Math.round(distanceKm(from, homePlace.at)), price: tripPrice(distanceKm(from, homePlace.at)), durationSeconds: tripSeconds(distanceKm(from, homePlace.at)) }
    : null
  return NextResponse.json({ ok: true, offers, home: homeOffer, trip, credits: Number(wallet?.credits ?? 0) }, { headers: noStore })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { action?: string; from?: unknown; destination?: string }
  const supabase = createServiceClient()

  if (body.action === 'arrive') {
    const { data, error } = await supabase.rpc('noxia_arrive_earth_trip', { p_profile_id: profileId })
    if (error) return NextResponse.json({ error: 'Ankunft nicht möglich.' }, { status: 500 })
    return NextResponse.json(data, { headers: noStore })
  }

  if (body.action !== 'book') return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  const from = point(body.from)
  if (!from) return NextResponse.json({ error: 'Abfahrtsort fehlt.' }, { status: 400 })
  const target = body.destination === 'home' ? await home(supabase) : (await destinations(supabase)).find(place => place.slug === body.destination) ?? null
  if (!target) return NextResponse.json({ error: 'Dieses Ziel gibt es nicht.' }, { status: 404 })
  const km = distanceKm(from, target.at)
  if (km < 15) return NextResponse.json({ error: 'Du bist schon dort.' }, { status: 400 })
  const mode = tripMode(km)
  const { data, error } = await supabase.rpc('noxia_book_earth_trip', {
    p_profile_id: profileId, p_from_lat: from.lat, p_from_lon: from.lon,
    p_destination_slug: target.slug, p_destination_name: target.name, p_to_lat: target.at.lat, p_to_lon: target.at.lon,
    p_mode: mode, p_distance_km: Math.round(km), p_price: tripPrice(km, mode), p_duration_seconds: tripSeconds(km, mode),
  })
  if (error) {
    const message = error.message ?? ''
    const short = message.match(/NOXIA_TRIP_TICKET_INSUFFICIENT:(\d+):(\d+)/)
    if (short) return NextResponse.json({ error: `Ticket kostet ${short[1]} Cr – nicht genug Credits (${short[2]} Cr).` }, { status: 400 })
    if (message.includes('NOXIA_TRIP_ALREADY_ACTIVE')) return NextResponse.json({ error: 'Du bist bereits unterwegs.' }, { status: 409 })
    return NextResponse.json({ error: 'Buchung fehlgeschlagen.' }, { status: 500 })
  }
  return NextResponse.json(data, { headers: noStore })
}
