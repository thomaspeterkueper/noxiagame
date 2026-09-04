import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BUILDINGS } from '@/lib/game/buildings'
import { getBuildRequirements } from '@/lib/knowledge/buildRequirements'
import { getNoxiaKnowledgeState } from '@/lib/knowledge/service'
import { canPlace, legacyTileToMeters, type OccupiedPlacement } from '@/lib/game/spatial/placement'
import { getBuildFootprint, getLegacyFootprint } from '@/lib/game/spatial/buildFootprints'
import type { RectFootprint } from '@/lib/game/spatial/types'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

type RawBuildingDef = {
  key: string
  name: string
  cost_credits: number
  build_time_ticks: number
  allowed_locations: string[] | null
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

function localDef(key: string): RawBuildingDef | null {
  const def = BUILDINGS[key]
  if (!def || def.planned) return null
  return {
    key,
    name: def.name,
    cost_credits: def.cost,
    build_time_ticks: def.buildTimeTicks,
    allowed_locations: def.allowedLocations ?? null,
  }
}

async function loadBuildingDef(key: string): Promise<RawBuildingDef | null> {
  const { data } = await serviceClient
    .from('building_definitions')
    .select('key, name, cost_credits, build_time_ticks, allowed_locations')
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle()
  if (!data) return localDef(key)
  return {
    key: data.key,
    name: data.name,
    cost_credits: Number(data.cost_credits ?? 0),
    build_time_ticks: Number(data.build_time_ticks ?? 1),
    allowed_locations: data.allowed_locations ?? null,
  }
}

function finiteParam(params: URLSearchParams, name: string): number | null {
  const raw = params.get(name)
  if (raw == null || raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function rowToPlacement(row: any): OccupiedPlacement | null {
  let xM = typeof row.x_m === 'number' ? row.x_m : null
  let yM = typeof row.y_m === 'number' ? row.y_m : null
  if ((xM == null || yM == null) && Number.isFinite(row.tile_row) && Number.isFinite(row.tile_col)) {
    const legacy = legacyTileToMeters(row.tile_row, row.tile_col)
    xM = legacy.xM
    yM = legacy.yM
  }
  if (xM == null || yM == null) return null

  const footprint: RectFootprint = row.footprint_width_m > 0 && row.footprint_depth_m > 0
    ? { kind: 'rect', widthM: Number(row.footprint_width_m), depthM: Number(row.footprint_depth_m) }
    : getLegacyFootprint()

  return {
    id: row.id,
    position: { xM, yM, zM: Number(row.z_m ?? 0), rotationDeg: Number(row.rotation_deg ?? 0) },
    footprint,
  }
}

async function loadSpatialFrame(locationId: string) {
  const { data } = await serviceClient
    .from('location_spatial_frames')
    .select('extent_width_m, extent_height_m')
    .eq('location_id', locationId)
    .maybeSingle()
  return data
}

function insideFrame(xM: number, yM: number, footprint: RectFootprint, frame: any): boolean {
  if (!frame?.extent_width_m || !frame?.extent_height_m) return true
  const halfW = footprint.widthM / 2
  const halfD = footprint.depthM / 2
  return xM - halfW >= 0 && yM - halfD >= 0
    && xM + halfW <= Number(frame.extent_width_m)
    && yM + halfD <= Number(frame.extent_height_m)
}

async function insideSite(siteId: string, locationId: string, xM: number, yM: number, footprint: RectFootprint) {
  const { data: site } = await serviceClient
    .from('build_sites')
    .select('id, location_id, center_x_m, center_y_m, width_m, depth_m')
    .eq('id', siteId)
    .maybeSingle()
  if (!site || site.location_id !== locationId) return { ok: false, error: 'Baufläche nicht gefunden' }
  if (site.width_m == null || site.depth_m == null) return { ok: true, site }

  const minX = Number(site.center_x_m) - Number(site.width_m) / 2
  const maxX = Number(site.center_x_m) + Number(site.width_m) / 2
  const minY = Number(site.center_y_m) - Number(site.depth_m) / 2
  const maxY = Number(site.center_y_m) + Number(site.depth_m) / 2
  const halfW = footprint.widthM / 2
  const halfD = footprint.depthM / 2
  if (xM - halfW < minX || xM + halfW > maxX || yM - halfD < minY || yM + halfD > maxY) {
    return { ok: false, error: 'Gebäude liegt außerhalb der Baufläche' }
  }
  return { ok: true, site }
}

async function completeDueBuilds(profileId: string) {
  const { data: due } = await serviceClient
    .from('player_builds')
    .select('*')
    .eq('profile_id', profileId)
    .eq('target_type', 'building')
    .eq('status', 'building')
    .lte('completes_at', new Date().toISOString())

  for (const build of due ?? []) {
    if (build.x_m == null || build.y_m == null) continue
    const { data: existing } = await serviceClient
      .from('tile_entities')
      .select('id')
      .eq('profile_id', profileId)
      .eq('location_id', build.location_id)
      .eq('entity_type', 'building')
      .eq('x_m', build.x_m)
      .eq('y_m', build.y_m)
      .eq('entity_id', build.buildable_id)
      .maybeSingle()

    let entityId = existing?.id ?? null
    if (!entityId) {
      const { data: inserted, error } = await serviceClient
        .from('tile_entities')
        .insert({
          profile_id: profileId,
          location_id: build.location_id,
          entity_type: 'building',
          entity_id: build.buildable_id,
          owner_class: 'PLAYER',
          owner_id: profileId,
          status: 'active',
          condition: 100,
          tile_level: build.tile_level ?? 0,
          tile_row: build.tile_row,
          tile_col: build.tile_col,
          x_m: build.x_m,
          y_m: build.y_m,
          z_m: build.z_m ?? 0,
          rotation_deg: build.rotation_deg ?? 0,
          footprint_width_m: build.footprint_width_m,
          footprint_depth_m: build.footprint_depth_m,
          site_id: build.site_id,
        })
        .select('id')
        .single()
      if (error || !inserted) continue
      entityId = inserted.id
    }

    await serviceClient.from('player_builds')
      .update({ status: 'complete', entity_ref: entityId })
      .eq('id', build.id)
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await completeDueBuilds(user.id)
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (!action) {
    const { data: builds } = await serviceClient
      .from('player_builds')
      .select('*, locations(slug, name)')
      .eq('profile_id', user.id)
      .eq('target_type', 'building')
      .in('status', ['building', 'complete'])
      .not('x_m', 'is', null)
      .not('y_m', 'is', null)
      .order('created_at', { ascending: false })
    return NextResponse.json({ builds: builds ?? [] })
  }

  if (action === 'start') {
    const buildableId = searchParams.get('buildableId')
    const locationSlug = searchParams.get('location')
    const xM = finiteParam(searchParams, 'xM')
    const yM = finiteParam(searchParams, 'yM')
    const zM = finiteParam(searchParams, 'zM') ?? 0
    const rotationDeg = finiteParam(searchParams, 'rotationDeg') ?? 0
    const siteId = searchParams.get('siteId')

    if (!buildableId || !locationSlug || xM == null || yM == null) {
      return NextResponse.json({ error: 'buildableId, location, xM und yM sind erforderlich' }, { status: 400 })
    }
    if (Math.abs(xM) > 10_000_000 || Math.abs(yM) > 10_000_000 || Math.abs(zM) > 100_000) {
      return NextResponse.json({ error: 'Koordinate außerhalb des zulässigen lokalen Bereichs' }, { status: 400 })
    }

    const def = await loadBuildingDef(buildableId)
    if (!def) return NextResponse.json({ error: 'Unbekannter oder inaktiver Bautyp', buildableId }, { status: 400 })
    if (def.allowed_locations?.length && !def.allowed_locations.includes(locationSlug)) {
      return NextResponse.json({ error: `${def.name} kann hier nicht gebaut werden.` }, { status: 400 })
    }

    const knowledge = await getNoxiaKnowledgeState(user.id)
    const gate = getBuildRequirements(buildableId, { completedModules: knowledge.completedModules, unlocked: knowledge.unlocked })
    if (!gate.ok) return NextResponse.json({ error: `Wissen fehlt: ${gate.requiredUnlock}` }, { status: 403 })

    const { data: location } = await serviceClient.from('locations').select('id').eq('slug', locationSlug).single()
    if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

    const footprint = getBuildFootprint(buildableId)
    const frame = await loadSpatialFrame(location.id)
    if (!insideFrame(xM, yM, footprint, frame)) {
      return NextResponse.json({ error: 'Gebäude liegt außerhalb des Standortbereichs' }, { status: 400 })
    }
    if (siteId) {
      const siteCheck = await insideSite(siteId, location.id, xM, yM, footprint)
      if (!siteCheck.ok) return NextResponse.json({ error: siteCheck.error }, { status: 400 })
    }

    const [{ data: entities }, { data: pending }] = await Promise.all([
      serviceClient.from('tile_entities')
        .select('id, x_m, y_m, z_m, rotation_deg, footprint_width_m, footprint_depth_m, tile_row, tile_col')
        .eq('location_id', location.id)
        .eq('entity_type', 'building')
        .is('parent_id', null),
      serviceClient.from('player_builds')
        .select('id, x_m, y_m, z_m, rotation_deg, footprint_width_m, footprint_depth_m, tile_row, tile_col')
        .eq('location_id', location.id)
        .eq('target_type', 'building')
        .eq('status', 'building'),
    ])

    const occupied = [...(entities ?? []), ...(pending ?? [])]
      .map(rowToPlacement)
      .filter((value): value is OccupiedPlacement => value != null)
    const candidate: OccupiedPlacement = {
      position: { xM, yM, zM, rotationDeg },
      footprint,
    }
    if (!canPlace(candidate, occupied)) {
      return NextResponse.json({ error: 'Baufläche überschneidet sich mit einem bestehenden oder geplanten Gebäude.' }, { status: 409 })
    }

    const { data: profile } = await serviceClient.from('profiles').select('credits').eq('id', user.id).single()
    if (!profile || profile.credits < def.cost_credits) {
      return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })
    }

    const completesAt = new Date()
    completesAt.setHours(completesAt.getHours() + def.build_time_ticks * 24)

    const { data: build, error: buildError } = await serviceClient
      .from('player_builds')
      .insert({
        profile_id: user.id,
        buildable_id: buildableId,
        target_type: 'building',
        location_id: location.id,
        tile_level: 0,
        tile_row: null,
        tile_col: null,
        x_m: xM,
        y_m: yM,
        z_m: zM,
        rotation_deg: ((rotationDeg % 360) + 360) % 360,
        footprint_width_m: footprint.widthM,
        footprint_depth_m: footprint.depthM,
        site_id: siteId || null,
        status: 'building',
        completes_at: completesAt.toISOString(),
      })
      .select('id')
      .single()

    if (buildError || !build) {
      return NextResponse.json({ error: 'Bauauftrag konnte nicht angelegt werden' }, { status: 500 })
    }

    const { error: creditError } = await serviceClient
      .from('profiles')
      .update({ credits: profile.credits - def.cost_credits })
      .eq('id', user.id)
    if (creditError) {
      await serviceClient.from('player_builds').delete().eq('id', build.id)
      return NextResponse.json({ error: 'Credits konnten nicht gebucht werden' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      buildId: build.id,
      buildable: def.name,
      position: { xM, yM, zM, rotationDeg: ((rotationDeg % 360) + 360) % 360 },
      footprint,
      siteId: siteId || null,
      newCredits: profile.credits - def.cost_credits,
      completesAt: completesAt.toISOString(),
    })
  }

  if (action === 'cancel') {
    const buildId = searchParams.get('buildId')
    if (!buildId) return NextResponse.json({ error: 'Fehlende Build ID' }, { status: 400 })
    const { data: build } = await serviceClient
      .from('player_builds')
      .select('*')
      .eq('id', buildId)
      .eq('profile_id', user.id)
      .eq('target_type', 'building')
      .eq('status', 'building')
      .not('x_m', 'is', null)
      .maybeSingle()
    if (!build) return NextResponse.json({ error: 'Räumlicher Bauauftrag nicht gefunden' }, { status: 404 })

    const def = await loadBuildingDef(build.buildable_id)
    const refund = Math.floor((def?.cost_credits ?? 0) * 0.5)
    const { data: profile } = await serviceClient.from('profiles').select('credits').eq('id', user.id).single()
    await serviceClient.from('player_builds').update({ status: 'cancelled' }).eq('id', build.id)
    if (profile && refund > 0) {
      await serviceClient.from('profiles').update({ credits: profile.credits + refund }).eq('id', user.id)
    }
    return NextResponse.json({ ok: true, refund })
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}
