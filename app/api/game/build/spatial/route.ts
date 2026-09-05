import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BUILDINGS } from '@/lib/game/buildings'
import { getBuildRequirements } from '@/lib/knowledge/buildRequirements'
import { getNoxiaKnowledgeState } from '@/lib/knowledge/service'
import { overlaps } from '@/lib/game/spatial/geometry'
import { getBuildingFootprint } from '@/lib/game/spatial/footprints'
import type { PlacementMode } from '@/lib/game/spatial/types'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

type StartBody = {
  buildableId?: string
  location?: string
  xM?: number
  yM?: number
  zM?: number
  rotationDeg?: number
  siteId?: string
  parentEntityId?: string
  slotKey?: string
}

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const { data: { user } } = await serviceClient.auth.getUser(auth.slice(7))
  return user
}

async function definition(id: string) {
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

function placementMode(body: StartBody): PlacementMode | null {
  if (body.parentEntityId && body.slotKey) return 'child'
  if (body.siteId && body.slotKey) return 'site_slot'
  if (Number.isFinite(body.xM) && Number.isFinite(body.yM)) return 'world'
  return null
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const locationSlug = new URL(req.url).searchParams.get('location') ?? 'earth'
  const { data: location } = await serviceClient
    .from('locations')
    .select('id,slug,name')
    .eq('slug', locationSlug)
    .maybeSingle()
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const [{ data: frame }, { data: sites }, { data: entities }, { data: builds }] = await Promise.all([
    serviceClient.from('world_frames').select('*').eq('location_id', location.id).maybeSingle(),
    serviceClient.from('build_sites').select('*').eq('location_id', location.id).order('created_at'),
    serviceClient.from('tile_entities')
      .select('id,entity_id,entity_type,profile_id,placement_mode,x_m,y_m,z_m,rotation_deg,footprint_width_m,footprint_depth_m,site_id,parent_entity_id,slot_key,status')
      .eq('location_id', location.id)
      .in('entity_type', ['building','module']),
    serviceClient.from('player_builds')
      .select('id,buildable_id,status,completes_at,placement_mode,x_m,y_m,z_m,rotation_deg,footprint_width_m,footprint_depth_m,site_id,parent_entity_id,slot_key')
      .eq('profile_id', user.id)
      .eq('location_id', location.id)
      .eq('status', 'building'),
  ])

  const available = Object.values(BUILDINGS)
    .filter(def => !def.planned && (!def.allowedLocations || def.allowedLocations.includes(locationSlug)))
    .map(def => ({ id: def.id, name: def.name, cost: def.cost, buildTimeTicks: def.buildTimeTicks, footprint: getBuildingFootprint(def.id) }))

  return NextResponse.json({ location, frame, sites: sites ?? [], entities: entities ?? [], builds: builds ?? [], available })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: StartBody
  try { body = await req.json() as StartBody } catch { return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 }) }

  const buildableId = body.buildableId?.trim()
  const locationSlug = body.location?.trim()
  const mode = placementMode(body)
  if (!buildableId || !locationSlug || !mode) return NextResponse.json({ error: 'Bautyp, Standort und Platzierung fehlen' }, { status: 400 })

  const def = await definition(buildableId)
  if (!def) return NextResponse.json({ error: 'Unbekannter oder inaktiver Bautyp' }, { status: 400 })
  if (def.allowedLocations?.length && !def.allowedLocations.includes(locationSlug)) {
    return NextResponse.json({ error: `${def.name} kann hier nicht gebaut werden.` }, { status: 400 })
  }

  const knowledge = await getNoxiaKnowledgeState(user.id)
  const gate = getBuildRequirements(buildableId, { completedModules: knowledge.completedModules, unlocked: knowledge.unlocked })
  if (!gate.ok) return NextResponse.json({ error: `Wissen fehlt: ${gate.requiredUnlock}`, requiredUnlock: gate.requiredUnlock }, { status: 403 })

  const { data: location } = await serviceClient.from('locations').select('id,slug').eq('slug', locationSlug).single()
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const { data: profile } = await serviceClient.from('profiles').select('credits').eq('id', user.id).single()
  if (!profile || Number(profile.credits) < def.cost) return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })

  const footprint = getBuildingFootprint(buildableId)
  const rotation = ((Number(body.rotationDeg ?? 0) % 360) + 360) % 360
  let xM: number | null = null
  let yM: number | null = null
  let zM: number | null = null
  let siteId: string | null = body.siteId ?? null
  let parentEntityId: string | null = body.parentEntityId ?? null
  let slotKey: string | null = body.slotKey?.trim() || null

  if (mode === 'world') {
    xM = Number(body.xM)
    yM = Number(body.yM)
    zM = Number.isFinite(body.zM) ? Number(body.zM) : 0
    if (![xM,yM,zM,rotation].every(Number.isFinite)) return NextResponse.json({ error: 'Ungültige metrische Koordinate' }, { status: 400 })

    const [{ data: existing }, { data: pending }] = await Promise.all([
      serviceClient.from('tile_entities')
        .select('id,entity_id,x_m,y_m,footprint_width_m,footprint_depth_m')
        .eq('location_id', location.id).eq('placement_mode', 'world').eq('entity_type', 'building'),
      serviceClient.from('player_builds')
        .select('id,buildable_id,x_m,y_m,footprint_width_m,footprint_depth_m')
        .eq('location_id', location.id).eq('placement_mode', 'world').eq('status', 'building'),
    ])

    const target = { xM, yM, widthM: footprint.widthM, depthM: footprint.depthM }
    const blockers = [...(existing ?? []), ...(pending ?? [])]
    const collision = blockers.find((row: any) => Number.isFinite(row.x_m) && Number.isFinite(row.y_m) && overlaps(target, {
      xM: Number(row.x_m), yM: Number(row.y_m),
      widthM: Number(row.footprint_width_m ?? getBuildingFootprint(row.entity_id ?? row.buildable_id).widthM),
      depthM: Number(row.footprint_depth_m ?? getBuildingFootprint(row.entity_id ?? row.buildable_id).depthM),
    }, footprint.clearanceM))
    if (collision) return NextResponse.json({ error: 'Baufläche überschneidet ein bestehendes oder geplantes Gebäude.', collisionId: collision.id }, { status: 409 })
  }

  if (mode === 'child') {
    const { data: parent } = await serviceClient.from('tile_entities')
      .select('id,profile_id,location_id,x_m,y_m,z_m')
      .eq('id', parentEntityId).eq('location_id', location.id).single()
    if (!parent || parent.profile_id !== user.id) return NextResponse.json({ error: 'Hauptgebäude nicht gefunden oder gehört dir nicht.' }, { status: 403 })
    xM = parent.x_m; yM = parent.y_m; zM = parent.z_m
    const [{ data: occupied }, { data: pending }] = await Promise.all([
      serviceClient.from('tile_entities').select('id').eq('parent_entity_id', parentEntityId).eq('slot_key', slotKey).limit(1),
      serviceClient.from('player_builds').select('id').eq('parent_entity_id', parentEntityId).eq('slot_key', slotKey).eq('status', 'building').limit(1),
    ])
    if ((occupied?.length ?? 0) || (pending?.length ?? 0)) return NextResponse.json({ error: 'Dieser Ausbauplatz ist bereits belegt.' }, { status: 409 })
  }

  if (mode === 'site_slot') {
    const { data: site } = await serviceClient.from('build_sites').select('id,location_id,origin_x_m,origin_y_m,origin_z_m,slot_layout').eq('id', siteId).eq('location_id', location.id).single()
    if (!site) return NextResponse.json({ error: 'Baufläche nicht gefunden.' }, { status: 404 })
    const layout = (site.slot_layout ?? {}) as Record<string, any>
    const slot = layout[slotKey as string]
    if (!slot) return NextResponse.json({ error: 'Unbekannter Ausbauplatz.' }, { status: 400 })
    xM = Number(site.origin_x_m) + Number(slot.xM ?? 0)
    yM = Number(site.origin_y_m) + Number(slot.yM ?? 0)
    zM = Number(site.origin_z_m) + Number(slot.zM ?? 0)
    const [{ data: occupied }, { data: pending }] = await Promise.all([
      serviceClient.from('tile_entities').select('id').eq('site_id', siteId).eq('slot_key', slotKey).limit(1),
      serviceClient.from('player_builds').select('id').eq('site_id', siteId).eq('slot_key', slotKey).eq('status', 'building').limit(1),
    ])
    if ((occupied?.length ?? 0) || (pending?.length ?? 0)) return NextResponse.json({ error: 'Dieser Ausbauplatz ist bereits belegt.' }, { status: 409 })
  }

  const completesAt = new Date(Date.now() + Math.max(1, def.buildTimeTicks) * 24 * 60 * 60 * 1000)
  const { data: build, error: buildError } = await serviceClient.from('player_builds').insert({
    profile_id: user.id,
    buildable_id: buildableId,
    target_type: 'building',
    location_id: location.id,
    tile_level: 0,
    tile_row: null,
    tile_col: null,
    placement_mode: mode,
    x_m: xM,
    y_m: yM,
    z_m: zM,
    rotation_deg: rotation,
    footprint_width_m: footprint.widthM,
    footprint_depth_m: footprint.depthM,
    site_id: siteId,
    parent_entity_id: parentEntityId,
    slot_key: slotKey,
    status: 'building',
    completes_at: completesAt.toISOString(),
  }).select('id').single()

  if (buildError || !build) return NextResponse.json({ error: buildError?.message ?? 'Bauauftrag konnte nicht angelegt werden.' }, { status: 500 })

  const { error: creditError } = await serviceClient.from('profiles').update({ credits: Number(profile.credits) - def.cost }).eq('id', user.id)
  if (creditError) {
    await serviceClient.from('player_builds').delete().eq('id', build.id)
    return NextResponse.json({ error: 'Credits konnten nicht belastet werden.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, buildId: build.id, placementMode: mode, xM, yM, zM, footprint, newCredits: Number(profile.credits) - def.cost, completesAt: completesAt.toISOString() })
}
