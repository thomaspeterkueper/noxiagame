import 'server-only'

import {
  getAccessibleInventorySnapshot,
  LOGISTICS_RESOURCES,
  type LogisticsResource,
} from './core/logistics'
import { resolveAuthoritativeLogisticsCargoMass } from './core/logisticsCargoMassAuthority'
import { getPlayerVehicleSnapshot, projectPersistedVehicle } from './core/vehicleInstances'
import { resolveEarthSurfaceEngineeringProfile } from './earthSurfaceEngineering'
import { buildEarthSurfaceMissionPlan } from './earthSurfaceMission'
import { attachEarthSurfaceRouteGeometry } from './earthSurfaceRouteGeometry'
import { planEarthSurfaceRoute } from './earthSurfaceRouting'
import type { EarthSurfaceVehicleRole } from './earthSurfaceLogistics'
import { prepareProspectiveSurfaceMission } from './vehicles/surfaceMissionDraft'
import { createServiceClient } from '@/lib/supabase/service'
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

export type EarthSurfaceMissionIntent = {
  sourceInventoryId: string
  destinationInventoryId: string
  vehicleId: string
  resource: LogisticsResource
  amount: number
}

export class EarthSurfaceMissionDraftError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

function fail(status: number, code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new EarthSurfaceMissionDraftError(status, code, message, details)
}

