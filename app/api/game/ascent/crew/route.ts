import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { boardPlayerCrew, getPlayerCrewState, leavePlayerCrew } from '@/lib/game/core/ascentCrew'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
}

function uuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

function crewError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('PGRST202') || message.includes('PGRST205') || message.includes('schema cache')) {
    return NextResponse.json({ error: 'Crew-Core ist noch nicht auf der Datenbank ausgerollt.', code: 'CREW_CORE_NOT_DEPLOYED' }, { status: 503 })
  }
  if (message.includes('NOXIA_CREW_FORBIDDEN')) return NextResponse.json({ error: 'Kein Zugriff auf dieses Schiff.', code: 'FORBIDDEN' }, { status: 403 })
  if (message.includes('NOXIA_CREW_SHIP_NOT_FOUND')) return NextResponse.json({ error: 'Schiff nicht gefunden.', code: 'SHIP_NOT_FOUND' }, { status: 404 })
  if (message.includes('NOXIA_CREW_SHIP_IN_TRANSIT')) return NextResponse.json({ error: 'Crew kann während eines laufenden Transits nicht geändert werden.', code: 'SHIP_IN_TRANSIT' }, { status: 409 })
  console.error('crew command failed:', message)
  return NextResponse.json({ error: 'Crew-Zustand konnte nicht verarbeitet werden.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shipId = uuid(new URL(req.url).searchParams.get('shipId'))
  if (!shipId) return NextResponse.json({ error: 'Gültige shipId erforderlich.' }, { status: 400 })

  try {
    const crew = await getPlayerCrewState(user.id, shipId)
    return NextResponse.json({ ok: true, crew })
  } catch (error) {
    return crewError(error)
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const shipId = uuid(body.shipId)
  if (!shipId) return NextResponse.json({ error: 'Gültige shipId erforderlich.' }, { status: 400 })

  try {
    if (body.action === 'board-self') {
      const crew = await boardPlayerCrew(user.id, shipId, 'commander')
      return NextResponse.json({ ok: true, crew })
    }
    if (body.action === 'leave-self') {
      const crew = await leavePlayerCrew(user.id, shipId)
      return NextResponse.json({ ok: true, crew })
    }
    return NextResponse.json({ error: 'Ungültige Crew-Aktion.' }, { status: 400 })
  } catch (error) {
    return crewError(error)
  }
}
