import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  cancelDockingReservation,
  dockVessel,
  getActiveDockingConnection,
  listDockingPortStates,
  reserveDockingPort,
  undockVessel,
} from '@/lib/game/core/dockingPersistence'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PORT_ID_RE = /^[a-z0-9][a-z0-9-]{1,79}$/i

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

function portId(value: unknown): string | null {
  return typeof value === 'string' && PORT_ID_RE.test(value) ? value : null
}

function coreNotRolledOut(message: string) {
  return message.includes('PGRST202')
    || message.includes('PGRST205')
    || message.includes('Could not find the function')
    || message.includes('Could not find the table')
    || message.includes('schema cache')
}

function dockingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (coreNotRolledOut(message)) return NextResponse.json({ error: 'Der Docking-Core ist auf der Datenbank noch nicht ausgerollt.', code: 'DOCKING_CORE_NOT_DEPLOYED' }, { status: 503 })
  if (message.includes('NOXIA_DOCKING_SHIP_NOT_FOUND')) return NextResponse.json({ error: 'Schiff nicht gefunden.', code: 'SHIP_NOT_FOUND' }, { status: 404 })
  if (message.includes('NOXIA_DOCKING_PORT_NOT_FOUND')) return NextResponse.json({ error: 'Docking-Port nicht gefunden.', code: 'PORT_NOT_FOUND' }, { status: 404 })
  if (message.includes('NOXIA_DOCKING_CONNECTION_NOT_FOUND')) return NextResponse.json({ error: 'Aktive Docking-Verbindung nicht gefunden.', code: 'CONNECTION_NOT_FOUND' }, { status: 404 })
  if (message.includes('NOXIA_DOCKING_RESERVATION_NOT_FOUND')) return NextResponse.json({ error: 'Aktive Portreservierung nicht gefunden.', code: 'RESERVATION_NOT_FOUND' }, { status: 404 })
  if (message.includes('NOXIA_DOCKING_FORBIDDEN')) return NextResponse.json({ error: 'Kein Zugriff auf dieses Schiff.', code: 'FORBIDDEN' }, { status: 403 })
  if (message.includes('NOXIA_DOCKING_INCOMPATIBLE_PORT')) return NextResponse.json({ error: 'Schiff und Portklasse sind nicht kompatibel.', code: 'INCOMPATIBLE_PORT' }, { status: 409 })
  if (message.includes('NOXIA_DOCKING_WRONG_LOCATION')) return NextResponse.json({ error: 'Das Schiff befindet sich nicht an dieser Station.', code: 'WRONG_LOCATION' }, { status: 409 })
  if (message.includes('NOXIA_DOCKING_PORT_OFFLINE')) return NextResponse.json({ error: 'Der Port ist außer Betrieb.', code: 'PORT_OFFLINE' }, { status: 409 })
  if (message.includes('NOXIA_DOCKING_PORT_OCCUPIED')) return NextResponse.json({ error: 'Der Port ist bereits belegt.', code: 'PORT_OCCUPIED' }, { status: 409 })
  if (message.includes('NOXIA_DOCKING_PORT_RESERVED')) return NextResponse.json({ error: 'Der Port ist bereits reserviert.', code: 'PORT_RESERVED' }, { status: 409 })
  if (message.includes('NOXIA_DOCKING_SHIP_ALREADY_DOCKED')) return NextResponse.json({ error: 'Das Schiff ist bereits an einem Port angedockt.', code: 'SHIP_ALREADY_DOCKED' }, { status: 409 })
  if (message.includes('NOXIA_DOCKING_SHIP_ALREADY_RESERVED')) return NextResponse.json({ error: 'Das Schiff besitzt bereits eine aktive Portreservierung.', code: 'SHIP_ALREADY_RESERVED' }, { status: 409 })
  if (message.includes('NOXIA_DOCKING_COMMAND_CONFLICT')) return NextResponse.json({ error: 'Die Command-ID wurde bereits mit anderen Docking-Parametern verwendet.', code: 'COMMAND_CONFLICT' }, { status: 409 })

  console.error('docking command failed:', message)
  return NextResponse.json({ error: 'Docking-Vorgang fehlgeschlagen.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const stationSlug = searchParams.get('stationSlug')?.trim() || null
  const shipId = uuid(searchParams.get('shipId'))

  try {
    if (shipId) {
      const connection = await getActiveDockingConnection(user.id, shipId)
      return NextResponse.json({ ok: true, connection })
    }
    if (!stationSlug) return NextResponse.json({ error: 'stationSlug oder shipId erforderlich.' }, { status: 400 })
    const ports = await listDockingPortStates(stationSlug)
    return NextResponse.json({ ok: true, stationSlug, ports })
  } catch (error) {
    return dockingError(error)
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
  const dockingPortId = portId(body.portId)
  const commandId = body.commandId == null ? randomUUID() : uuid(body.commandId)
  if (!shipId || !dockingPortId || !commandId) {
    return NextResponse.json({ error: 'Ungültige Docking-Parameter.' }, { status: 400 })
  }

  try {
    if (action === 'reserve') {
      const expiresAt = body.expiresAt == null ? null : String(body.expiresAt)
      const result = await reserveDockingPort({ commandId, actorProfileId: user.id, shipId, portId: dockingPortId, expiresAt })
      return NextResponse.json({ ok: true, commandId, docking: result })
    }
    if (action === 'dock') {
      const result = await dockVessel({ commandId, actorProfileId: user.id, shipId, portId: dockingPortId })
      return NextResponse.json({ ok: true, commandId, docking: result })
    }
    if (action === 'undock') {
      const result = await undockVessel({ commandId, actorProfileId: user.id, shipId, portId: dockingPortId })
      return NextResponse.json({ ok: true, commandId, docking: result })
    }
    if (action === 'cancel-reservation') {
      const result = await cancelDockingReservation({ commandId, actorProfileId: user.id, shipId, portId: dockingPortId })
      return NextResponse.json({ ok: true, commandId, docking: result })
    }
    return NextResponse.json({ error: 'Ungültige Docking-Aktion.' }, { status: 400 })
  } catch (error) {
    return dockingError(error)
  }
}
