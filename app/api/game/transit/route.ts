// app/api/game/transit/route.ts
// Server-authoritative physical movement. player_journeys remains progression.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { boardPlayerShip, dispatchParkedShip, getFleet, completePlayerTransit, getPassengerOffers, getPlayerTransitState, startPlayerPassengerTransit, startPlayerTransit } from '@/lib/game/core/transit'

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

function transitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('NOXIA_SHIP_NOT_FOUND')) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })
  if (message.includes('NOXIA_PROFILE_NOT_FOUND')) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  if (message.includes('NOXIA_LOCATION_NOT_FOUND')) return NextResponse.json({ error: 'Zielort nicht gefunden' }, { status: 404 })
  // Spediteur-Pfad ohne eigenes Schiff (s. Migration 20261003190000)
  if (message.includes('NOXIA_PASSENGER_TICKET_INSUFFICIENT')) {
    const match = message.match(/NOXIA_PASSENGER_TICKET_INSUFFICIENT:(\d+):(\d+)/)
    return NextResponse.json({
      error: match ? `Ticket kostet ${match[1]} Cr — nicht genug Credits (${match[2]} Cr vorhanden)` : 'Nicht genug Credits für das Ticket.',
      ticketPrice: match ? Number(match[1]) : undefined,
      credits: match ? Number(match[2]) : undefined,
    }, { status: 400 })
  }
  const notHere = message.match(/NOXIA_SHIP_NOT_HERE:(\S+)/)
  if (notHere) return NextResponse.json({ error: `Dein Schiff liegt in ${notHere[1]} – flieg dorthin, um an Bord zu gehen.`, code: 'SHIP_NOT_HERE', shipLocation: notHere[1] }, { status: 409 })
  if (message.includes('NOXIA_DISPATCH_PLAYER_ABOARD')) return NextResponse.json({ error: 'Du bist an Bord – steig aus (Linienflug) oder fliege selbst.', code: 'PLAYER_ABOARD' }, { status: 409 })
  if (message.includes('NOXIA_PILOT_NOT_FOUND')) return NextResponse.json({ error: 'Dieser Pilot steht nicht zur Auswahl.' }, { status: 400 })
  if (message.includes('NOXIA_SHIP_IN_TRANSIT')) return NextResponse.json({ error: 'Dein Schiff ist gerade unterwegs.', code: 'SHIP_IN_TRANSIT' }, { status: 409 })
  if (message.includes('NOXIA_TRANSIT_ROUTE_UNKNOWN')) return NextResponse.json({ error: 'Für diese Route liegt noch kein Transfermodell vor.', code: 'ROUTE_UNKNOWN' }, { status: 400 })
  if (message.includes('NOXIA_TRANSIT_OUT_OF_RANGE')) return NextResponse.json({ error: 'Ziel liegt außerhalb der aktuellen Schiffsreichweite.', code: 'OUT_OF_RANGE' }, { status: 400 })
  if (message.includes('NOXIA_TRANSIT_ENERGY_INSUFFICIENT')) {
    const match = message.match(/NOXIA_TRANSIT_ENERGY_INSUFFICIENT:(\d+):(\d+)/)
    return NextResponse.json({
      error: match ? `Nicht genug Energie. Benötigt: ${match[1]}t, an Bord: ${match[2]}t` : 'Nicht genug Energie.',
      energyNeeded: match ? Number(match[1]) : undefined,
      energyOnBoard: match ? Number(match[2]) : undefined,
    }, { status: 400 })
  }
  if (message.includes('NOXIA_TRANSIT_LANDING_FEE_INSUFFICIENT')) {
    const match = message.match(/NOXIA_TRANSIT_LANDING_FEE_INSUFFICIENT:(\d+):(\d+)/)
    return NextResponse.json({
      error: match ? `Landegebühr ${match[1]} Cr — nicht genug Credits` : 'Nicht genug Credits für die Landegebühr.',
      landingFee: match ? Number(match[1]) : undefined,
    }, { status: 400 })
  }
  if (message.includes('NOXIA_TRANSIT_PILOT_FEE_INSUFFICIENT')) {
    const match = message.match(/NOXIA_TRANSIT_PILOT_FEE_INSUFFICIENT:(\d+):(\d+)/)
    return NextResponse.json({
      error: match ? `Der Pilot verlangt ${match[1]} Cr Honorar — nicht genug Credits (${match[2]} Cr nach Landegebühr)` : 'Nicht genug Credits für das Pilotenhonorar.',
      pilotFee: match ? Number(match[1]) : undefined,
    }, { status: 400 })
  }
  if (message.includes('NOXIA_TRANSIT_NO_LANDING_CAPACITY')) return NextResponse.json({ error: 'Kein freier Landeplatz am Ziel verfügbar.', code: 'NO_LANDING_CAPACITY' }, { status: 409 })
  if (message.includes('NOXIA_TRANSIT_ALREADY_ACTIVE')) return NextResponse.json({ error: 'Das Schiff befindet sich bereits im Transit.', code: 'TRANSIT_ALREADY_ACTIVE' }, { status: 409 })
  if (message.includes('NOXIA_TRANSIT_SAME_LOCATION')) return NextResponse.json({ error: 'Das Schiff befindet sich bereits am Ziel.' }, { status: 400 })
  if (message.includes('NOXIA_TRANSIT_STATE_INVALID')) return NextResponse.json({ error: 'Transit-Zustand ist inkonsistent.', code: 'TRANSIT_STATE_INVALID' }, { status: 500 })

  console.error('transit command failed:', message)
  return NextResponse.json({ error: 'Transit fehlgeschlagen' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Flotte: GET ?fleet=1 → eigene Schiffe mit Ladung und Piloten des Tages
  if (req.nextUrl.searchParams.get('fleet')) {
    try {
      return NextResponse.json({ ok: true, ...await getFleet(user.id) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return transitError(error)
    }
  }

  // Ticketschalter: GET ?offers=1 → Linienflüge vom aktuellen Ort (Preis, Dauer)
  if (req.nextUrl.searchParams.get('offers')) {
    try {
      return NextResponse.json({ ok: true, ...await getPassengerOffers(user.id) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return transitError(error)
    }
  }

  try {
    const state = await getPlayerTransitState(user.id)
    if (!state) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })
    return NextResponse.json({ ok: true, transit: state })
  } catch (error) {
    return transitError(error)
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const action = body?.action ?? 'start'

  try {
    if (action === 'start') {
      const destination = typeof body?.destination === 'string' ? body.destination.trim() : ''
      if (!destination) return NextResponse.json({ error: 'Ziel fehlt' }, { status: 400 })

      const result = await startPlayerTransit(user.id, destination)
      return NextResponse.json({
        ok: true,
        transit: {
          status: result.status,
          from: result.from_location,
          to: result.destination,
          departedAt: result.departed_at,
          arrivesAt: result.arrives_at,
          totalSeconds: result.duration_seconds,
          remainingSeconds: result.remaining_seconds,
        },
        shipId: result.ship_id,
        isPassenger: Boolean(result.is_passenger),
        ticketPrice: result.ticket_price ?? 0,
        energyUsed: result.energy_used,
        energyLeft: result.energy_left,
        landingFee: result.landing_fee,
        pilotFee: result.pilot_fee ?? 0,
        credits: result.credits,
        docking: {
          managed: result.docking_managed,
          padEntityId: result.docking_pad_entity_id,
        },
        idempotent: result.idempotent,
      })
    }

    // Linienflug auch mit eigenem Schiff: das Schiff bleibt am Abflugort geparkt.
    if (action === 'passenger') {
      const destination = typeof body?.destination === 'string' ? body.destination.trim() : ''
      if (!destination) return NextResponse.json({ error: 'Ziel fehlt' }, { status: 400 })
      const result = await startPlayerPassengerTransit(user.id, destination)
      return NextResponse.json({
        ok: true,
        transit: { status: result.status, from: result.from_location, to: result.destination, departedAt: result.departed_at, arrivesAt: result.arrives_at, totalSeconds: result.duration_seconds, remainingSeconds: result.remaining_seconds },
        isPassenger: true,
        ticketPrice: result.ticket_price ?? 0,
        credits: result.credits,
        idempotent: result.idempotent,
      })
    }

    // Schiff mit angeheuertem Piloten losschicken; der Spieler bleibt am Ort.
    if (action === 'dispatch') {
      const destination = typeof body?.destination === 'string' ? body.destination.trim() : ''
      if (!destination) return NextResponse.json({ error: 'Ziel fehlt' }, { status: 400 })
      const result = await dispatchParkedShip(user.id, destination, typeof body?.shipId === 'string' ? body.shipId : undefined, Number.isInteger(body?.pilot) ? Number(body.pilot) : 1)
      return NextResponse.json({
        ok: true,
        pilotName: (result as { pilot_name?: string }).pilot_name,
        shipId: result.ship_id,
        destination: result.destination,
        arrivesAt: result.arrives_at,
        totalSeconds: result.duration_seconds,
        energyUsed: result.energy_used,
        landingFee: result.landing_fee,
        pilotFee: result.pilot_fee ?? 0,
        credits: result.credits,
      })
    }

    // An Bord des eigenen Schiffs gehen (nur dort, wo es liegt).
    if (action === 'board') {
      const boarded = await boardPlayerShip(user.id, typeof body?.shipId === 'string' ? body.shipId : undefined)
      return NextResponse.json({ ...boarded })
    }

    if (action === 'complete') {
      const result = await completePlayerTransit(user.id)
      if (!result) return NextResponse.json({ ok: true, completed: true, idempotent: true })
      return NextResponse.json({
        ok: true,
        completed: result.completed,
        idempotent: result.idempotent,
        location: result.location,
        destination: result.destination,
        remainingSeconds: result.remaining_seconds,
        flightCount: result.flight_count,
        docking: { padEntityId: result.docking_pad_entity_id ?? null },
      })
    }

    return NextResponse.json({ error: 'Ungültige Transit-Aktion' }, { status: 400 })
  } catch (error) {
    return transitError(error)
  }
}
