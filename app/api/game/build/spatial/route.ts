import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BUILDINGS } from '@/lib/game/buildings'
import { TICK_INTERVAL_SECONDS } from '@/lib/game/tick'
import { getBuildRequirements } from '@/lib/knowledge/buildRequirements'
import { getNoxiaKnowledgeState } from '@/lib/knowledge/service'
import { overlaps } from '@/lib/game/spatial/geometry'
import { getBuildingFootprint } from '@/lib/game/spatial/footprints'
import {
  geoToLocalMeters,
  localMetersToGeo,
  validateGeoPoint,
  type GeoPoint,
} from '@/lib/world/spatial/earthSpatial'
import { EARTH_SAUERLAND_REGION, getEarthRegion } from '@/lib/world/spatial/regions'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

const EARTH_VIEW_HALF_SPAN_M = 250_000
const EARTH_COLLISION_LAT_SPAN_DEG = .03

type StartBody = {
  buildableId?: string
  location?: string
  xM?: number
  yM?: number
  latDeg?: number
  lonDeg?: number
  altitudeM?: number | null
  regionId?: string
  rotationDeg?: number
}

type KnowledgeState = Awaited<ReturnType<typeof getNoxiaKnowledgeState>>
type CatalogEntry = {
  id: string
  name: string
  cost: number
  allowedLocations: string[] | null
  buildTimeTicks: number
}

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const { data: { user } } = await serviceClient.auth.getUser(auth.slice(7))
  return user
}

async function definition(id: string): Promise<CatalogEntry | null> {
  const { data } = await serviceClient
    .from('building_definitions')
    .select('key,name,cost_credits,allowed_locations,build_time_ticks,is_active')
    .eq('key', id)
    .eq('is_active', true)
    .maybeSingle()

  if (data) return {
    id,
    name: data.name ?? id,
    cost: Number(data.cost_credits ?? 0),
    allowedLocations: data.allowed_locations as string[] | null,
    buildTimeTicks: Number(data.build_time_ticks ?? 1),
  }

  const local = BUILDINGS[id]
  if (!local || local.planned) return null
  return {
    id,
    name: local.name,
    cost: local.cost,
    allowedLocations: local.allowedLocations ?? null,
    buildTimeTicks: local.buildTimeTicks,
  }
}

function buildRequirement(buildableId: string, locationSlug: string, knowledge: KnowledgeState) {
  // Earth is currently the spatial-placement playtest. Geometry, collision,
  // persistence and rendering must remain testable independently from the
  // curriculum/SSF unlock chain. Other locations keep the canonical gate.
  if (locationSlug === 'earth') {
    return { id: null, ok: true, requiredUnlock: null, requiredLabel: null, learningUrl: null }
  }
  return getBuildRequirements(buildableId, {
    completedModules: knowledge.completedModules,
    unlocked: knowledge.unlocked,
  })
}

function terrainResolution(frame: any, dataset: any) {
  if (!frame || frame.origin_status !== 'verified' || frame.origin_lat_deg == null || frame.origin_lon_deg == null || frame.origin_alt_m == null) {
    return { status: 'origin_pending' as const, zM: null }
  }
  if (!dataset || dataset.status !== 'ready') {
    return { status: 'dataset_pending' as const, zM: null }
  }
  // Phase 1 deliberately does not decode raster bytes inside the build route.
  // Once a validated tile sampler is connected this becomes resolved and z_m
  // is the foundation height in LOCAL_ENU_METERS rather than a client value.
  return { status: 'unresolved' as const, zM: null }
}

