import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveRuntimeTerrainSampler } from '@/lib/game/spatial/runtimeTerrainSampler.server'
import { sampleTerrainFootprint } from '@/lib/game/spatial/terrainSampling'
import type { TerrainDatasetDescriptor, WorldFrame } from '@/lib/game/spatial/types'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

type SyncBody = { location?: string; force?: boolean }
type SpatialTerrainRow = {
  id: string
  entityId: string
  placement_mode: string | null
  x_m: unknown
  y_m: unknown
  rotation_deg: unknown
  footprint_width_m: unknown
  footprint_depth_m: unknown
  terrain_dataset_id: string | null
  terrain_status: string | null
  ground_elevation_m: unknown
  terrain_min_elevation_m: unknown
  terrain_max_elevation_m: unknown
  terrain_slope_deg: unknown
}

type SyncCounters = { updated: number; unresolved: number; skipped: number }
type SyncResult = { source: 'tile_entity' | 'player_build'; id: string; entityId: string; status: string; slopeDeg?: number; reliefM?: number }

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const { data: { user } } = await serviceClient.auth.getUser(auth.slice(7))
  return user
}

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function toFrame(row: any): WorldFrame {
  return {
    locationId: row.location_id,
    body: row.body,
    coordinateSystem: row.coordinate_system,
    originLatDeg: row.origin_lat_deg,
    originLonDeg: row.origin_lon_deg,
    originAltM: row.origin_alt_m,
    originStatus: row.origin_status,
    referenceFrame: row.reference_frame,
    latitudeType: row.latitude_type,
    longitudeDirection: row.longitude_direction,
    equatorialRadiusM: row.equatorial_radius_m,
    polarRadiusM: row.polar_radius_m,
    verticalDatum: row.vertical_datum,
    terrainDatasetId: row.terrain_dataset_id,
    worldSeed: String(row.world_seed ?? row.location_id),
    observedSource: row.observed_source ?? undefined,
    derivedConfig: row.derived_config ?? undefined,
  }
}

function toDataset(row: any): TerrainDatasetDescriptor {
  return {
    id: row.id,
    body: row.body,
    locationId: row.location_id,
    provider: row.provider,
    datasetName: row.dataset_name,
    datasetVersion: row.dataset_version,
    datasetKind: row.dataset_kind,
    resolutionM: row.resolution_m,
    horizontalReference: row.horizontal_reference,
    verticalReference: row.vertical_reference,
    latitudeType: row.latitude_type,
    longitudeDirection: row.longitude_direction,
    sourceUri: row.source_uri,
    sourceLicense: row.source_license,
    accessMode: row.access_mode,
    status: row.status,
    metadata: row.metadata ?? {},
  }
}

async function syncRows(params: {
  table: 'tile_entities' | 'player_builds'
  source: 'tile_entity' | 'player_build'
  rows: SpatialTerrainRow[]
  frame: WorldFrame
  dataset: TerrainDatasetDescriptor
  sampler: NonNullable<Awaited<ReturnType<typeof resolveRuntimeTerrainSampler>>['sampler']>
  force: boolean
}) {
  const counters: SyncCounters = { updated: 0, unresolved: 0, skipped: 0 }
  const results: SyncResult[] = []

  for (const row of params.rows) {
    const xM = finite(row.x_m), yM = finite(row.y_m)
    const widthM = finite(row.footprint_width_m), depthM = finite(row.footprint_depth_m)
    if (row.placement_mode !== 'world' || xM == null || yM == null || widthM == null || depthM == null || widthM <= 0 || depthM <= 0) {
      counters.skipped += 1
      continue
    }

    const alreadyResolved = row.terrain_dataset_id === params.dataset.id
      && row.terrain_status === 'resolved'
      && finite(row.ground_elevation_m) != null
      && finite(row.terrain_min_elevation_m) != null
      && finite(row.terrain_max_elevation_m) != null
      && finite(row.terrain_slope_deg) != null
    if (alreadyResolved && !params.force) {
      counters.skipped += 1
      continue
    }

    const resolution = await sampleTerrainFootprint(params.sampler, { frame: params.frame, dataset: params.dataset }, {
      xM,
      yM,
      zM: null,
      widthM,
      depthM,
      rotationDeg: finite(row.rotation_deg) ?? 0,
    })

    if (!resolution) {
      counters.unresolved += 1
      const { error } = await serviceClient.from(params.table).update({
        z_m: null,
        terrain_dataset_id: params.dataset.id,
        terrain_status: 'unresolved',
        ground_elevation_m: null,
        terrain_min_elevation_m: null,
        terrain_max_elevation_m: null,
        terrain_slope_deg: null,
      }).eq('id', row.id)
      if (error) throw new Error(`${params.table} ${row.entityId}: ${error.message}`)
      results.push({ source: params.source, id: row.id, entityId: row.entityId, status: 'unresolved' })
      continue
    }

    const summary = resolution.summary
    const { error } = await serviceClient.from(params.table).update({
      z_m: summary.centerZM,
      terrain_dataset_id: params.dataset.id,
      terrain_status: 'resolved',
      ground_elevation_m: summary.centerZM,
      terrain_min_elevation_m: summary.minZM,
      terrain_max_elevation_m: summary.maxZM,
      terrain_slope_deg: summary.maxSlopeDeg,
    }).eq('id', row.id)
    if (error) throw new Error(`${params.table} ${row.entityId}: ${error.message}`)

    counters.updated += 1
    results.push({
      source: params.source,
      id: row.id,
      entityId: row.entityId,
      status: 'resolved',
      slopeDeg: summary.maxSlopeDeg,
      reliefM: summary.reliefM,
    })
  }

  return { counters, results }
}

