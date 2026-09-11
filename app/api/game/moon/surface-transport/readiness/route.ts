import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlayerVehicleSnapshot } from '@/lib/game/core/vehicleInstances'
import { getMoonSurfaceEngineeringProfile } from '@/lib/game/moonSurfaceEngineering'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
}

function inventoryId(snapshot: Record<string, unknown> | null) {
  const id = snapshot?.id
  return typeof id === 'string' && UUID_RE.test(id) ? id : null
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

  const vehicleId = typeof body.vehicleId === 'string' && UUID_RE.test(body.vehicleId) ? body.vehicleId : null
  if (!vehicleId) return NextResponse.json({ error: 'Ungültige vehicleId.' }, { status: 400 })

  try {
    const snapshot = await getPlayerVehicleSnapshot(user.id, vehicleId)
    if (!snapshot) return NextResponse.json({ error: 'Fahrzeug nicht gefunden.', code: 'VEHICLE_NOT_FOUND' }, { status: 404 })

    const profile = getMoonSurfaceEngineeringProfile(snapshot.vehicle.frame_id)
    const cargoInventoryId = inventoryId(snapshot.inventory)

    if (!profile) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'ENGINEERING_FRAME_UNAVAILABLE',
        error: 'Für diesen Fahrzeug-Frame liegen noch keine kanonischen Moon-Surface-Engineeringwerte vor.',
        frameId: snapshot.vehicle.frame_id,
        vehicleInventoryId: cargoInventoryId,
        engineeringRequest: 'EXT-NOXIA-ENG-20260911-LUNAR-SURFACE-LOGISTICS',
      }, { status: 409 })
    }

    if (!cargoInventoryId) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'VEHICLE_CARGO_INVENTORY_UNRESOLVED',
        error: 'Das Fahrzeug besitzt noch kein auflösbares Cargo-Inventar.',
        frameId: snapshot.vehicle.frame_id,
      }, { status: 409 })
    }

    return NextResponse.json({
      ok: true,
      ready: true,
      frameId: profile.frameId,
      role: profile.role,
      cargoCapacityT: profile.cargoCapacityT,
      vehicleInventoryId: cargoInventoryId,
      allowedRouteClasses: profile.allowedRouteClasses,
      source: profile.source,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('NOXIA_VEHICLE_FORBIDDEN')) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Fahrzeug.', code: 'FORBIDDEN' }, { status: 403 })
    }
    console.error('moon surface transport readiness failed:', message)
    return NextResponse.json({ error: 'Moon-Surface-Freigabe konnte nicht geprüft werden.' }, { status: 500 })
  }
}
