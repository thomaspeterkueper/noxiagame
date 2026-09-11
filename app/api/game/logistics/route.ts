import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  LOGISTICS_RESOURCES,
  TRANSPORT_DOMAINS,
  TRANSPORT_STATUSES,
  cancelTransportJob,
  completeTransportJob,
  createTransportJob,
  getAccessibleInventorySnapshot,
  getPlayerTransportJob,
  listAccessibleInventories,
  listPlayerTransportJobs,
  startTransportJob,
  transferCargo,
  type LogisticsResource,
  type RouteSnapshot,
  type TransportDomain,
  type TransportStatus,
} from '@/lib/game/core/logistics'

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

function resource(value: unknown): LogisticsResource | null {
  return typeof value === 'string' && (LOGISTICS_RESOURCES as readonly string[]).includes(value)
    ? value as LogisticsResource
    : null
}

function domain(value: unknown): TransportDomain | null {
  const candidate = value == null || value === '' ? 'surface' : value
  return typeof candidate === 'string' && (TRANSPORT_DOMAINS as readonly string[]).includes(candidate)
    ? candidate as TransportDomain
    : null
}

function status(value: unknown): TransportStatus | null {
  return typeof value === 'string' && (TRANSPORT_STATUSES as readonly string[]).includes(value)
    ? value as TransportStatus
    : null
}

function routeSnapshot(value: unknown): RouteSnapshot | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as RouteSnapshot
    : null
}

function logisticsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('NOXIA_INVENTORY_NOT_FOUND')) return NextResponse.json({ error: 'Inventar nicht gefunden.', code: 'INVENTORY_NOT_FOUND' }, { status: 404 })
  if (message.includes('NOXIA_TRANSPORT_JOB_NOT_FOUND')) return NextResponse.json({ error: 'Transportauftrag nicht gefunden.', code: 'TRANSPORT_JOB_NOT_FOUND' }, { status: 404 })
  if (message.includes('FORBIDDEN')) return NextResponse.json({ error: 'Kein Zugriff auf diesen Logistikknoten.', code: 'FORBIDDEN' }, { status: 403 })
  if (message.includes('NOXIA_TRANSPORT_ROUTE_ETA_REQUIRED')) return NextResponse.json({ error: 'Für den Transport fehlt eine gültige Fahrzeit (routeSnapshot.etaSeconds).', code: 'ROUTE_ETA_REQUIRED' }, { status: 409 })
  if (message.includes('NOXIA_TRANSPORT_ROUTE_NOT_PASSABLE')) return NextResponse.json({ error: 'Die übergebene Route ist nicht passierbar.', code: 'ROUTE_NOT_PASSABLE' }, { status: 409 })
  if (message.includes('NOXIA_TRANSPORT_VEHICLE_BUSY')) return NextResponse.json({ error: 'Das Fahrzeug ist bereits einem aktiven Transport zugewiesen.', code: 'VEHICLE_BUSY' }, { status: 409 })
  if (message.includes('NOXIA_TRANSPORT_VEHICLE_UNAVAILABLE')) return NextResponse.json({ error: 'Das Fahrzeug ist derzeit nicht verfügbar.', code: 'VEHICLE_UNAVAILABLE' }, { status: 409 })
  if (message.includes('NOXIA_TRANSPORT_VEHICLE_WRONG_LOCATION')) return NextResponse.json({ error: 'Das Fahrzeug befindet sich nicht am Ausgangsstandort des Transports.', code: 'VEHICLE_WRONG_LOCATION' }, { status: 409 })
  if (message.includes('NOXIA_TRANSPORT_VEHICLE_REQUIRED')) return NextResponse.json({ error: 'Für diesen Transport ist ein Fahrzeug erforderlich.', code: 'VEHICLE_REQUIRED' }, { status: 409 })
  if (message.includes('NOXIA_TRANSPORT_VEHICLE_CAPACITY_INSUFFICIENT')) return NextResponse.json({ error: 'Die Fahrzeugkapazität reicht nicht aus.', code: 'VEHICLE_CAPACITY' }, { status: 409 })
  if (message.includes('NOXIA_INVENTORY_AVAILABLE_INSUFFICIENT') || message.includes('NOXIA_INVENTORY_STOCK_INSUFFICIENT')) return NextResponse.json({ error: 'Am Quellinventar ist nicht genug frei verfügbare Ware vorhanden.', code: 'STOCK_INSUFFICIENT' }, { status: 409 })
  if (message.includes('NOXIA_INVENTORY_CAPACITY_INSUFFICIENT')) return NextResponse.json({ error: 'Das Zielinventar hat nicht genug freie Kapazität.', code: 'TARGET_CAPACITY' }, { status: 409 })
  if (message.includes('COMMAND_CONFLICT')) return NextResponse.json({ error: 'Die Command-ID wurde bereits mit anderen Parametern verwendet.', code: 'COMMAND_CONFLICT' }, { status: 409 })
  if (message.includes('STATE_INVALID') || message.includes('CANCEL_REQUIRES_RESERVED') || message.includes('NOT_ARRIVED')) return NextResponse.json({ error: 'Der Transport befindet sich nicht im erforderlichen Zustand.', code: 'STATE_INVALID' }, { status: 409 })

  console.error('logistics command failed:', message)
  return NextResponse.json({ error: 'Logistikvorgang fehlgeschlagen.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const inventoryIdParam = searchParams.get('inventoryId')
  const jobIdParam = searchParams.get('jobId')
  const locationIdParam = searchParams.get('locationId')
  const statusParam = searchParams.get('status')

  try {
    if (inventoryIdParam) {
      const inventoryId = uuid(inventoryIdParam)
      if (!inventoryId) return NextResponse.json({ error: 'Ungültige inventoryId.' }, { status: 400 })
      const inventory = await getAccessibleInventorySnapshot(user.id, inventoryId)
      return NextResponse.json({ ok: true, inventory })
    }

    if (jobIdParam) {
      const jobId = uuid(jobIdParam)
      if (!jobId) return NextResponse.json({ error: 'Ungültige jobId.' }, { status: 400 })
      const job = await getPlayerTransportJob(user.id, jobId)
      if (!job) return NextResponse.json({ error: 'Transportauftrag nicht gefunden.' }, { status: 404 })
      return NextResponse.json({ ok: true, job })
    }

    const locationId = locationIdParam ? uuid(locationIdParam) : null
    if (locationIdParam && !locationId) return NextResponse.json({ error: 'Ungültige locationId.' }, { status: 400 })
    const requestedStatus = statusParam ? status(statusParam) : null
    if (statusParam && !requestedStatus) return NextResponse.json({ error: 'Ungültiger Transportstatus.' }, { status: 400 })

    const [inventories, jobs] = await Promise.all([
      listAccessibleInventories(user.id, locationId),
      listPlayerTransportJobs(user.id, { locationId, status: requestedStatus }),
    ])
    return NextResponse.json({ ok: true, inventories, jobs })
  } catch (error) {
    return logisticsError(error)
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

  try {
    if (action === 'transfer') {
      const sourceInventoryId = uuid(body.sourceInventoryId)
      const targetInventoryId = uuid(body.targetInventoryId)
      const cargoResource = resource(body.resource)
      const amount = positiveInteger(body.amount)
      const commandId = body.commandId == null ? randomUUID() : uuid(body.commandId)
      if (!sourceInventoryId || !targetInventoryId || !cargoResource || !amount || !commandId) {
        return NextResponse.json({ error: 'Ungültige Cargo-Transfer-Parameter.' }, { status: 400 })
      }

      const result = await transferCargo({
        commandId,
        actorProfileId: user.id,
        sourceInventoryId,
        targetInventoryId,
        resource: cargoResource,
        amount,
      })
      return NextResponse.json({ ok: true, commandId, transfer: result })
    }

    if (action === 'create-job') {
      const sourceInventoryId = uuid(body.sourceInventoryId)
      const destinationInventoryId = uuid(body.destinationInventoryId)
      const vehicleInventoryId = body.vehicleInventoryId == null ? null : uuid(body.vehicleInventoryId)
      const locationId = body.locationId == null ? null : uuid(body.locationId)
      const cargoResource = resource(body.resource)
      const amount = positiveInteger(body.amount)
      const transportDomain = domain(body.domain)
      const snapshot = routeSnapshot(body.routeSnapshot)
      const commandId = body.commandId == null ? randomUUID() : uuid(body.commandId)
      const vehicleRole = body.vehicleRole == null ? null : String(body.vehicleRole).trim().slice(0, 80)

      if (!sourceInventoryId || !destinationInventoryId || !cargoResource || !amount || !transportDomain || !snapshot || !commandId) {
        return NextResponse.json({ error: 'Ungültige TransportJob-Parameter.' }, { status: 400 })
      }
      if (body.vehicleInventoryId != null && !vehicleInventoryId) return NextResponse.json({ error: 'Ungültige vehicleInventoryId.' }, { status: 400 })
      if (body.locationId != null && !locationId) return NextResponse.json({ error: 'Ungültige locationId.' }, { status: 400 })
      if (transportDomain === 'surface' && snapshot.passable !== true) {
        return NextResponse.json({ error: 'Surface-Transport benötigt ein passierbares Route-Assessment.', code: 'ROUTE_NOT_PASSABLE' }, { status: 409 })
      }

      const job = await createTransportJob({
        commandId,
        actorProfileId: user.id,
        locationId,
        domain: transportDomain,
        sourceInventoryId,
        destinationInventoryId,
        vehicleInventoryId,
        vehicleRole: vehicleRole || null,
        resource: cargoResource,
        amount,
        routeSnapshot: snapshot,
      })
      return NextResponse.json({ ok: true, commandId, job })
    }

    if (action === 'start-job' || action === 'complete-job' || action === 'cancel-job') {
      const jobId = uuid(body.jobId)
      if (!jobId) return NextResponse.json({ error: 'Ungültige jobId.' }, { status: 400 })

      if (action === 'start-job') {
        const job = await startTransportJob(user.id, jobId)
        return NextResponse.json({ ok: true, job })
      }
      if (action === 'complete-job') {
        const job = await completeTransportJob(user.id, jobId)
        return NextResponse.json({ ok: true, job })
      }
      const job = await cancelTransportJob(user.id, jobId)
      return NextResponse.json({ ok: true, job })
    }

    return NextResponse.json({ error: 'Ungültige Logistik-Aktion.' }, { status: 400 })
  } catch (error) {
    return logisticsError(error)
  }
}
