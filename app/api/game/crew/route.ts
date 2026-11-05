// app/api/game/crew/route.ts
// Erstellt:     29.10.2026
// Aktualisiert: 29.10.2026 — Mitflug auf Handelsschiffen: Routen, Anheuern, Abmelden
// Version:      1.0.0
//
// Spielerwunsch „Raumhafen“ (entschieden von Thomas, 29.10.2026). Der Spieler heuert beim
// Frachtführer für ein Ziel an, geht an Bord, wenn die nächste Fracht dorthin ausläuft,
// und bekommt bei der Ankunft Heuer (Migration 20261029120000_crew_signon_trade_ships.sql).
//
// GET  → { location, hasShip, routes: [{ destination, name, departures, lastDepartTick, hours, wage }], signon }
// POST { action: 'sign_on', destination } | { action: 'cancel' }

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { settleDuePlayerTransit } from '@/lib/game/core/transit'

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token) return null
  const { data: { user } } = await createServiceClient().auth.getUser(token)
  return user
}

function crewError(message: string) {
  if (message.includes('NOXIA_CREW_HAS_SHIP')) return NextResponse.json({ error: 'Mit eigenem Schiff fliegst du selbst – anheuern können nur Leute ohne Schiff.' }, { status: 409 })
  if (message.includes('NOXIA_TRANSIT_ALREADY_ACTIVE')) return NextResponse.json({ error: 'Du bist schon unterwegs.' }, { status: 409 })
  if (message.includes('NOXIA_CREW_ROUTE_UNKNOWN')) return NextResponse.json({ error: 'Dorthin fährt von hier keine Fracht.' }, { status: 400 })
  if (message.includes('NOXIA_CREW_ALREADY_SIGNED')) return NextResponse.json({ error: 'Du stehst schon für ein anderes Ziel auf der Heuerliste. Erst abmelden.' }, { status: 409 })
  if (message.includes('NOXIA_CREW_NO_CARRIER')) return NextResponse.json({ error: 'Gerade heuert niemand an.' }, { status: 503 })
  return NextResponse.json({ error: 'Anheuern hat nicht geklappt.' }, { status: 500 })
}

async function state(profileId: string) {
  const supabase = createServiceClient()
  await settleDuePlayerTransit(profileId).catch(() => null)
  const { data: profile } = await supabase.from('profiles').select('current_location, transit_destination').eq('id', profileId).maybeSingle()
  const location = (profile?.current_location as string | null) ?? null
  const [{ data: ships }, { data: routes }, { data: signon }, { data: tickRow }, { data: locs }] = await Promise.all([
    supabase.from('ships').select('id').eq('profile_id', profileId).limit(1),
    location ? supabase.rpc('noxia_crew_routes', { p_from: location }) : Promise.resolve({ data: [] }),
    supabase.from('crew_signons').select('id, status, from_location, destination, depart_tick, arrive_tick, wage_credits, paid_credits, created_at')
      .eq('profile_id', profileId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('locations').select('slug, name'),
  ])
  const nameOf = new Map(((locs ?? []) as Array<{ slug: string; name: string }>).map(l => [l.slug, l.name]))
  return {
    location,
    locationName: location ? nameOf.get(location) ?? location : null,
    inTransit: Boolean(profile?.transit_destination),
    hasShip: (ships ?? []).length > 0,
    tick: Number(tickRow?.tick_number ?? 0),
    routes: ((routes ?? []) as Array<{ destination: string; departures: number; last_depart_tick: number; avg_hours: number; wage_credits: number }>).map(r => ({
      destination: r.destination,
      name: nameOf.get(r.destination) ?? r.destination,
      departures: Number(r.departures),
      lastDepartTick: Number(r.last_depart_tick),
      hours: Number(r.avg_hours),
      wage: Number(r.wage_credits),
    })),
    signon: signon ? { ...signon, destinationName: nameOf.get(String(signon.destination)) ?? signon.destination } : null,
  }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await state(user.id))
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { action?: string; destination?: string }
  const supabase = createServiceClient()
  if (body.action === 'sign_on') {
    if (!body.destination) return NextResponse.json({ error: 'Ziel fehlt.' }, { status: 400 })
    const { error } = await supabase.rpc('noxia_crew_sign_on', { p_profile_id: user.id, p_destination: body.destination })
    if (error) return crewError(error.message)
    return NextResponse.json({ ok: true, ...(await state(user.id)) })
  }
  if (body.action === 'cancel') {
    const { error } = await supabase.rpc('noxia_crew_cancel', { p_profile_id: user.id })
    if (error) return crewError(error.message)
    return NextResponse.json({ ok: true, ...(await state(user.id)) })
  }
  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
}
