import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  getAccessibleInventorySnapshot,
  LOGISTICS_RESOURCES,
  type LogisticsResource,
} from '@/lib/game/core/logistics'
import { resolveAuthoritativeLogisticsCargoMass } from '@/lib/game/core/logisticsCargoMassAuthority'
import { getPlayerVehicleSnapshot, projectPersistedVehicle } from '@/lib/game/core/vehicleInstances'
import { resolveEarthSurfaceEngineeringProfile } from '@/lib/game/earthSurfaceEngineering'
import { buildEarthSurfaceMissionPlan } from '@/lib/game/earthSurfaceMission'
import { attachEarthSurfaceRouteGeometry } from '@/lib/game/earthSurfaceRouteGeometry'
import { planEarthSurfaceRoute } from '@/lib/game/earthSurfaceRouting'
import type { EarthSurfaceVehicleRole } from '@/lib/game/earthSurfaceLogistics'
import { prepareProspectiveSurfaceMission } from '@/lib/game/vehicles/surfaceMissionDraft'
import { OverpassEarthFeatureSource } from '@/lib/world/spatial/overpassEarthFeatureSource'
import {
  geoToLocalMeters,
  localMetersToGeo,
  validateGeoPoint,
  type GeoPoint,
} from '@/lib/world/spatial/earthSpatial'
import { EARTH_SAUERLAND_REGION, getEarthRegion } from '@/lib/world/spatial/regions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_LOCAL_ROUTE_DISTANCE_M = 10_500
const MAX_OVERPASS_RADIUS_KM = 6
const earthFeatures = new OverpassEarthFeatureSource()

function uuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

