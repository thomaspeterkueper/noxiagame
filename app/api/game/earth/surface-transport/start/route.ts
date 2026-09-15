import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createAndStartTransportJobAtomic } from '@/lib/game/core/atomicTransportStart'
import { getPlayerVehicleSnapshot } from '@/lib/game/core/vehicleInstances'
import {
  buildAuthoritativeEarthSurfaceMissionDraft,
  EarthSurfaceMissionDraftError,
  parseEarthSurfaceMissionIntent,
} from '@/lib/game/earthSurfaceMissionDraftServer'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
}

function sameExistingIntent(
  row: Record<string, unknown>,
  input: {
    actorProfileId: string
    sourceInventoryId: string
    destinationInventoryId: string
    vehicleInventoryId: string
    resource: string
    amount: number
  },
) {
  return row.actor_profile_id === input.actorProfileId
    && row.domain === 'surface'
    && row.source_inventory_id === input.sourceInventoryId
    && row.destination_inventory_id === input.destinationInventoryId
    && row.vehicle_inventory_id === input.vehicleInventoryId
    && row.resource === input.resource
    && Number(row.amount) === input.amount
}

function atomicError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_TRANSPORT_COMMAND_CONFLICT')) {
    return NextResponse.json({ ok: false, code: 'COMMAND_CONFLICT', error: 'Diese commandId ist bereits an einen anderen Transport gebunden.' }, { status: 409 })
  }
  if (message.includes('NOXIA_TRANSPORT_VEHICLE_BUSY')) {
    return NextResponse.json({ ok: false, code: 'VEHICLE_BUSY', error: 'Das Fahrzeug ist inzwischen einem anderen Transport zugeordnet.' }, { status: 409 })
  }
  if (message.includes('NOXIA_INVENTORY_AVAILABLE_INSUFFICIENT') || message.includes('NOXIA_INVENTORY_STOCK_INSUFFICIENT')) {
    return NextResponse.json({ ok: false, code: 'CARGO_STOCK_CHANGED', error: 'Der verfügbare Quellbestand hat sich seit der Prüfung geändert.' }, { status: 409 })
  }
  if (message.includes('NOXIA_TRANSPORT_VEHICLE_CAPACITY_INSUFFICIENT') || message.includes('NOXIA_INVENTORY_CAPACITY_INSUFFICIENT')) {
    return NextResponse.json({ ok: false, code: 'CAPACITY_CHANGED', error: 'Die verfügbare Transport- oder Zielkapazität hat sich seit der Prüfung geändert.' }, { status: 409 })
  }
  if (message.includes('NOXIA_TRANSPORT_ROUTE_ETA_REQUIRED') || message.includes('NOXIA_TRANSPORT_ROUTE_NOT_PASSABLE')) {
    return NextResponse.json({ ok: false, code: 'ROUTE_SNAPSHOT_REJECTED', error: 'Der Core hat den frisch berechneten Route-Snapshot abgelehnt.' }, { status: 409 })
  }
  console.error('earth atomic transport start failed:', message)
  return NextResponse.json({ ok: false, error: 'Earth-Transport konnte nicht atomar gestartet werden.' }, { status: 500 })
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

  let intent
  try {
    intent = parseEarthSurfaceMissionIntent(body)
  } catch (error) {
    if (error instanceof EarthSurfaceMissionDraftError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message, ...error.details }, { status: error.status })
    }
    throw error
  }

  const suppliedCommandId = typeof body.commandId === 'string' ? body.commandId : null
  if (suppliedCommandId && !UUID_RE.test(suppliedCommandId)) {
    return NextResponse.json({ error: 'Ungültige commandId.' }, { status: 400 })
  }
  const commandId = suppliedCommandId ?? randomUUID()
  const supabase = createServiceClient()

  try {
    // A network retry after a successful atomic start must remain idempotent even
    // though the vehicle is now busy and a newly calculated draft would correctly
    // reject it. Resolve the existing command before rebuilding the mission.
    const [{ data: existing, error: existingError }, vehicleSnapshot] = await Promise.all([
      supabase.from('transport_jobs').select('*').eq('command_id', commandId).maybeSingle(),
      getPlayerVehicleSnapshot(user.id, intent.vehicleId),
    ])
    if (existingError) throw existingError
    if (!vehicleSnapshot) {
      return NextResponse.json({ ok: false, code: 'VEHICLE_NOT_FOUND', error: 'Fahrzeug nicht gefunden.' }, { status: 404 })
    }
    const vehicleInventoryId = (vehicleSnapshot.inventory as Record<string, unknown> | null)?.id
    if (typeof vehicleInventoryId !== 'string') {
      return NextResponse.json({ ok: false, code: 'VEHICLE_CARGO_INVENTORY_UNRESOLVED', error: 'Das Fahrzeug besitzt kein auflösbares Cargo-Inventar.' }, { status: 409 })
    }

    if (existing) {
      if (!sameExistingIntent(existing as Record<string, unknown>, {
        actorProfileId: user.id,
        sourceInventoryId: intent.sourceInventoryId,
        destinationInventoryId: intent.destinationInventoryId,
        vehicleInventoryId,
        resource: intent.resource,
        amount: intent.amount,
      })) {
        return NextResponse.json({ ok: false, code: 'COMMAND_CONFLICT', error: 'Diese commandId ist bereits an einen anderen Transport gebunden.' }, { status: 409 })
      }
      return NextResponse.json({
        ok: true,
        started: existing.status === 'in_transit',
        idempotent: true,
        commandId,
        job: existing,
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
    }

    // Recalculate the complete physical mission immediately before mutation.
    // No route, ETA, cargo mass or Engineering values are accepted from the client.
    const draft = await buildAuthoritativeEarthSurfaceMissionDraft(user.id, intent)
    const job = await createAndStartTransportJobAtomic({
      commandId,
      actorProfileId: user.id,
      locationId: draft.locationId,
      sourceInventoryId: draft.sourceInventoryId,
      destinationInventoryId: draft.destinationInventoryId,
      vehicleInventoryId: draft.vehicleInventoryId,
      vehicleRole: draft.vehicleRole,
      resource: draft.resource,
      amount: draft.amount,
      routeSnapshot: draft.routeSnapshot,
    })

    return NextResponse.json({
      ok: true,
      started: true,
      idempotent: Boolean(job.idempotent),
      commandId,
      job,
      draft: {
        routeId: draft.routeId,
        frameId: draft.frameId,
        engineeringSourceId: draft.engineeringSourceId,
        cargo: draft.cargo,
        estimate: draft.estimate,
      },
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    if (error instanceof EarthSurfaceMissionDraftError) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: error.code,
        error: error.message,
        ...error.details,
      }, { status: error.status })
    }
    return atomicError(error)
  }
}
