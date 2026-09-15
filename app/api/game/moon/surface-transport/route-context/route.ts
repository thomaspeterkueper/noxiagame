import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { listAccessibleInventories } from '@/lib/game/core/logistics'
import { resolveSurfaceLogisticsEndpoints } from '@/lib/game/vehicles/surfaceLogisticsNodes'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const sourceInventoryId = typeof body.sourceInventoryId === 'string' && UUID_RE.test(body.sourceInventoryId)
    ? body.sourceInventoryId
    : null
  const destinationInventoryId = typeof body.destinationInventoryId === 'string' && UUID_RE.test(body.destinationInventoryId)
    ? body.destinationInventoryId
    : null

  if (!sourceInventoryId || !destinationInventoryId || sourceInventoryId === destinationInventoryId) {
    return NextResponse.json({ error: 'Ungültige oder identische Surface-Endpunkte.' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id,slug,name')
      .eq('slug', 'moon')
      .maybeSingle()
    if (locationError) throw locationError
    if (!location) return NextResponse.json({ error: 'Moon-Standort nicht gefunden.', code: 'MOON_LOCATION_UNRESOLVED' }, { status: 409 })

    const [inventories, frameResult, entitiesResult] = await Promise.all([
      listAccessibleInventories(user.id, location.id),
      supabase.from('world_frames').select('*').eq('location_id', location.id).maybeSingle(),
      supabase.from('tile_entities')
        .select('id,entity_id,x_m,y_m')
        .eq('location_id', location.id)
        .in('entity_type', ['building', 'module']),
    ])

    if (frameResult.error) throw frameResult.error
    if (entitiesResult.error) throw entitiesResult.error

    const source = inventories.find(item => item.id === sourceInventoryId)
    const destination = inventories.find(item => item.id === destinationInventoryId)
    if (!source || !destination) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'SURFACE_ENDPOINT_INACCESSIBLE',
        error: 'Quelle oder Ziel ist am Moon-Standort nicht zugänglich.',
      }, { status: 403 })
    }
    if (source.inventory_kind === 'vehicle' || destination.inventory_kind === 'vehicle') {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'SURFACE_ENDPOINT_KIND_UNSUPPORTED',
        error: 'Fahrzeuginventare sind keine festen Surface-Routenendpunkte.',
      }, { status: 409 })
    }

    const frame = frameResult.data
    if (!frame
      || frame.origin_status !== 'verified'
      || frame.origin_lat_deg == null
      || frame.origin_lon_deg == null
      || frame.origin_alt_m == null) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'WORLD_FRAME_UNRESOLVED',
        error: 'Der Moon-World-Frame ist für Terrain-Routing noch nicht vollständig verifiziert.',
      }, { status: 409 })
    }

    if (!frame.terrain_dataset_id) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'TERRAIN_DATASET_UNRESOLVED',
        error: 'Dem Moon-World-Frame ist kein Terrain-Datensatz zugeordnet.',
      }, { status: 409 })
    }

    const { data: dataset, error: datasetError } = await supabase
      .from('terrain_datasets')
      .select('id,dataset_name,status,resolution_m')
      .eq('id', frame.terrain_dataset_id)
      .maybeSingle()
    if (datasetError) throw datasetError
    if (!dataset || dataset.status !== 'ready') {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'TERRAIN_DATASET_NOT_READY',
        error: 'Der zugeordnete Moon-Terrain-Datensatz ist noch nicht sampling-bereit.',
        terrainDatasetId: frame.terrain_dataset_id,
      }, { status: 409 })
    }

    const endpoints = resolveSurfaceLogisticsEndpoints(source, destination, entitiesResult.data ?? [])
    if (endpoints.status === 'unresolved') {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'SURFACE_ENDPOINT_COORDINATES_UNRESOLVED',
        error: 'Quelle oder Ziel besitzt noch keine kanonische lokale Surface-Koordinate.',
        reason: endpoints.reason,
        sourceInventoryId,
        destinationInventoryId,
      }, { status: 409 })
    }

    return NextResponse.json({
      ok: true,
      ready: true,
      location,
      frame: {
        id: frame.id,
        body: frame.body,
        originStatus: frame.origin_status,
        terrainDatasetId: frame.terrain_dataset_id,
      },
      terrain: {
        id: dataset.id,
        name: dataset.dataset_name,
        status: dataset.status,
        resolutionM: dataset.resolution_m,
      },
      source: {
        inventoryId: source.id,
        label: source.label,
        point: endpoints.origin.point,
        coordinateSource: endpoints.origin.source,
        spatialEntityId: endpoints.origin.spatialEntityId,
      },
      destination: {
        inventoryId: destination.id,
        label: destination.label,
        point: endpoints.destination.point,
        coordinateSource: endpoints.destination.source,
        spatialEntityId: endpoints.destination.spatialEntityId,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('moon surface route context failed:', message)
    return NextResponse.json({ error: 'Moon-Surface-Routenkontext konnte nicht aufgelöst werden.' }, { status: 500 })
  }
}