function resource(value: unknown): LogisticsResource | null {
  return typeof value === 'string' && (LOGISTICS_RESOURCES as readonly string[]).includes(value)
    ? value as LogisticsResource
    : null
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function finite(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function inventoryItems(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return []
  const items = (snapshot as Record<string, unknown>).items
  return Array.isArray(items)
    ? items.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[]
    : []
}

function canonicalEarthGeo(row: Record<string, unknown>): GeoPoint | null {
  const lat = finite(row.latitude_deg)
  const lon = finite(row.longitude_deg)
  if (lat != null && lon != null) {
    try {
      return validateGeoPoint({ lat, lon, elevationM: finite(row.altitude_m) })
    } catch {
      return null
    }
  }

  const xM = finite(row.x_m)
  const yM = finite(row.y_m)
  if (xM == null || yM == null) return null
  const region = getEarthRegion(String(row.spatial_region_id ?? '')) ?? EARTH_SAUERLAND_REGION
  try {
    return localMetersToGeo({ eastM: xM, northM: yM }, region.origin)
  } catch {
    return null
  }
}

function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const local = geoToLocalMeters(b, a)
  return Math.hypot(local.eastM, local.northM)
}

function routeBounds(source: GeoPoint, destination: GeoPoint) {
  const center = {
    lat: (source.lat + destination.lat) / 2,
    lon: (source.lon + destination.lon) / 2,
  }
  const directDistanceM = distanceMeters(source, destination)
  const radiusKm = Math.min(MAX_OVERPASS_RADIUS_KM, Math.max(.6, directDistanceM / 2000 + .75))
  const latDelta = radiusKm / 111.32
  const cosLat = Math.max(.05, Math.abs(Math.cos(center.lat * Math.PI / 180)))
  const lonDelta = radiusKm / (111.32 * cosLat)
  return {
    directDistanceM,
    radiusKm,
    bounds: {
      south: center.lat - latDelta,
      west: center.lon - lonDelta,
      north: center.lat + latDelta,
      east: center.lon + lonDelta,
    },
  }
}

function vehicleRole(value: string): EarthSurfaceVehicleRole | null {
  return value === 'cargo-rover' || value === 'heavy-hauler' ? value : null
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
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

  const sourceInventoryId = uuid(body.sourceInventoryId)
  const destinationInventoryId = uuid(body.destinationInventoryId)
  const vehicleId = uuid(body.vehicleId)
  const cargoResource = resource(body.resource)
  const amount = positiveInteger(body.amount)
  if (!sourceInventoryId || !destinationInventoryId || !vehicleId || !cargoResource || !amount) {
    return NextResponse.json({ error: 'Ungültige Mission-Draft-Parameter.' }, { status: 400 })
  }
  if (sourceInventoryId === destinationInventoryId) {
    return NextResponse.json({ error: 'Quelle und Ziel müssen verschieden sein.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    const [sourceSnapshot, destinationSnapshot, vehicleSnapshot, inventoryResult] = await Promise.all([
      getAccessibleInventorySnapshot(user.id, sourceInventoryId),
      getAccessibleInventorySnapshot(user.id, destinationInventoryId),
      getPlayerVehicleSnapshot(user.id, vehicleId),
      supabase
        .from('logistics_inventories')
        .select('id,location_id,subject_type,subject_id,active')
        .in('id', [sourceInventoryId, destinationInventoryId]),
    ])

    if (!vehicleSnapshot) {
      return NextResponse.json({ ok: false, ready: false, code: 'VEHICLE_NOT_FOUND', error: 'Fahrzeug nicht gefunden.' }, { status: 404 })
    }
    if (inventoryResult.error) throw inventoryResult.error
    const inventories = inventoryResult.data ?? []
    const sourceInventory = inventories.find(row => row.id === sourceInventoryId)
    const destinationInventory = inventories.find(row => row.id === destinationInventoryId)
    if (!sourceInventory || !destinationInventory || !sourceInventory.active || !destinationInventory.active) {
      return NextResponse.json({ ok: false, ready: false, code: 'INVENTORY_UNAVAILABLE', error: 'Quelle oder Ziel ist nicht verfügbar.' }, { status: 409 })
    }
    if (!sourceInventory.location_id || sourceInventory.location_id !== destinationInventory.location_id) {
      return NextResponse.json({ ok: false, ready: false, code: 'LOCATION_MISMATCH', error: 'Quelle und Ziel müssen am selben Earth-Standort liegen.' }, { status: 409 })
    }
    if (sourceInventory.subject_type !== 'tile_entity' || destinationInventory.subject_type !== 'tile_entity'
      || !sourceInventory.subject_id || !destinationInventory.subject_id) {
      return NextResponse.json({ ok: false, ready: false, code: 'SPATIAL_NODE_REQUIRED', error: 'Quelle und Ziel müssen räumliche Earth-Inventarknoten sein.' }, { status: 409 })
    }

    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id,slug')
      .eq('id', sourceInventory.location_id)
      .maybeSingle()
    if (locationError) throw locationError
    if (!location || location.slug !== 'earth') {
      return NextResponse.json({ ok: false, ready: false, code: 'EARTH_LOCATION_REQUIRED', error: 'Surface-Mission-Drafts dieses Endpunkts sind nur für Earth zulässig.' }, { status: 409 })
    }

    const vehicle = vehicleSnapshot.vehicle
    if (vehicle.location_id !== location.id || vehicle.status !== 'ready') {
      return NextResponse.json({ ok: false, ready: false, code: 'VEHICLE_NOT_READY', error: 'Das Fahrzeug ist für diese Earth-Mission nicht bereit.' }, { status: 409 })
    }
    if (vehicle.current_node_inventory_id !== sourceInventoryId) {
      return NextResponse.json({ ok: false, ready: false, code: 'VEHICLE_NOT_AT_SOURCE', error: 'Das Fahrzeug muss explizit am gewählten Quellknoten gestaged sein.' }, { status: 409 })
    }
    if (vehicleSnapshot.activeTransportJob) {
      return NextResponse.json({ ok: false, ready: false, code: 'VEHICLE_BUSY', error: 'Das Fahrzeug ist bereits einem aktiven Transport zugeordnet.' }, { status: 409 })
    }

    const profile = resolveEarthSurfaceEngineeringProfile(vehicle.frame_id)
    if (profile.status === 'unresolved') {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'ENGINEERING_FRAME_UNAVAILABLE',
        error: 'Für diesen Fahrzeug-Frame liegt kein freigegebenes Earth-Surface-Profil vor.',
        reason: profile.reason,
        details: profile.details,
      }, { status: 409 })
    }
    const role = vehicleRole(profile.frame.role)
    if (!role) {
      return NextResponse.json({ ok: false, ready: false, code: 'EARTH_ROLE_UNSUPPORTED', error: 'Der Engineering-Frame besitzt keine unterstützte Earth-Routingrolle.' }, { status: 409 })
    }

    const sourceItem = inventoryItems(sourceSnapshot).find(item => item.resource === cargoResource)
    if (!sourceItem) {
      return NextResponse.json({ ok: false, ready: false, code: 'CARGO_STOCK_UNAVAILABLE', error: 'Die gewählte Ware ist am Quellinventar nicht vorhanden.' }, { status: 409 })
    }
    const availableRaw = sourceItem.available ?? sourceItem.amount
    const available = typeof availableRaw === 'number' ? availableRaw : Number(availableRaw)
    if (!Number.isFinite(available) || available < amount) {
      return NextResponse.json({ ok: false, ready: false, code: 'CARGO_STOCK_INSUFFICIENT', error: 'Die gewählte Menge ist am Quellinventar nicht frei verfügbar.', available: Number.isFinite(available) ? available : null }, { status: 409 })
    }
    const unit = typeof sourceItem.unit === 'string' && sourceItem.unit.trim() ? sourceItem.unit.trim() : null
    const cargoAuthority = resolveAuthoritativeLogisticsCargoMass({ commodityId: cargoResource, amount, unit })
    if (cargoAuthority.resolution.status !== 'resolved') {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'CARGO_MASS_UNRESOLVED',
        error: 'Für die gewählte Ware und Menge liegt noch keine autoritative physikalische Frachtmasse vor.',
        reason: cargoAuthority.resolution.reason,
        commodityId: cargoResource,
        amount,
        unit,
        engineeringRequest: 'EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS',
      }, { status: 409 })
    }

    const { data: entities, error: entityError } = await supabase
      .from('tile_entities')
      .select('id,location_id,status,x_m,y_m,latitude_deg,longitude_deg,altitude_m,spatial_region_id')
      .in('id', [sourceInventory.subject_id, destinationInventory.subject_id])
    if (entityError) throw entityError
    const sourceEntity = (entities ?? []).find(row => row.id === sourceInventory.subject_id) as Record<string, unknown> | undefined
    const destinationEntity = (entities ?? []).find(row => row.id === destinationInventory.subject_id) as Record<string, unknown> | undefined
    if (!sourceEntity || !destinationEntity || sourceEntity.status !== 'active' || destinationEntity.status !== 'active') {
      return NextResponse.json({ ok: false, ready: false, code: 'SPATIAL_NODE_UNAVAILABLE', error: 'Ein räumlicher Earth-Knoten ist nicht aktiv.' }, { status: 409 })
    }

    const sourcePoint = canonicalEarthGeo(sourceEntity)
    const destinationPoint = canonicalEarthGeo(destinationEntity)
    if (!sourcePoint || !destinationPoint) {
      return NextResponse.json({ ok: false, ready: false, code: 'SPATIAL_POSITION_UNRESOLVED', error: 'Quelle oder Ziel besitzt keine kanonisch auflösbare Earth-Position.' }, { status: 409 })
    }

    const window = routeBounds(sourcePoint, destinationPoint)
    if (window.directDistanceM > MAX_LOCAL_ROUTE_DISTANCE_M) {
      return NextResponse.json({ ok: false, ready: false, code: 'ROUTE_WINDOW_EXCEEDED', error: 'Die Mission liegt außerhalb des derzeitigen lokalen Earth-Routingfensters.', directDistanceM: window.directDistanceM }, { status: 409 })
    }

    const features = await earthFeatures.load({ bounds: window.bounds, classes: ['road'] })
    const route = planEarthSurfaceRoute({
      features,
      source: sourcePoint,
      destination: destinationPoint,
      vehicleRole: role,
    })
    if (!route.ok) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'EARTH_ROUTE_BLOCKED',
        error: 'Die serverseitig neu berechnete Earth-Route ist nicht freigegeben.',
        reason: route.reason,
        sourceSnap: route.sourceSnap ?? null,
        destinationSnap: route.destinationSnap ?? null,
      }, { status: 409 })
    }

    const routeId = `earth:${sourceInventoryId.slice(0, 8)}:${destinationInventoryId.slice(0, 8)}:${vehicleId.slice(0, 8)}:${cargoResource}:${amount}`
    const plan = buildEarthSurfaceMissionPlan({
      routeId,
      originInventoryId: sourceInventoryId,
      destinationInventoryId,
      route,
    })
    const projectedInstance = projectPersistedVehicle(vehicle)
    const draft = prepareProspectiveSurfaceMission({
      frame: profile.frame,
      instance: projectedInstance,
      operationProfile: profile.operationProfile,
      plan,
      projectedCargo: [cargoAuthority.resolution.cargo],
    })

    if (!draft.estimate.feasible || !draft.routeSnapshot) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'SURFACE_MISSION_INFEASIBLE',
        error: 'Der gemeinsame Surface-Mission-Vertrag blockiert diesen Draft.',
        estimate: draft.estimate,
      }, { status: 409 })
    }

    const regionId = String(sourceEntity.spatial_region_id ?? destinationEntity.spatial_region_id ?? '')
    const geometryRegion = getEarthRegion(regionId) ?? EARTH_SAUERLAND_REGION
    const routeSnapshot = {
      ...attachEarthSurfaceRouteGeometry(draft.routeSnapshot, route, geometryRegion.origin),
      earthSpatialRegionId: geometryRegion.id,
      earthSpatialOrigin: geometryRegion.origin,
      engineeringSourceId: profile.sourceId ?? null,
      cargoMassSource: cargoAuthority.source,
    }

    return NextResponse.json({
      ok: true,
      ready: true,
      routeId,
      vehicleId,
      vehicleInventoryId: (vehicleSnapshot.inventory as Record<string, unknown> | null)?.id ?? null,
      frameId: profile.frame.id,
      vehicleRole: role,
      engineeringSourceId: profile.sourceId ?? null,
      cargo: {
        resource: cargoResource,
        amount,
        unit,
        massKg: cargoAuthority.resolution.massKg,
        source: cargoAuthority.source,
      },
      route: {
        distanceM: route.distanceM,
        roadDistanceM: route.roadDistanceM,
        offroadDistanceM: route.offroadDistanceM,
        segmentCount: route.segments.length,
        sourceSnap: route.sourceSnap,
        destinationSnap: route.destinationSnap,
        overpassRadiusKm: window.radiusKm,
      },
      estimate: draft.estimate,
      routeSnapshot,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('NOXIA_VEHICLE_FORBIDDEN') || message.includes('NOXIA_INVENTORY_FORBIDDEN')) {
      return NextResponse.json({ error: 'Kein Zugriff auf Fahrzeug oder Inventar.', code: 'FORBIDDEN' }, { status: 403 })
    }
    if (message.includes('NOXIA_INVENTORY_NOT_FOUND')) {
      return NextResponse.json({ error: 'Inventar nicht gefunden.', code: 'INVENTORY_NOT_FOUND' }, { status: 404 })
    }
    console.error('earth surface mission draft failed:', message)
    return NextResponse.json({ error: 'Earth-Surface-Mission-Draft konnte nicht erstellt werden.' }, { status: 500 })
  }
}
