import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  getPlayerVehicleSnapshot,
  listPlayerVehicleInstances,
  projectPersistedVehicle,
} from '@/lib/game/core/vehicleInstances'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
}

function uuid(value: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null
}

function vehicleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_VEHICLE_FORBIDDEN')) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Fahrzeug.', code: 'FORBIDDEN' }, { status: 403 })
  }
  if (message.includes('NOXIA_VEHICLE_NOT_FOUND')) {
    return NextResponse.json({ error: 'Fahrzeug nicht gefunden.', code: 'VEHICLE_NOT_FOUND' }, { status: 404 })
  }
  console.error('vehicle query failed:', message)
  return NextResponse.json({ error: 'Fahrzeugzustand konnte nicht geladen werden.' }, { status: 500 })
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