function localCatalog(): Map<string, CatalogEntry> {
  const catalog = new Map<string, CatalogEntry>()
  for (const def of Object.values(BUILDINGS)) {
    if (def.planned) continue
    catalog.set(def.id, {
      id: def.id,
      name: def.name,
      cost: def.cost,
      allowedLocations: def.allowedLocations ?? null,
      buildTimeTicks: def.buildTimeTicks,
    })
  }
  return catalog
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function earthRegion(req: NextRequest, explicitRegionId?: string | null) {
  const regionId = explicitRegionId
    ?? req.cookies.get('noxia-earth-region')?.value
    ?? EARTH_SAUERLAND_REGION.id
  return getEarthRegion(regionId) ?? EARTH_SAUERLAND_REGION
}

function canonicalEarthGeo(row: any): GeoPoint | null {
  const lat = finiteNumber(row.latitude_deg)
  const lon = finiteNumber(row.longitude_deg)
  if (lat != null && lon != null) {
    try { return validateGeoPoint({ lat, lon, elevationM: finiteNumber(row.altitude_m) }) }
    catch { return null }
  }

  // Transitional fallback for old rows that have not yet received canonical
  // geodetic coordinates. Their x/y cache belongs to the recorded region, or
  // to the original Sauerland frame when no affinity is present.
  const xM = finiteNumber(row.x_m)
  const yM = finiteNumber(row.y_m)
  if (xM == null || yM == null) return null
  const region = getEarthRegion(String(row.spatial_region_id ?? '')) ?? EARTH_SAUERLAND_REGION
  try { return localMetersToGeo({ eastM: xM, northM: yM }, region.origin) }
  catch { return null }
}

function projectEarthRow(row: any, region: ReturnType<typeof earthRegion>) {
  const geo = canonicalEarthGeo(row)
  if (!geo) return null
  const metric = geoToLocalMeters(geo, region.origin)
  if (Math.abs(metric.eastM) > EARTH_VIEW_HALF_SPAN_M || Math.abs(metric.northM) > EARTH_VIEW_HALF_SPAN_M) return null
  return {
    ...row,
    latitude_deg: geo.lat,
    longitude_deg: geo.lon,
    altitude_m: geo.elevationM ?? row.altitude_m ?? null,
    x_m: metric.eastM,
    y_m: metric.northM,
  }
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const locationSlug = url.searchParams.get('location') ?? 'earth'
  const viewRegion = locationSlug === 'earth'
    ? earthRegion(req, url.searchParams.get('region'))
    : null

  const { data: location } = await serviceClient
    .from('locations')
    .select('id,slug,name')
    .eq('slug', locationSlug)
    .maybeSingle()
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const [knowledge, spatialData] = await Promise.all([
    getNoxiaKnowledgeState(user.id),
    Promise.all([
      serviceClient.from('profiles').select('credits').eq('id', user.id).maybeSingle(),
      serviceClient.from('world_frames').select('*').eq('location_id', location.id).maybeSingle(),
      serviceClient.from('build_sites').select('*').eq('location_id', location.id).order('created_at'),
      serviceClient.from('tile_entities')
        .select('id,entity_id,entity_type,profile_id,owner_class,owner_id,actor_id,occupant_id,placement_mode,x_m,y_m,z_m,latitude_deg,longitude_deg,altitude_m,spatial_region_id,rotation_deg,footprint_width_m,footprint_depth_m,site_id,parent_id,slot,status,built_at,asking_price,lease_price,terrain_dataset_id,terrain_status,ground_elevation_m,terrain_min_elevation_m,terrain_max_elevation_m,terrain_slope_deg,profiles(username),actors(display_name)')
        .eq('location_id', location.id)
        .in('entity_type', ['building','module']),
      serviceClient.from('player_builds')
        .select('id,profile_id,buildable_id,target_type,status,created_at,completes_at,placement_mode,x_m,y_m,z_m,latitude_deg,longitude_deg,altitude_m,spatial_region_id,rotation_deg,footprint_width_m,footprint_depth_m,site_id,parent_id,slot,terrain_dataset_id,terrain_status,ground_elevation_m,terrain_min_elevation_m,terrain_max_elevation_m,terrain_slope_deg')
        .eq('profile_id', user.id)
        .eq('location_id', location.id)
        .eq('target_type', 'building')
        .eq('status', 'building'),
      serviceClient.from('terrain_datasets').select('*').eq('location_id', location.id).order('resolution_m', { ascending: true }),
      serviceClient.from('building_definitions')
        .select('key,name,cost_credits,allowed_locations,build_time_ticks,is_active')
        .eq('is_active', true),
    ]),
  ])

  const [profileResult, frameResult, sitesResult, entitiesResult, buildsResult, terrainDatasetsResult, dbDefinitionsResult] = spatialData
  const profile = profileResult.data
  const frame = frameResult.data
  const sites = sitesResult.data
  const rawEntities = entitiesResult.data ?? []
  const rawBuilds = buildsResult.data ?? []
  const terrainDatasets = terrainDatasetsResult.data
  const credits = Number(profile?.credits ?? 0)

  // The database catalog is authoritative when a definition exists there.
  // Local definitions remain the fallback for code-only buildings.
  const catalog = localCatalog()
  for (const row of dbDefinitionsResult.data ?? []) {
    catalog.set(row.key, {
      id: row.key,
      name: row.name ?? row.key,
      cost: Number(row.cost_credits ?? 0),
      allowedLocations: row.allowed_locations as string[] | null,
      buildTimeTicks: Number(row.build_time_ticks ?? 1),
    })
  }

  const visibleEntities = viewRegion
    ? rawEntities.flatMap((row: any) => {
        const projected = projectEarthRow(row, viewRegion)
        return projected ? [projected] : []
      })
    : rawEntities
  const visibleBuilds = viewRegion
    ? rawBuilds.flatMap((row: any) => {
        const projected = projectEarthRow(row, viewRegion)
        return projected ? [projected] : []
      })
    : rawBuilds

  const entities = visibleEntities.map((entity: any) => {
    const meta = catalog.get(entity.entity_id)
    return {
      ...entity,
      name: meta?.name ?? entity.entity_id,
      cost: meta?.cost ?? null,
      buildTimeTicks: meta?.buildTimeTicks ?? null,
      isOwn: entity.profile_id === user.id,
      ownerLabel: entity.profile_id === user.id
        ? 'Dein Gebäude'
        : entity.owner_class === 'STATE'
          ? 'Staatlich'
          : entity.owner_class === 'CORPORATION'
            ? 'Corporation'
            : entity.actors?.display_name ?? entity.profiles?.username ?? 'Anderer Pilot',
    }
  })

  const builds = visibleBuilds.map((build: any) => {
    const meta = catalog.get(build.buildable_id)
    return {
      ...build,
      name: meta?.name ?? build.buildable_id,
      cost: meta?.cost ?? null,
      buildTimeTicks: meta?.buildTimeTicks ?? null,
      isOwn: true,
    }
  })

  const activeTerrainDataset = frame?.terrain_dataset_id
    ? (terrainDatasets ?? []).find(dataset => dataset.id === frame.terrain_dataset_id) ?? null
    : null

  const available = [...catalog.values()]
    .filter(def => !def.allowedLocations?.length || def.allowedLocations.includes(locationSlug))
    .map(def => {
      const requirement = buildRequirement(def.id, locationSlug, knowledge)
      const creditsOk = credits >= def.cost
      return {
        id: def.id,
        name: def.name,
        cost: def.cost,
        buildTimeTicks: def.buildTimeTicks,
        footprint: getBuildingFootprint(def.id),
        requirements: {
          knowledgeOk: requirement.ok,
          creditsOk,
          canBuild: requirement.ok && creditsOk,
          requiredUnlock: requirement.requiredUnlock,
          requiredLabel: requirement.requiredLabel,
          learningUrl: requirement.learningUrl,
        },
      }
    })

  const visibleSites = viewRegion
    ? (sites ?? []).filter((site: any) => !site.metadata?.region || site.metadata.region === viewRegion.id)
    : (sites ?? [])

  return NextResponse.json({
    location,
    spatialRegion: viewRegion ? { id: viewRegion.id, name: viewRegion.name, origin: viewRegion.origin } : null,
    profile: { id: user.id, credits },
    knowledge: {
      source: knowledge.source,
      analysis: {
        geodetic: knowledge.unlocked.includes('UNL:NOX:SENSOR:GEODETIC' as never),
        precision: knowledge.unlocked.includes('UNL:NOX:SENSOR:PRECISION' as never),
      },
    },
    frame,
    terrain: {
      activeDataset: activeTerrainDataset,
      datasets: terrainDatasets ?? [],
      resolution: terrainResolution(frame, activeTerrainDataset),
    },
    sites: visibleSites,
    entities,
    builds,
    available,
  })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: StartBody
  try { body = await req.json() as StartBody } catch { return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 }) }

  const buildableId = body.buildableId?.trim()
  const locationSlug = body.location?.trim()
  if (!buildableId || !locationSlug) {
    return NextResponse.json({ error: 'Bautyp und Standort fehlen' }, { status: 400 })
  }

  const def = await definition(buildableId)
  if (!def) return NextResponse.json({ error: 'Unbekannter oder inaktiver Bautyp' }, { status: 400 })
  if (def.allowedLocations?.length && !def.allowedLocations.includes(locationSlug)) {
    return NextResponse.json({ error: `${def.name} kann hier nicht gebaut werden.` }, { status: 400 })
  }

  const knowledge = await getNoxiaKnowledgeState(user.id)
  const gate = buildRequirement(buildableId, locationSlug, knowledge)
  if (!gate.ok) {
    return NextResponse.json({
      error: `Wissen fehlt: ${gate.requiredLabel ?? gate.requiredUnlock}`,
      requiredUnlock: gate.requiredUnlock,
      requiredLabel: gate.requiredLabel,
      learningUrl: gate.learningUrl,
    }, { status: 403 })
  }

  const { data: location } = await serviceClient.from('locations').select('id,slug').eq('slug', locationSlug).single()
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const [{ data: profile }, { data: frame }] = await Promise.all([
    serviceClient.from('profiles').select('credits').eq('id', user.id).single(),
    serviceClient.from('world_frames').select('*').eq('location_id', location.id).maybeSingle(),
  ])
  if (!profile || Number(profile.credits) < def.cost) return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })

  const { data: terrainDataset } = frame?.terrain_dataset_id
    ? await serviceClient.from('terrain_datasets').select('*').eq('id', frame.terrain_dataset_id).maybeSingle()
    : { data: null }
  const terrain = terrainResolution(frame, terrainDataset)

  const footprint = getBuildingFootprint(buildableId)
  const rotation = ((Number(body.rotationDeg ?? 0) % 360) + 360) % 360
  if (!Number.isFinite(rotation)) return NextResponse.json({ error: 'Ungültige Rotation' }, { status: 400 })

  const selectedRegion = locationSlug === 'earth' ? earthRegion(req, body.regionId) : null
  let xM = finiteNumber(body.xM)
  let yM = finiteNumber(body.yM)
  let canonicalGeo: GeoPoint | null = null

  if (locationSlug === 'earth') {
    const lat = finiteNumber(body.latDeg)
    const lon = finiteNumber(body.lonDeg)
    try {
      canonicalGeo = lat != null && lon != null
        ? validateGeoPoint({ lat, lon, elevationM: finiteNumber(body.altitudeM) })
        : xM != null && yM != null && selectedRegion
          ? localMetersToGeo({ eastM: xM, northM: yM }, selectedRegion.origin)
          : null
    } catch {
      canonicalGeo = null
    }
    if (!canonicalGeo || !selectedRegion) {
      return NextResponse.json({ error: 'Globale WGS84-Position fehlt oder ist ungültig' }, { status: 400 })
    }

    // x/y are a cache in the currently selected local projection only.
    const local = geoToLocalMeters(canonicalGeo, selectedRegion.origin)
    xM = local.eastM
    yM = local.northM
  } else if (xM == null || yM == null) {
    return NextResponse.json({ error: 'Metrische Position fehlt' }, { status: 400 })
  }

  const [existingResult, pendingResult] = locationSlug === 'earth' && canonicalGeo
    ? await Promise.all([
        serviceClient.from('tile_entities')
          .select('id,entity_id,x_m,y_m,latitude_deg,longitude_deg,altitude_m,spatial_region_id,footprint_width_m,footprint_depth_m')
          .eq('location_id', location.id)
          .eq('placement_mode', 'world')
          .eq('entity_type', 'building')
          .gte('latitude_deg', canonicalGeo.lat - EARTH_COLLISION_LAT_SPAN_DEG)
          .lte('latitude_deg', canonicalGeo.lat + EARTH_COLLISION_LAT_SPAN_DEG),
        serviceClient.from('player_builds')
          .select('id,buildable_id,x_m,y_m,latitude_deg,longitude_deg,altitude_m,spatial_region_id,footprint_width_m,footprint_depth_m')
          .eq('location_id', location.id)
          .eq('placement_mode', 'world')
          .eq('target_type', 'building')
          .eq('status', 'building')
          .gte('latitude_deg', canonicalGeo.lat - EARTH_COLLISION_LAT_SPAN_DEG)
          .lte('latitude_deg', canonicalGeo.lat + EARTH_COLLISION_LAT_SPAN_DEG),
      ])
    : await Promise.all([
        serviceClient.from('tile_entities')
          .select('id,entity_id,x_m,y_m,footprint_width_m,footprint_depth_m')
          .eq('location_id', location.id).eq('placement_mode', 'world').eq('entity_type', 'building'),
        serviceClient.from('player_builds')
          .select('id,buildable_id,x_m,y_m,footprint_width_m,footprint_depth_m')
          .eq('location_id', location.id).eq('placement_mode', 'world').eq('target_type', 'building').eq('status', 'building'),
      ])

  const blockers = [...(existingResult.data ?? []), ...(pendingResult.data ?? [])]
  const target = locationSlug === 'earth'
    ? { xM: 0, yM: 0, widthM: footprint.widthM, depthM: footprint.depthM }
    : { xM: xM!, yM: yM!, widthM: footprint.widthM, depthM: footprint.depthM }

  const collision = blockers.find((row: any) => {
    let blockerX = finiteNumber(row.x_m)
    let blockerY = finiteNumber(row.y_m)
    if (locationSlug === 'earth' && canonicalGeo) {
      const blockerGeo = canonicalEarthGeo(row)
      if (!blockerGeo) return false
      const local = geoToLocalMeters(blockerGeo, canonicalGeo)
      blockerX = local.eastM
      blockerY = local.northM
    }
    if (blockerX == null || blockerY == null) return false
    return overlaps(target, {
      xM: blockerX,
      yM: blockerY,
      widthM: Number(row.footprint_width_m ?? getBuildingFootprint(row.entity_id ?? row.buildable_id).widthM),
      depthM: Number(row.footprint_depth_m ?? getBuildingFootprint(row.entity_id ?? row.buildable_id).depthM),
    }, footprint.clearanceM)
  })
  if (collision) return NextResponse.json({ error: 'Baufläche überschneidet ein bestehendes oder geplantes Gebäude.', collisionId: collision.id }, { status: 409 })

  const completesAt = new Date(Date.now() + Math.max(1, def.buildTimeTicks) * TICK_INTERVAL_SECONDS * 1000)
  const { data: build, error: buildError } = await serviceClient.from('player_builds').insert({
    profile_id: user.id,
    buildable_id: buildableId,
    target_type: 'building',
    location_id: location.id,
    tile_level: 0,
    tile_row: null,
    tile_col: null,
    placement_mode: 'world',
    x_m: xM,
    y_m: yM,
    z_m: terrain.zM,
    latitude_deg: canonicalGeo?.lat ?? null,
    longitude_deg: canonicalGeo?.lon ?? null,
    altitude_m: canonicalGeo?.elevationM ?? finiteNumber(body.altitudeM),
    spatial_region_id: selectedRegion?.id ?? null,
    rotation_deg: rotation,
    footprint_width_m: footprint.widthM,
    footprint_depth_m: footprint.depthM,
    site_id: null,
    terrain_dataset_id: terrainDataset?.id ?? null,
    terrain_status: terrain.status,
    ground_elevation_m: null,
    terrain_min_elevation_m: null,
    terrain_max_elevation_m: null,
    terrain_slope_deg: null,
    status: 'building',
    completes_at: completesAt.toISOString(),
  }).select('id').single()

  if (buildError || !build) return NextResponse.json({ error: buildError?.message ?? 'Bauauftrag konnte nicht angelegt werden.' }, { status: 500 })

  const { error: creditError } = await serviceClient.from('profiles').update({ credits: Number(profile.credits) - def.cost }).eq('id', user.id)
  if (creditError) {
    await serviceClient.from('player_builds').delete().eq('id', build.id)
    return NextResponse.json({ error: 'Credits konnten nicht belastet werden.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    buildId: build.id,
    placementMode: 'world',
    xM,
    yM,
    latitudeDeg: canonicalGeo?.lat ?? null,
    longitudeDeg: canonicalGeo?.lon ?? null,
    altitudeM: canonicalGeo?.elevationM ?? finiteNumber(body.altitudeM),
    spatialRegionId: selectedRegion?.id ?? null,
    zM: terrain.zM,
    terrainStatus: terrain.status,
    terrainDatasetId: terrainDataset?.id ?? null,
    footprint,
    newCredits: Number(profile.credits) - def.cost,
    completesAt: completesAt.toISOString(),
  })
}
