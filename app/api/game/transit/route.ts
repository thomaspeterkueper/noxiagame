// app/api/game/transit/route.ts
// Server-authoritative physical movement. player_journeys remains progression.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { completePlayerTransit, getPlayerTransitState, startPlayerTransit } from '@/lib/game/core/transit'

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
  if (message.includes('NOXIA_LOCATION_NOT_FOUND')) return NextResponse.json({ error: 'Zielort nicht gefunden' }, { status: 404 })
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
        energyUsed: result.energy_used,
        energyLeft: result.energy_left,
        landingFee: result.landing_fee,
        credits: result.credits,
        docking: {
          managed: result.docking_managed,
          padEntityId: result.docking_pad_entity_id,
        },
        idempotent: result.idempotent,
      })
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
