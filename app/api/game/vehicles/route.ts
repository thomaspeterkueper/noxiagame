import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  getPlayerVehicleSnapshot,
  listPlayerVehicleInstances,
  projectPersistedVehicle,
  provisionStarterCargoRoverCommand,
} from '@/lib/game/core/vehicleInstances'

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

function vehicleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_VEHICLE_FORBIDDEN')) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Fahrzeug.', code: 'FORBIDDEN' }, { status: 403 })
  }
  if (message.includes('NOXIA_VEHICLE_NOT_FOUND')) {
    return NextResponse.json({ error: 'Fahrzeug nicht gefunden.', code: 'VEHICLE_NOT_FOUND' }, { status: 404 })
  }
  if (message.includes('NOXIA_PROFILE_NOT_FOUND')) {
    return NextResponse.json({ error: 'Spielerprofil nicht gefunden.', code: 'PROFILE_NOT_FOUND' }, { status: 404 })
  }
  if (message.includes('NOXIA_STARTER_CARGO_ROVER_LOCATION_UNSUPPORTED')) {
    return NextResponse.json({ error: 'Der Starter-Cargo-Rover kann derzeit nur am verifizierten Mond-/Shackleton-Standort bereitgestellt werden.', code: 'STARTER_LOCATION_UNSUPPORTED' }, { status: 409 })
  }
  if (message.includes('NOXIA_VEHICLE_PROVISION_COMMAND_CONFLICT')) {
    return NextResponse.json({ error: 'Die Command-ID wurde bereits mit anderen Provisionierungsparametern verwendet.', code: 'COMMAND_CONFLICT' }, { status: 409 })
  }
  console.error('vehicle command failed:', message)
  return NextResponse.json({ error: 'Fahrzeugvorgang fehlgeschlagen.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const vehicleIdParam = searchParams.get('vehicleId')
  const locationIdParam = searchParams.get('locationId')

  try {
    if (vehicleIdParam) {
      const vehicleId = uuid(vehicleIdParam)
      if (!vehicleId) return NextResponse.json({ error: 'Ungültige vehicleId.' }, { status: 400 })
      const snapshot = await getPlayerVehicleSnapshot(user.id, vehicleId)
      if (!snapshot) return NextResponse.json({ error: 'Fahrzeug nicht gefunden.' }, { status: 404 })
      return NextResponse.json({
        ok: true,
        vehicle: projectPersistedVehicle(snapshot.vehicle),
        persistence: snapshot.vehicle,
        inventory: snapshot.inventory,
        activeTransportJob: snapshot.activeTransportJob,
      })
    }

    const locationId = locationIdParam ? uuid(locationIdParam) : null
    if (locationIdParam && !locationId) {
      return NextResponse.json({ error: 'Ungültige locationId.' }, { status: 400 })
    }

    const persisted = await listPlayerVehicleInstances(user.id, locationId)
    return NextResponse.json({
      ok: true,
      vehicles: persisted.map(row => ({
        ...projectPersistedVehicle(row),
        label: row.label,
        cargoCapacityT: row.cargo_capacity_t,
        currentNodeInventoryId: row.current_node_inventory_id,
        canonicalKey: row.canonical_key,
        updatedAt: row.updated_at,
      })),
    })
  } catch (error) {
    return vehicleError(error)
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
  if (action !== 'provision-starter-cargo-rover') {
    return NextResponse.json({ error: 'Ungültige Fahrzeug-Aktion.' }, { status: 400 })
  }

  const locationId = uuid(body.locationId)
  const commandId = body.commandId == null ? randomUUID() : uuid(body.commandId)
  if (!locationId || !commandId) {
    return NextResponse.json({ error: 'Ungültige Provisionierungsparameter.' }, { status: 400 })
  }

  try {
    const provisioning = await provisionStarterCargoRoverCommand({
      commandId,
      actorProfileId: user.id,
      locationId,
    })
    return NextResponse.json({ ok: true, commandId, provisioning })
  } catch (error) {
    return vehicleError(error)
  }
}