export function parseEarthSurfaceMissionIntent(body: Record<string, unknown>): EarthSurfaceMissionIntent {
  const sourceInventoryId = typeof body.sourceInventoryId === 'string' && UUID_RE.test(body.sourceInventoryId)
    ? body.sourceInventoryId : null
  const destinationInventoryId = typeof body.destinationInventoryId === 'string' && UUID_RE.test(body.destinationInventoryId)
    ? body.destinationInventoryId : null
  const vehicleId = typeof body.vehicleId === 'string' && UUID_RE.test(body.vehicleId) ? body.vehicleId : null
  const resource = typeof body.resource === 'string' && (LOGISTICS_RESOURCES as readonly string[]).includes(body.resource)
    ? body.resource as LogisticsResource : null
  const amountNumber = typeof body.amount === 'number' ? body.amount : Number(body.amount)
  const amount = Number.isInteger(amountNumber) && amountNumber > 0 ? amountNumber : null

  if (!sourceInventoryId || !destinationInventoryId || !vehicleId || !resource || !amount) {
    fail(400, 'MISSION_INTENT_INVALID', 'Ungültige Earth-Surface-Missionsparameter.')
  }
  if (sourceInventoryId === destinationInventoryId) {
    fail(400, 'MISSION_ENDPOINTS_IDENTICAL', 'Quelle und Ziel müssen verschieden sein.')
  }

  return { sourceInventoryId, destinationInventoryId, vehicleId, resource, amount }
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

export async function buildAuthoritativeEarthSurfaceMissionDraft(
  actorProfileId: string,
  intent: EarthSurfaceMissionIntent,
) {
  const supabase = createServiceClient()
  const { sourceInventoryId, destinationInventoryId, vehicleId, resource, amount } = intent

  let sourceSnapshot: unknown
  let destinationSnapshot: unknown
  let vehicleSnapshot: Awaited<ReturnType<typeof getPlayerVehicleSnapshot>>
  try {
    [sourceSnapshot, destinationSnapshot, vehicleSnapshot] = await Promise.all([
      getAccessibleInventorySnapshot(actorProfileId, sourceInventoryId),
      getAccessibleInventorySnapshot(actorProfileId, destinationInventoryId),
      getPlayerVehicleSnapshot(actorProfileId, vehicleId),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('NOXIA_VEHICLE_FORBIDDEN') || message.includes('NOXIA_INVENTORY_FORBIDDEN')) {
      fail(403, 'FORBIDDEN', 'Kein Zugriff auf Fahrzeug oder Inventar.')
    }
    if (message.includes('NOXIA_INVENTORY_NOT_FOUND')) {
      fail(404, 'INVENTORY_NOT_FOUND', 'Inventar nicht gefunden.')
    }
    throw error
  }

  if (!vehicleSnapshot) fail(404, 'VEHICLE_NOT_FOUND', 'Fahrzeug nicht gefunden.')

  const { data: inventories, error: inventoryError } = await supabase
    .from('logistics_inventories')
    .select('id,location_id,subject_type,subject_id,active')
    .in('id', [sourceInventoryId, destinationInventoryId])
  if (inventoryError) throw inventoryError

  const sourceInventory = (inventories ?? []).find(row => row.id === sourceInventoryId)
  const destinationInventory = (inventories ?? []).find(row => row.id === destinationInventoryId)
  if (!sourceInventory || !destinationInventory || !sourceInventory.active || !destinationInventory.active) {
    fail(409, 'INVENTORY_UNAVAILABLE', 'Quelle oder Ziel ist nicht verfügbar.')
  }
  if (!sourceInventory.location_id || sourceInventory.location_id !== destinationInventory.location_id) {
    fail(409, 'LOCATION_MISMATCH', 'Quelle und Ziel müssen am selben Earth-Standort liegen.')
  }
  if (sourceInventory.subject_type !== 'tile_entity' || destinationInventory.subject_type !== 'tile_entity'
    || !sourceInventory.subject_id || !destinationInventory.subject_id) {
    fail(409, 'SPATIAL_NODE_REQUIRED', 'Quelle und Ziel müssen räumliche Earth-Inventarknoten sein.')
  }

  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('id,slug')
    .eq('id', sourceInventory.location_id)
    .maybeSingle()
  if (locationError) throw locationError
  if (!location || location.slug !== 'earth') {
    fail(409, 'EARTH_LOCATION_REQUIRED', 'Diese Surface-Mission ist nur für Earth zulässig.')
  }

  const vehicle = vehicleSnapshot.vehicle
  if (vehicle.location_id !== location.id || vehicle.status !== 'ready') {
    fail(409, 'VEHICLE_NOT_READY', 'Das Fahrzeug ist für diese Earth-Mission nicht bereit.')
  }
  if (vehicle.current_node_inventory_id !== sourceInventoryId) {
    fail(409, 'VEHICLE_NOT_AT_SOURCE', 'Das Fahrzeug muss explizit am gewählten Quellknoten gestaged sein.')
  }
  if (vehicleSnapshot.activeTransportJob) {
    fail(409, 'VEHICLE_BUSY', 'Das Fahrzeug ist bereits einem aktiven Transport zugeordnet.')
  }

  const profile = resolveEarthSurfaceEngineeringProfile(vehicle.frame_id)
  if (profile.status === 'unresolved') {
    fail(409, 'ENGINEERING_FRAME_UNAVAILABLE', 'Für diesen Fahrzeug-Frame liegt kein freigegebenes Earth-Surface-Profil vor.', {
      reason: profile.reason,
      details: profile.details,
    })
  }
  const role = vehicleRole(profile.frame.role)
  if (!role) fail(409, 'EARTH_ROLE_UNSUPPORTED', 'Der Engineering-Frame besitzt keine unterstützte Earth-Routingrolle.')

  const sourceItem = inventoryItems(sourceSnapshot).find(item => item.resource === resource)
  if (!sourceItem) fail(409, 'CARGO_STOCK_UNAVAILABLE', 'Die gewählte Ware ist am Quellinventar nicht vorhanden.')
  const availableRaw = sourceItem.available ?? sourceItem.amount
  const available = typeof availableRaw === 'number' ? availableRaw : Number(availableRaw)
  if (!Number.isFinite(available) || available < amount) {
    fail(409, 'CARGO_STOCK_INSUFFICIENT', 'Die gewählte Menge ist am Quellinventar nicht frei verfügbar.', {
      available: Number.isFinite(available) ? available : null,
    })
  }

  const unit = typeof sourceItem.unit === 'string' && sourceItem.unit.trim() ? sourceItem.unit.trim() : null
  const cargoAuthority = resolveAuthoritativeLogisticsCargoMass({ commodityId: resource, amount, unit })
  if (cargoAuthority.resolution.status !== 'resolved') {
    fail(409, 'CARGO_MASS_UNRESOLVED', 'Für die gewählte Ware und Menge liegt noch keine autoritative physikalische Frachtmasse vor.', {
      reason: cargoAuthority.resolution.reason,
      commodityId: resource,
      amount,
      unit,
      engineeringRequest: 'EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS',
    })
  }

  const { data: entities, error: entityError } = await supabase
    .from('tile_entities')
    .select('id,location_id,status,x_m,y_m,latitude_deg,longitude_deg,altitude_m,spatial_region_id')
    .in('id', [sourceInventory.subject_id, destinationInventory.subject_id])
  if (entityError) throw entityError
  const sourceEntity = (entities ?? []).find(row => row.id === sourceInventory.subject_id) as Record<string, unknown> | undefined
  const destinationEntity = (entities ?? []).find(row => row.id === destinationInventory.subject_id) as Record<string, unknown> | undefined
  if (!sourceEntity || !destinationEntity || sourceEntity.status !== 'active' || destinationEntity.status !== 'active') {
    fail(409, 'SPATIAL_NODE_UNAVAILABLE', 'Ein räumlicher Earth-Knoten ist nicht aktiv.')
  }

  const sourcePoint = canonicalEarthGeo(sourceEntity)
  const destinationPoint = canonicalEarthGeo(destinationEntity)
  if (!sourcePoint || !destinationPoint) {
    fail(409, 'SPATIAL_POSITION_UNRESOLVED', 'Quelle oder Ziel besitzt keine kanonisch auflösbare Earth-Position.')
  }

  const window = routeBounds(sourcePoint, destinationPoint)
  if (window.directDistanceM > MAX_LOCAL_ROUTE_DISTANCE_M) {
    fail(409, 'ROUTE_WINDOW_EXCEEDED', 'Die Mission liegt außerhalb des derzeitigen lokalen Earth-Routingfensters.', {
      directDistanceM: window.directDistanceM,
    })
  }

  const features = await earthFeatures.load({ bounds: window.bounds, classes: ['road'] })
  const route = planEarthSurfaceRoute({ features, source: sourcePoint, destination: destinationPoint, vehicleRole: role })
  if (!route.ok) {
    fail(409, 'EARTH_ROUTE_BLOCKED', 'Die serverseitig neu berechnete Earth-Route ist nicht freigegeben.', {
      reason: route.reason,
      sourceSnap: route.sourceSnap ?? null,
      destinationSnap: route.destinationSnap ?? null,
    })
  }

  const routeId = `earth:${sourceInventoryId.slice(0, 8)}:${destinationInventoryId.slice(0, 8)}:${vehicleId.slice(0, 8)}:${resource}:${amount}`
  const plan = buildEarthSurfaceMissionPlan({
    routeId,
    originInventoryId: sourceInventoryId,
    destinationInventoryId,
    route,
  })
  const draft = prepareProspectiveSurfaceMission({
    frame: profile.frame,
    instance: projectPersistedVehicle(vehicle),
    operationProfile: profile.operationProfile,
    plan,
    projectedCargo: [cargoAuthority.resolution.cargo],
  })
  if (!draft.estimate.feasible || !draft.routeSnapshot) {
    fail(409, 'SURFACE_MISSION_INFEASIBLE', 'Der gemeinsame Surface-Mission-Vertrag blockiert diesen Draft.', {
      estimate: draft.estimate,
    })
  }

  const vehicleInventoryId = (vehicleSnapshot.inventory as Record<string, unknown> | null)?.id
  if (typeof vehicleInventoryId !== 'string' || !UUID_RE.test(vehicleInventoryId)) {
    fail(409, 'VEHICLE_CARGO_INVENTORY_UNRESOLVED', 'Das Fahrzeug besitzt kein auflösbares Cargo-Inventar.')
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

  return {
    ok: true as const,
    ready: true as const,
    locationId: location.id,
    sourceInventoryId,
    destinationInventoryId,
    routeId,
    vehicleId,
    vehicleInventoryId,
    frameId: profile.frame.id,
    vehicleRole: role,
    engineeringSourceId: profile.sourceId ?? null,
    resource,
    amount,
    cargo: {
      resource,
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
  }
}