/**
 * Persist authoritative footprint-level terrain metrics for metric world objects.
 * This route is body-independent: dataset-specific sampling is selected through
 * the runtime terrain-sampler registry, while footprint sampling and persistence
 * are shared by Moon, Mars and later spherical/ellipsoidal worlds.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as SyncBody
  const locationSlug = body.location ?? 'moon'

  const { data: location } = await serviceClient
    .from('locations')
    .select('id,slug,name')
    .eq('slug', locationSlug)
    .maybeSingle()
  if (!location) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const { data: frameRow } = await serviceClient
    .from('world_frames')
    .select('*')
    .eq('location_id', location.id)
    .maybeSingle()
  if (!frameRow?.terrain_dataset_id) {
    return NextResponse.json({ ok: true, location: locationSlug, updated: 0, unresolved: 0, skipped: 0, reason: 'no-active-terrain-dataset' })
  }

  const { data: datasetRow } = await serviceClient
    .from('terrain_datasets')
    .select('*')
    .eq('id', frameRow.terrain_dataset_id)
    .maybeSingle()
  if (!datasetRow || datasetRow.status !== 'ready') {
    return NextResponse.json({ ok: true, location: locationSlug, updated: 0, unresolved: 0, skipped: 0, reason: 'terrain-dataset-not-ready' })
  }

  const frame = toFrame(frameRow)
  const dataset = toDataset(datasetRow)
  const runtime = await resolveRuntimeTerrainSampler(serviceClient, dataset.id)
  if (!runtime.sampler) {
    return NextResponse.json({ ok: true, location: locationSlug, updated: 0, unresolved: 0, skipped: 0, reason: runtime.details ?? 'terrain-runtime-unavailable' })
  }

  const [{ data: entityRows, error: entityError }, { data: buildRows, error: buildError }] = await Promise.all([
    serviceClient
      .from('tile_entities')
      .select('id,entity_id,placement_mode,x_m,y_m,z_m,rotation_deg,footprint_width_m,footprint_depth_m,terrain_dataset_id,terrain_status,ground_elevation_m,terrain_min_elevation_m,terrain_max_elevation_m,terrain_slope_deg')
      .eq('location_id', location.id)
      .in('entity_type', ['building', 'module']),
    serviceClient
      .from('player_builds')
      .select('id,buildable_id,placement_mode,x_m,y_m,z_m,rotation_deg,footprint_width_m,footprint_depth_m,terrain_dataset_id,terrain_status,ground_elevation_m,terrain_min_elevation_m,terrain_max_elevation_m,terrain_slope_deg')
      .eq('location_id', location.id)
      .eq('target_type', 'building'),
  ])
  if (entityError) return NextResponse.json({ error: entityError.message }, { status: 500 })
  if (buildError) return NextResponse.json({ error: buildError.message }, { status: 500 })

  try {
    const entitySync = await syncRows({
      table: 'tile_entities',
      source: 'tile_entity',
      rows: (entityRows ?? []).map(row => ({ ...row, entityId: row.entity_id })),
      frame,
      dataset,
      sampler: runtime.sampler,
      force: Boolean(body.force),
    })
    const buildSync = await syncRows({
      table: 'player_builds',
      source: 'player_build',
      rows: (buildRows ?? []).map(row => ({ ...row, entityId: row.buildable_id })),
      frame,
      dataset,
      sampler: runtime.sampler,
      force: Boolean(body.force),
    })

    return NextResponse.json({
      ok: true,
      location: locationSlug,
      body: frame.body,
      datasetId: dataset.id,
      updated: entitySync.counters.updated + buildSync.counters.updated,
      unresolved: entitySync.counters.unresolved + buildSync.counters.unresolved,
      skipped: entitySync.counters.skipped + buildSync.counters.skipped,
      tileEntities: entitySync.counters,
      playerBuilds: buildSync.counters,
      results: [...entitySync.results, ...buildSync.results],
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
