import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  LOGISTICS_RESOURCES,
  TRANSPORT_DOMAINS,
  type LogisticsResource,
  type TransportDomain,
} from '@/lib/game/core/logistics'
import {
  defineTransportItinerary,
  getTransportItinerary,
  transferConnectedCargo,
} from '@/lib/game/core/logisticsHandover'

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

function positiveInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function logisticsResource(value: unknown): LogisticsResource | null {
  return typeof value === 'string' && (LOGISTICS_RESOURCES as readonly string[]).includes(value)
    ? value as LogisticsResource
    : null
}

function transportDomain(value: unknown): TransportDomain | null {
  return typeof value === 'string' && (TRANSPORT_DOMAINS as readonly string[]).includes(value)
    ? value as TransportDomain
    : null
}

function handoverError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_TRANSPORT_JOB_NOT_FOUND')) return NextResponse.json({ error: 'Transportauftrag nicht gefunden.', code: 'TRANSPORT_JOB_NOT_FOUND' }, { status: 404 })
  if (message.includes('NOXIA_CARGO_DOCKING_REQUIRED')) return NextResponse.json({ error: 'Für diesen Cargo-Handover ist eine aktive Docking-Verbindung erforderlich.', code: 'DOCKING_REQUIRED' }, { status: 409 })
  if (message.includes('NOXIA_CARGO_PORT_NOT_ENABLED')) return NextResponse.json({ error: 'Dieser Docking-Port unterstützt keinen Cargo-Transfer.', code: 'PORT_CARGO_DISABLED' }, { status: 409 })
  if (message.includes('NOXIA_CARGO_CONNECTION_SHIP_MISMATCH')) return NextResponse.json({ error: 'Die Docking-Verbindung gehört nicht zum beteiligten Schiffsinventar.', code: 'CONNECTION_SHIP_MISMATCH' }, { status: 409 })
  if (message.includes('NOXIA_CARGO_CONNECTION_LOCATION_MISMATCH')) return NextResponse.json({ error: 'Das Gegeninventar gehört nicht zur angedockten Station.', code: 'CONNECTION_LOCATION_MISMATCH' }, { status: 409 })
  if (message.includes('NOXIA_TRANSPORT_ITINERARY_ALREADY_DEFINED')) return NextResponse.json({ error: 'Für diesen Transportauftrag ist bereits eine Itinerary definiert.', code: 'ITINERARY_ALREADY_DEFINED' }, { status: 409 })
  if (message.includes('NOXIA_TRANSPORT_ITINERARY_STATE_INVALID')) return NextResponse.json({ error: 'Die Itinerary kann nur vor dem Start des Transportauftrags definiert werden.', code: 'ITINERARY_STATE_INVALID' }, { status: 409 })
  if (message.includes('NOXIA_TRANSPORT_ITINERARY_DOCKING_CONNECTION_REQUIRED')) return NextResponse.json({ error: 'Ein als dockingpflichtig markierter Handover benötigt eine connectionId.', code: 'DOCKING_CONNECTION_REQUIRED' }, { status: 400 })
  if (message.includes('NOXIA_TRANSPORT_ITINERARY_COMMAND_CONFLICT') || message.includes('NOXIA_CARGO_TRANSFER_COMMAND_CONFLICT')) return NextResponse.json({ error: 'Die Command-ID wurde bereits mit anderen Parametern verwendet.', code: 'COMMAND_CONFLICT' }, { status: 409 })
  if (message.includes('NOXIA_INVENTORY_AVAILABLE_INSUFFICIENT') || message.includes('NOXIA_INVENTORY_STOCK_INSUFFICIENT')) return NextResponse.json({ error: 'Nicht genug frei verfügbare Ware.', code: 'STOCK_INSUFFICIENT' }, { status: 409 })
  if (message.includes('NOXIA_INVENTORY_CAPACITY_INSUFFICIENT')) return NextResponse.json({ error: 'Das Zielinventar hat nicht genug freie Kapazität.', code: 'TARGET_CAPACITY' }, { status: 409 })
  if (message.includes('FORBIDDEN')) return NextResponse.json({ error: 'Keine Berechtigung für diesen Vorgang.', code: 'FORBIDDEN' }, { status: 403 })

  console.error('logistics handover failed:', message)
  return NextResponse.json({ error: 'Logistik-Handover fehlgeschlagen.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const jobId = uuid(new URL(req.url).searchParams.get('jobId'))
  if (!jobId) return NextResponse.json({ error: 'Gültige jobId erforderlich.' }, { status: 400 })

  try {
    const itinerary = await getTransportItinerary(user.id, jobId)
    return NextResponse.json({ ok: true, jobId, itinerary })
  } catch (error) {
    return handoverError(error)
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
  const commandId = body.commandId == null ? randomUUID() : uuid(body.commandId)
  if (!commandId) return NextResponse.json({ error: 'Ungültige commandId.' }, { status: 400 })

  try {
    if (action === 'transfer-connected') {
      const connectionId = uuid(body.connectionId)
      const sourceInventoryId = uuid(body.sourceInventoryId)
      const targetInventoryId = uuid(body.targetInventoryId)
      const resource = logisticsResource(body.resource)
      const amount = positiveInteger(body.amount)
      if (!connectionId || !sourceInventoryId || !targetInventoryId || !resource || !amount) {
        return NextResponse.json({ error: 'Ungültige Cargo-Handover-Parameter.' }, { status: 400 })
      }
      const transfer = await transferConnectedCargo({
        commandId,
        actorProfileId: user.id,
        connectionId,
        sourceInventoryId,
        targetInventoryId,
        resource,
        amount,
      })
      return NextResponse.json({ ok: true, commandId, transfer })
    }

    if (action === 'define-itinerary') {
      const jobId = uuid(body.jobId)
      const rawLegs = Array.isArray(body.legs) ? body.legs : null
      const rawHandovers = Array.isArray(body.handovers) ? body.handovers : null
      if (!jobId || !rawLegs || !rawHandovers) {
        return NextResponse.json({ error: 'jobId, legs und handovers sind erforderlich.' }, { status: 400 })
      }

      const legs = rawLegs.map((value, index) => {
        const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
        return {
          sequenceNo: Number.isInteger(Number(row.sequenceNo)) ? Number(row.sequenceNo) : index,
          domain: transportDomain(row.domain),
          sourceInventoryId: uuid(row.sourceInventoryId),
          destinationInventoryId: uuid(row.destinationInventoryId),
          vehicleInventoryId: row.vehicleInventoryId == null ? null : uuid(row.vehicleInventoryId),
          routeSnapshot: row.routeSnapshot && typeof row.routeSnapshot === 'object' && !Array.isArray(row.routeSnapshot)
            ? row.routeSnapshot as Record<string, unknown>
            : {},
        }
      })
      if (legs.some(leg => leg.sequenceNo < 0 || !leg.domain || !leg.sourceInventoryId || !leg.destinationInventoryId)) {
        return NextResponse.json({ error: 'Ungültige Transport-Leg-Definition.' }, { status: 400 })
      }

      const handovers = rawHandovers.map((value, index) => {
        const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
        return {
          sequenceNo: Number.isInteger(Number(row.sequenceNo)) ? Number(row.sequenceNo) : index,
          sourceInventoryId: uuid(row.sourceInventoryId),
          targetInventoryId: uuid(row.targetInventoryId),
          resource: logisticsResource(row.resource),
          amount: positiveInteger(row.amount),
          requiresDocking: row.requiresDocking === true,
          dockingConnectionId: row.dockingConnectionId == null ? null : uuid(row.dockingConnectionId),
        }
      })
      if (handovers.some(h => h.sequenceNo < 0 || !h.sourceInventoryId || !h.targetInventoryId || !h.resource || !h.amount || (h.requiresDocking && !h.dockingConnectionId))) {
        return NextResponse.json({ error: 'Ungültige Cargo-Handover-Definition.' }, { status: 400 })
      }

      const result = await defineTransportItinerary({
        commandId,
        actorProfileId: user.id,
        jobId,
        legs: legs.map(leg => ({
          sequenceNo: leg.sequenceNo,
          domain: leg.domain!,
          sourceInventoryId: leg.sourceInventoryId!,
          destinationInventoryId: leg.destinationInventoryId!,
          vehicleInventoryId: leg.vehicleInventoryId,
          routeSnapshot: leg.routeSnapshot,
        })),
        handovers: handovers.map(h => ({
          sequenceNo: h.sequenceNo,
          sourceInventoryId: h.sourceInventoryId!,
          targetInventoryId: h.targetInventoryId!,
          resource: h.resource!,
          amount: h.amount!,
          requiresDocking: h.requiresDocking,
          dockingConnectionId: h.dockingConnectionId,
        })),
      })
      return NextResponse.json({ ok: true, commandId, ...result })
    }

    return NextResponse.json({ error: 'Ungültige Handover-Aktion.' }, { status: 400 })
  } catch (error) {
    return handoverError(error)
  }
}
