import { createClient } from '@supabase/supabase-js'
import { resolveRuntimeTerrainSampler } from '../lib/game/spatial/runtimeTerrainSampler.server'
import { sampleTerrainFootprint } from '../lib/game/spatial/terrainSampling'
import type { TerrainDatasetDescriptor, WorldFrame } from '../lib/game/spatial/types'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!rawUrl || !serviceRole) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

function normalizeSupabaseUrl(value: string) {
  const trimmed = value.trim()
  const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  if (!parsed.hostname.endsWith('.supabase.co')) throw new Error(`Unexpected Supabase host: ${parsed.hostname}`)
  return parsed.origin
}

const locationSlug = process.argv[2] ?? 'moon'
const client = createClient(normalizeSupabaseUrl(rawUrl), serviceRole)

function finite(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
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

async function main() {
  const { data: location, error: locationError } = await client.from('locations').select('id,slug').eq('slug', locationSlug).single()
  if (locationError || !location) throw new Error(`Location ${locationSlug} not found: ${locationError?.message ?? 'missing'}`)

  const { data: frameRow, error: frameError } = await client.from('world_frames').select('*').eq('location_id', location.id).single()
  if (frameError || !frameRow?.terrain_dataset_id) throw new Error(`World frame missing active terrain dataset: ${frameError?.message ?? 'missing'}`)
  const { data: datasetRow, error: datasetError } = await client.from('terrain_datasets').select('*').eq('id', frameRow.terrain_dataset_id).single()
  if (datasetError || !datasetRow || datasetRow.status !== 'ready') throw new Error(`Active terrain dataset is not ready: ${datasetError?.message ?? frameRow.terrain_dataset_id}`)

  const frame = toFrame(frameRow)
  const dataset = toDataset(datasetRow)
  const runtime = await resolveRuntimeTerrainSampler(client, dataset.id)
  if (!runtime.sampler) throw new Error(`Terrain runtime unavailable: ${runtime.details ?? dataset.id}`)

  async function syncTable(table: 'tile_entities' | 'player_builds', idColumn: 'entity_id' | 'buildable_id') {
    let query = client
      .from(table)
      .select(`id,${idColumn},placement_mode,x_m,y_m,z_m,rotation_deg,footprint_width_m,footprint_depth_m,terrain_dataset_id,terrain_status,ground_elevation_m,terrain_min_elevation_m,terrain_max_elevation_m,terrain_slope_deg`)
      .eq('location_id', location.id)
    query = table === 'tile_entities'
      ? query.in('entity_type', ['building', 'module'])
      : query.eq('target_type', 'building')

    const { data: rows, error } = await query
    if (error) throw new Error(`${table} lookup failed: ${error.message}`)

    const results = []
    for (const row of rows ?? []) {
      const xM = finite(row.x_m), yM = finite(row.y_m)
      const widthM = finite(row.footprint_width_m), depthM = finite(row.footprint_depth_m)
      const entityId = String(row[idColumn] ?? row.id)
      if (row.placement_mode !== 'world' || xM == null || yM == null || widthM == null || depthM == null || widthM <= 0 || depthM <= 0) {
        results.push({ id: row.id, entityId, status: 'skipped' })
        continue
      }

      const resolution = await sampleTerrainFootprint(runtime.sampler, { frame, dataset }, {
        xM,
        yM,
        zM: null,
        widthM,
        depthM,
        rotationDeg: finite(row.rotation_deg) ?? 0,
      })

      if (!resolution) {
        const { error: updateError } = await client.from(table).update({
          z_m: null,
          terrain_dataset_id: dataset.id,
          terrain_status: 'unresolved',
          ground_elevation_m: null,
          terrain_min_elevation_m: null,
          terrain_max_elevation_m: null,
          terrain_slope_deg: null,
        }).eq('id', row.id)
        if (updateError) throw new Error(`${table} ${entityId} update failed: ${updateError.message}`)
        results.push({ id: row.id, entityId, status: 'unresolved' })
        continue
      }

      const summary = resolution.summary
      const { error: updateError } = await client.from(table).update({
        z_m: summary.centerZM,
        terrain_dataset_id: dataset.id,
        terrain_status: 'resolved',
        ground_elevation_m: summary.centerZM,
        terrain_min_elevation_m: summary.minZM,
        terrain_max_elevation_m: summary.maxZM,
        terrain_slope_deg: summary.maxSlopeDeg,
      }).eq('id', row.id)
      if (updateError) throw new Error(`${table} ${entityId} update failed: ${updateError.message}`)

      results.push({
        id: row.id,
        entityId,
        status: 'resolved',
        centerZM: summary.centerZM,
        minZM: summary.minZM,
        maxZM: summary.maxZM,
        slopeDeg: summary.maxSlopeDeg,
        reliefM: summary.reliefM,
      })
    }
    return results
  }

  const tileEntities = await syncTable('tile_entities', 'entity_id')
  const playerBuilds = await syncTable('player_builds', 'buildable_id')
  const unresolved = [...tileEntities, ...playerBuilds].filter(row => row.status === 'unresolved')

  console.log(JSON.stringify({
    location: locationSlug,
    datasetId: dataset.id,
    tileEntities,
    playerBuilds,
    counts: {
      tileEntitiesResolved: tileEntities.filter(row => row.status === 'resolved').length,
      playerBuildsResolved: playerBuilds.filter(row => row.status === 'resolved').length,
      unresolved: unresolved.length,
    },
  }, null, 2))

  if (unresolved.length) process.exitCode = 2
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
