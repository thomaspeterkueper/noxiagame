import { NextRequest, NextResponse } from 'next/server'
import { OverpassEarthFeatureSource } from '@/lib/world/spatial/overpassEarthFeatureSource'
import { CURRENT_EARTH_BOOTSTRAP_CLASSES, type ImportedEarthFeature } from '@/lib/world/spatial/earthFeatureSource'
import { createServiceClient } from '@/lib/supabase/service'
import { geoToLocalMeters, localMetersToGeo, type GeoPoint } from '@/lib/world/spatial/earthSpatial'
import { EARTH_SAUERLAND_REGION, getEarthRegion } from '@/lib/world/spatial/regions'
import { earthRoadAccessCostCredits, suggestEarthFacilityRoadAccess } from '@/lib/game/infrastructure/earthAccess'

const overpass = new OverpassEarthFeatureSource()
const MAX_ACCESS_LENGTH_M = 1_500

type EntityRow = {
  id: string
  location_id: string
  profile_id: string | null
  x_m: number | null
  y_m: number | null
  latitude_deg: number | null
  longitude_deg: number | null
  spatial_region_id: string | null
  rotation_deg: number | null
  footprint_width_m: number | null
  footprint_depth_m: number | null
}

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(auth.slice(7))
  return user
}

function finite(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function entityGeo(entity: EntityRow, region: ReturnType<typeof getEarthRegion>): GeoPoint | null {
  const lat = finite(entity.latitude_deg)
  const lon = finite(entity.longitude_deg)
  if (lat != null && lon != null) return { lat, lon }
  const xM = finite(entity.x_m)
  const yM = finite(entity.y_m)
  if (xM == null || yM == null || !region) return null
  return localMetersToGeo({ eastM: xM, northM: yM }, region.origin)
}

function boundsAround(center: GeoPoint, radiusKm = .8) {
  const latDelta = radiusKm / 111.32
  const cosLat = Math.max(.05, Math.abs(Math.cos(center.lat * Math.PI / 180)))
  const lonDelta = radiusKm / (111.32 * cosLat)
  return {
    south: center.lat - latDelta,
    west: center.lon - lonDelta,
    north: center.lat + latDelta,
    east: center.lon + lonDelta,
  }
}

function storedFeature(row: any): ImportedEarthFeature {
  return {
    id: String(row.id),
    worldId: 'earth',
    featureType: row.feature_type,
    geometryKind: row.geometry?.kind,
    properties: row.properties ?? {},
    geometry: row.geometry,
    source: { provider: 'OSM', dataset: 'region_features', sourceId: String(row.id) },
  } as ImportedEarthFeature
}

async function roadFeatures(regionId: string, center: GeoPoint) {
  const service = createServiceClient()
  const { data: storedRegion } = await service
    .from('celestial_regions')
    .select('id')
    .eq('slug', regionId)
    .maybeSingle()

  if (storedRegion) {
    const { data: rows } = await service
      .from('region_features')
      .select('id,feature_type,geometry,properties')
      .eq('region_id', storedRegion.id)
      .eq('feature_type', 'road')
    if (rows?.length) return rows.map(storedFeature)
  }

  const imported = await overpass.load({ bounds: boundsAround(center), classes: CURRENT_EARTH_BOOTSTRAP_CLASSES })
  return imported.filter(feature => feature.featureType === 'road')
}

async function loadOwnedEarthEntity(req: NextRequest, entityId: string, userId: string) {
  const service = createServiceClient()
  const { data: location } = await service.from('locations').select('id').eq('slug', 'earth').maybeSingle()
  if (!location) return { error: 'Earth location missing', status: 500 as const }

  const { data: entity } = await service
    .from('tile_entities')
    .select('id,location_id,profile_id,x_m,y_m,latitude_deg,longitude_deg,spatial_region_id,rotation_deg,footprint_width_m,footprint_depth_m')
    .eq('id', entityId)
    .eq('location_id', location.id)
    .maybeSingle()
  if (!entity) return { error: 'Gebäude nicht gefunden', status: 404 as const }
  if (entity.profile_id !== userId) return { error: 'Nur eigene Gebäude können angeschlossen werden', status: 403 as const }
  return { entity: entity as EntityRow, location }
}

async function suggestionFor(req: NextRequest, entity: EntityRow) {
  const requestedRegionId = req.cookies.get('noxia-earth-region')?.value
    ?? entity.spatial_region_id
    ?? EARTH_SAUERLAND_REGION.id
  const region = getEarthRegion(requestedRegionId) ?? getEarthRegion(entity.spatial_region_id ?? '') ?? EARTH_SAUERLAND_REGION
  const geo = entityGeo(entity, region)
  if (!geo) throw new Error('Gebäudeposition ist nicht georeferenziert')
  const centerMetric = geoToLocalMeters(geo, region.origin)
  const roads = await roadFeatures(region.id, geo)
  const suggestion = suggestEarthFacilityRoadAccess({
    origin: region.origin,
    entityCenter: { xM: centerMetric.eastM, yM: centerMetric.northM },
    footprintWidthM: finite(entity.footprint_width_m) ?? 10,
    footprintDepthM: finite(entity.footprint_depth_m) ?? 10,
    rotationDeg: finite(entity.rotation_deg) ?? 0,
    roadFeatures: roads,
  })
  if (!suggestion) throw new Error('Im verfügbaren Erd-Kartenausschnitt wurde keine anschließbare Straße gefunden')
  if (suggestion.lengthM > MAX_ACCESS_LENGTH_M) throw new Error(`Nächste Straße liegt ${Math.round(suggestion.lengthM)} m entfernt; direkte Zufahrten sind derzeit auf ${MAX_ACCESS_LENGTH_M} m begrenzt`)
  return { region, suggestion, costCredits: earthRoadAccessCostCredits(suggestion.lengthM) }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entityId = req.nextUrl.searchParams.get('entityId')
  if (!entityId) return NextResponse.json({ error: 'entityId fehlt' }, { status: 400 })

  const owned = await loadOwnedEarthEntity(req, entityId, user.id)
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

  try {
    const { region, suggestion, costCredits } = await suggestionFor(req, owned.entity)
    const service = createServiceClient()
    const { data: existingNodes } = await service
      .from('infrastructure_nodes')
      .select('id')
      .eq('owner_entity_id', entityId)
      .eq('network_type', 'road')
      .eq('node_kind', 'facility-port')
    let existingEdge = null
    if (existingNodes?.length) {
      const ids = existingNodes.map(node => node.id)
      const { data } = await service
        .from('infrastructure_edges')
        .select('id,status,length_m,build_cost_credits,created_at')
        .eq('owner_profile_id', user.id)
        .eq('network_type', 'road')
        .in('start_node_id', ids)
        .in('status', ['planned','building','active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      existingEdge = data ?? null
    }

    return NextResponse.json({
      ok: true,
      entityId,
      regionId: region.id,
      networkType: 'road',
      suggestion: {
        ...suggestion,
        geometryGeo: suggestion.geometryGeo.map(point => ({ lat: point.lat, lon: point.lon })),
      },
      costCredits,
      existingEdge,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 422 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { entityId?: string }
  if (!body.entityId) return NextResponse.json({ error: 'entityId fehlt' }, { status: 400 })

  const owned = await loadOwnedEarthEntity(req, body.entityId, user.id)
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

  try {
    const service = createServiceClient()
    const { region, suggestion, costCredits } = await suggestionFor(req, owned.entity)

    const { data: profile } = await service.from('profiles').select('credits').eq('id', user.id).maybeSingle()
    const currentCredits = Number(profile?.credits ?? 0)
    if (currentCredits < costCredits) return NextResponse.json({ error: `Nicht genug Credits: ${costCredits} Cr benötigt` }, { status: 409 })

    const { data: charged, error: chargeError } = await service
      .from('profiles')
      .update({ credits: currentCredits - costCredits })
      .eq('id', user.id)
      .eq('credits', currentCredits)
      .select('credits')
      .maybeSingle()
    if (chargeError || !charged) return NextResponse.json({ error: 'Credits haben sich geändert; bitte erneut versuchen' }, { status: 409 })

    let createdNodeIds: string[] = []
    try {
      const [facilityGeo, tieInGeo] = suggestion.geometryGeo
      const { data: nodes, error: nodeError } = await service
        .from('infrastructure_nodes')
        .insert([
          {
            location_id: owned.location.id,
            owner_profile_id: user.id,
            owner_entity_id: owned.entity.id,
            network_type: 'road',
            node_kind: 'facility-port',
            source: 'player-built',
            spatial_region_id: region.id,
            x_m: suggestion.facilityPort.xM,
            y_m: suggestion.facilityPort.yM,
            latitude_deg: facilityGeo.lat,
            longitude_deg: facilityGeo.lon,
            metadata: { role: 'vehicle-access', entityId: owned.entity.id },
          },
          {
            location_id: owned.location.id,
            owner_profile_id: user.id,
            network_type: 'road',
            node_kind: 'network-tie-in',
            source: 'observed',
            spatial_region_id: region.id,
            x_m: suggestion.roadTieIn.xM,
            y_m: suggestion.roadTieIn.yM,
            latitude_deg: tieInGeo.lat,
            longitude_deg: tieInGeo.lon,
            metadata: { observedFeatureId: suggestion.roadFeatureId },
          },
        ])
        .select('id,node_kind')
      if (nodeError || !nodes || nodes.length !== 2) throw nodeError ?? new Error('Infrastrukturknoten konnten nicht angelegt werden')
      createdNodeIds = nodes.map(node => node.id)
      const facility = nodes.find(node => node.node_kind === 'facility-port')!
      const tieIn = nodes.find(node => node.node_kind === 'network-tie-in')!

      const { data: edge, error: edgeError } = await service
        .from('infrastructure_edges')
        .insert({
          location_id: owned.location.id,
          owner_profile_id: user.id,
          network_type: 'road',
          source: 'player-built',
          status: 'active',
          start_node_id: facility.id,
          end_node_id: tieIn.id,
          spatial_region_id: region.id,
          geometry_m: suggestion.geometry,
          geometry_geo: suggestion.geometryGeo.map(point => ({ lat: point.lat, lon: point.lon })),
          length_m: suggestion.lengthM,
          class_id: 'service-access-road',
          condition: 1,
          build_cost_credits: costCredits,
          metadata: { observedFeatureId: suggestion.roadFeatureId, ownerEntityId: owned.entity.id },
        })
        .select('id,status,length_m,build_cost_credits,geometry_m,geometry_geo')
        .single()
      if (edgeError || !edge) throw edgeError ?? new Error('Infrastrukturkante konnte nicht angelegt werden')

      return NextResponse.json({ ok: true, edge, credits: charged.credits }, { status: 201 })
    } catch (error) {
      if (createdNodeIds.length) await service.from('infrastructure_nodes').delete().in('id', createdNodeIds)
      await service.from('profiles').update({ credits: currentCredits }).eq('id', user.id).eq('credits', currentCredits - costCredits)
      throw error
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
