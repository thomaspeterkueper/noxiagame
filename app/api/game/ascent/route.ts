import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAscentMissionForShip } from '@/lib/game/core/ascentPersistence'
import {
  advanceAscentCommand,
  ascentExecutionPresentation,
  nextExecutionAction,
} from '@/lib/game/core/ascentExecution'
import { engineeringRequestForDeparture } from '@/lib/game/core/ascentReadiness'
import { getOrbitalPresenceForShip } from '@/lib/game/core/orbitalPresence'

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

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function coreNotRolledOut(message: string) {
  return message.includes('PGRST202')
    || message.includes('PGRST205')
    || message.includes('Could not find the function')
    || message.includes('Could not find the table')
    || message.includes('schema cache')
}

function ascentError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (coreNotRolledOut(message)) {
    return NextResponse.json({
      error: 'Der Ascent-Core ist auf der Datenbank noch nicht ausgerollt.',
      code: 'ASCENT_CORE_NOT_DEPLOYED',
    }, { status: 503 })
  }
  if (message.includes('NOXIA_ASCENT_FORBIDDEN')) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Schiff.', code: 'FORBIDDEN' }, { status: 403 })
  }
  if (message.includes('NOXIA_ASCENT_MISSION_NOT_FOUND')) {
    return NextResponse.json({ error: 'Keine Ascent-Mission für dieses Schiff vorhanden.', code: 'ASCENT_MISSION_NOT_FOUND' }, { status: 404 })
  }
  if (message.includes('NOXIA_ASCENT_MISSION_NOT_ACTIVE') || message.includes('NOXIA_ASCENT_NO_EXECUTABLE_TRANSITION')) {
    return NextResponse.json({ error: 'Diese Ascent-Mission kann nicht weiter ausgeführt werden.', code: 'ASCENT_NOT_EXECUTABLE' }, { status: 409 })
  }
  console.error('ascent state query failed:', message)
  return NextResponse.json({ error: 'Ascent-Zustand konnte nicht verarbeitet werden.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shipId = uuid(new URL(req.url).searchParams.get('shipId'))
  if (!shipId) return NextResponse.json({ error: 'Gültige shipId erforderlich.' }, { status: 400 })

  try {
    const [mission, orbitalPresence] = await Promise.all([
      getAscentMissionForShip(user.id, shipId),
      getOrbitalPresenceForShip(user.id, shipId),
    ])
    const presentation = mission ? ascentExecutionPresentation(mission.phase) : null
    return NextResponse.json({
      ok: true,
      mission,
      presentation,
      orbitalPresence,
      executionReady: Boolean(
        mission
        && mission.status === 'active'
        && nextExecutionAction(mission.phase),
      ),
      engineeringRequest: mission
        ? engineeringRequestForDeparture(mission.departure_surface_slug)
        : null,
    })
  } catch (error) {
    return ascentError(error)
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

  const action = typeof body.action === 'string' ? body.action : ''
  const shipId = uuid(body.shipId)
  if (!shipId) return NextResponse.json({ error: 'Gültige shipId erforderlich.' }, { status: 400 })

  if (action === 'advance') {
    try {
      // The client requests only "advance". Persisted mission state determines the
      // actual low-level transition; clients cannot forge start/insertion/arrival.
      const result = await advanceAscentCommand({
        commandId: randomUUID(),
        actorProfileId: user.id,
        shipId,
      })
      return NextResponse.json({ ok: true, ...result })
    } catch (error) {
      return ascentError(error)
    }
  }

  if (action === 'authorize') {
    const departureSurfaceSlug = nonEmpty(body.departureSurfaceSlug) ?? 'moon'
    const targetOrbitNodeSlug = nonEmpty(body.targetOrbitNodeSlug)
    const engineeringRequest = engineeringRequestForDeparture(departureSurfaceSlug)
    return NextResponse.json({
      error: departureSurfaceSlug.toLowerCase() === 'earth'
        ? 'Für diesen Schiffsrahmen liegt noch keine autoritative Engineering-Freigabe für Erde → 400-km-LEO vor.'
        : 'Für diesen Schiffsrahmen liegt noch keine autoritative Engineering-Freigabe für Mondoberfläche → Mondorbit vor.',
      code: 'ENGINEERING_ASCENT_AUTHORITY_UNAVAILABLE',
      engineeringRequest,
      shipId,
      departureSurfaceSlug,
      targetOrbitNodeSlug,
    }, { status: 409 })
  }

  // Low-level state changes stay private even though server-side execution now exists.
  if (['start', 'mark-insertion', 'mark-arrival', 'cancel'].includes(action)) {
    return NextResponse.json({
      error: 'Direkte Ascent-Phasenwechsel sind nicht erlaubt. Verwende den serverseitig aufgelösten advance-Pfad.',
      code: 'ASCENT_EXECUTION_UNAVAILABLE',
      shipId,
    }, { status: 409 })
  }

  return NextResponse.json({ error: 'Ungültige Ascent-Aktion.' }, { status: 400 })
}
