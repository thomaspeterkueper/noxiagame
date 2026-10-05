import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { localWorldToPlanetary } from '@/lib/game/spatial/planetary'
import type { WorldFrame } from '@/lib/game/spatial/types'
import { beginLoadingTransportJob, createTransportJob, startTransportJob } from '@/lib/game/core/logistics'
import { randomUUID } from 'node:crypto'

const ROVER_YARD = { xM: 48, yM: -26 }
const BASE_DEPOT = { xM: 22, yM: 2 }
const CORE_DEPTH_M = 10
const CORE_DURATION_SECONDS = 15 * 60
const CORE_ENERGY_COST = 25
const CORE_COMPONENT_COST = 1
const CORE_WEAR_COST = 8

async function userFromRequest(req: NextRequest) {
  const id = await verifiedBearerUserId(req)
  return id ? { id } : null
}

async function requirePhobosPresence(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await supabase.from('profiles').select('current_location').eq('id', userId).maybeSingle()
  return data?.current_location === 'phobos'
}

async function phobosContext(supabase: ReturnType<typeof createServiceClient>) {
  const { data: location, error: locationError } = await supabase.from('locations').select('id,slug').eq('slug', 'phobos').maybeSingle()
  if (locationError || !location?.id) throw new Error(locationError?.message ?? 'Phobos location missing')
  const { data: frameRow, error: frameError } = await supabase.from('world_frames').select('*').eq('location_id', location.id).maybeSingle()
  if (frameError || !frameRow) throw new Error(frameError?.message ?? 'Phobos world frame missing')
  const frame: WorldFrame = {
    locationId: frameRow.location_id,
    body: frameRow.body,
    coordinateSystem: frameRow.coordinate_system,
    originLatDeg: frameRow.origin_lat_deg,
    originLonDeg: frameRow.origin_lon_deg,
    originAltM: frameRow.origin_alt_m,
    originStatus: frameRow.origin_status,
    referenceFrame: frameRow.reference_frame,
    latitudeType: frameRow.latitude_type,
    longitudeDirection: frameRow.longitude_direction,
    equatorialRadiusM: frameRow.equatorial_radius_m,
    polarRadiusM: frameRow.polar_radius_m,
    verticalDatum: frameRow.vertical_datum,
    terrainDatasetId: frameRow.terrain_dataset_id,
    worldSeed: frameRow.world_seed,
    observedSource: frameRow.observed_source ?? {},
    derivedConfig: frameRow.derived_config ?? {},
  }
  return { location, frame }
}

async function prospectById(supabase: ReturnType<typeof createServiceClient>, prospectId: string) {
  const { data, error } = await supabase
    .from('region_resources')
    .select('id,resource_type,x_m,y_m,abundance,properties,discovered_at')
    .eq('id', prospectId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.properties?.body !== 'phobos' || data.properties?.surface_hub !== 'stickney-alpha') return null
  return data
}

async function ensureProspectCache(supabase: ReturnType<typeof createServiceClient>, prospect: any, locationId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('logistics_inventories')
    .select('id')
    .eq('subject_type', 'region_resource')
    .eq('subject_id', prospect.id)
    .eq('active', true)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existing?.id) {
    await supabase.from('logistics_inventories').update({ public_deposit: true }).eq('id', existing.id)
    return existing.id as string
  }
  const { data, error } = await supabase.from('logistics_inventories').insert({
    owner_profile_id: null,
    location_id: locationId,
    inventory_kind: 'facility',
    storage_kind: 'native',
    subject_type: 'region_resource',
    subject_id: prospect.id,
    label: `Stickney Prospect · ${String(prospect.resource_type).replaceAll('_', ' ')}`,
    capacity: 6,
    public_deposit: true,
    public_withdraw: true,
    active: true,
    metadata: {
      role: 'prospect_sample_cache', body: 'phobos', surfaceHub: 'stickney-alpha', prospectId: prospect.id,
      resourceType: prospect.resource_type, xM: prospect.x_m, yM: prospect.y_m,
      provenance: prospect.properties?.provenance ?? 'derived-gameplay-model',
    },
  }).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}

function smallBodyCoreLayers(targetDepthM: number, modeledDepthM: number, resourceType: string, hit: boolean) {
  const layers: Array<Record<string, unknown>> = [
    { fromM: 0, toM: Math.min(0.3, targetDepthM), material: 'Lockerer Phobos-Regolith', code: 'phobos_loose_regolith', origin: 'modeled', note: 'In-world Kleinkörper-Regolithmodell; keine reale lokale Bohrung.' },
  ]
  if (targetDepthM > 0.3) layers.push({ fromM: 0.3, toM: Math.min(2.0, targetDepthM), material: 'Verdichteter Regolith und Impaktfragmente', code: 'phobos_compacted_regolith', origin: 'modeled', note: 'Deterministische NOXIA-Modellschicht.' })
  if (targetDepthM > 2.0) layers.push({ fromM: 2.0, toM: targetDepthM, material: 'Fragmentierte Impaktbrekzie', code: 'phobos_impact_breccia', origin: 'modeled', note: 'Deterministische NOXIA-Modellschicht.' })
  if (hit) {
    const half = 0.45
    layers.push({
      fromM: Math.max(0, Number((modeledDepthM - half).toFixed(2))),
      toM: Math.min(targetDepthM, Number((modeledDepthM + half).toFixed(2))),
      material: resourceType === 'water' ? 'Hydrat-Signaturzone' : 'Metalltragende Regolithzone',
      code: 'prospect_intersection', origin: 'derived', resourceType,
      note: 'Schnittzone aus dem NOXIA-Prospektmodell; keine Behauptung eines realen Phobos-Vorkommens.',
    })
  }
  return layers.sort((a: any, b: any) => Number(a.fromM) - Number(b.fromM) || Number(a.toM) - Number(b.toM))
}

async function resolveDuePhobosJobs(supabase: ReturnType<typeof createServiceClient>, profileId: string, locationId: string) {
  const now = new Date().toISOString()
  const { data: due, error } = await supabase
    .from('core_sample_jobs')
    .select('*')
    .eq('profile_id', profileId)
    .eq('location_id', locationId)
    .eq('status', 'running')
    .lte('completes_at', now)
    .contains('result', { operation: 'stickney_authorized_drilling' })
  if (error) throw new Error(error.message)
  for (const job of due ?? []) {
    const prospect = job.region_resource_id ? await prospectById(supabase, job.region_resource_id) : null
    if (!prospect) {
      await supabase.from('core_sample_jobs').update({ status: 'failed', completed_at: now, result: { ...(job.result ?? {}), error: 'phobos_target_missing' } }).eq('id', job.id)
      continue
    }
    const targetDepthM = Number(job.target_depth_m ?? CORE_DEPTH_M)
    const abundance = Math.max(0, Math.min(1, Number(prospect.abundance ?? 0)))
    const modeledDepthM = Number((1.5 + (1 - abundance) * 5).toFixed(2))
    const hit = targetDepthM >= modeledDepthM
    const result = {
      ...(job.result ?? {}),
      target_depth_m: targetDepthM,
      depth_model: 'stickney_shallow_prospect_depth_v1',
      stratigraphy_model: 'phobos_regolith_breccia_v1',
      core_layers: smallBodyCoreLayers(targetDepthM, modeledDepthM, String(prospect.resource_type), hit),
      modeled_resource_depth_m: modeledDepthM,
      empty: !hit,
      evidence_kind: hit ? 'direct_drill_core' : 'core_no_intersection',
      confidence: hit ? 'high' : 'medium',
    }
    await supabase.from('core_sample_jobs').update({ status: 'completed', completed_at: now, result }).eq('id', job.id)
    if (!hit) continue

    const cacheId = await ensureProspectCache(supabase, prospect, locationId)
    const { error: sampleError } = await supabase.from('research_samples').upsert({
      prospect_id: prospect.id,
      owner_profile_id: profileId,
      source_inventory_id: cacheId,
      sample_kind: 'drill_core',
      status: 'collected',
      collected_at: now,
      metadata: {
        body: 'phobos', surfaceHub: 'stickney-alpha', provenance: 'derived-gameplay-drill-core',
        coreSampleJobId: job.id, targetDepthM, modeledResourceDepthM: modeledDepthM,
      },
      updated_at: now,
    }, { onConflict: 'prospect_id,sample_kind' })
    if (sampleError) throw new Error(sampleError.message)
    const { error: itemError } = await supabase.from('logistics_inventory_items').upsert({
      inventory_id: cacheId, resource: 'research_sample', amount: 1, updated_at: now,
    }, { onConflict: 'inventory_id,resource' })
    if (itemError) throw new Error(itemError.message)
    await supabase.from('region_resources').update({ properties: {
      ...(prospect.properties ?? {}), drill_core_job_id: job.id, drill_core_collected_at: now,
      drill_core_depth_m: targetDepthM, drill_core_modeled_intersection_m: modeledDepthM, drill_core_status: 'collected',
    } }).eq('id', prospect.id)
  }
}

async function completedDeployment(supabase: ReturnType<typeof createServiceClient>, profileId: string, locationId: string, prospectId: string) {
  const { data, error } = await supabase.from('transport_jobs').select('*')
    .eq('actor_profile_id', profileId).eq('location_id', locationId).eq('status', 'completed')
    .contains('route_snapshot', { routeKind: 'prospect-drill-deployment', prospectId })
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? null
}

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePhobosPresence(supabase, user.id)) return NextResponse.json({ error: 'Bohrmissionen sind nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
  try {
    const { location } = await phobosContext(supabase)
    await resolveDuePhobosJobs(supabase, user.id, location.id)
    const [{ data: jobs }, { data: cores }] = await Promise.all([
      supabase.from('core_sample_jobs').select('*').eq('profile_id', user.id).eq('location_id', location.id).contains('result', { operation: 'stickney_authorized_drilling' }).order('created_at', { ascending: false }).limit(20),
      supabase.from('research_samples').select('*').eq('owner_profile_id', user.id).eq('sample_kind', 'drill_core').order('collected_at', { ascending: false }).limit(20),
    ])
    return NextResponse.json({ ok: true, jobs: jobs ?? [], cores: cores ?? [] })
  } catch (error) {
    console.error('phobos drilling lookup failed:', error)
    return NextResponse.json({ error: 'Bohrstatus nicht verfügbar.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePhobosPresence(supabase, user.id)) return NextResponse.json({ error: 'Bohrmissionen sind nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : ''
  const prospectId = typeof body.prospectId === 'string' ? body.prospectId : ''
  if (!prospectId) return NextResponse.json({ error: 'prospectId erforderlich' }, { status: 400 })

  try {
    const { location, frame } = await phobosContext(supabase)
    await resolveDuePhobosJobs(supabase, user.id, location.id)
    const prospect = await prospectById(supabase, prospectId)
    if (!prospect?.discovered_at) return NextResponse.json({ error: 'Prospektionsziel ist nicht verfügbar.' }, { status: 404 })
    const developmentStatus = String(prospect.properties?.development_status ?? 'blocked')
    if (developmentStatus !== 'drilling_authorized' && developmentStatus !== 'extraction_candidate') {
      return NextResponse.json({ error: 'Für dieses Ziel liegt keine wissenschaftliche Bohrfreigabe vor.' }, { status: 409 })
    }
    const cacheId = await ensureProspectCache(supabase, prospect, location.id)

    if (action === 'deploy-drill') {
      const existing = await completedDeployment(supabase, user.id, location.id, prospectId)
      if (existing) return NextResponse.json({ ok: true, idempotent: true, job: existing })
      const { data: active } = await supabase.from('transport_jobs').select('*')
        .eq('actor_profile_id', user.id).eq('location_id', location.id)
        .in('status', ['reserved', 'loading', 'in_transit', 'arrived', 'unloading'])
        .contains('route_snapshot', { routeKind: 'prospect-drill-deployment', prospectId })
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (active) return NextResponse.json({ ok: true, idempotent: true, job: active })
      const { data: depot, error: depotError } = await supabase.from('logistics_inventories').select('id').contains('metadata', { role: 'stickney_depot' }).eq('active', true).limit(1).maybeSingle()
      if (depotError || !depot?.id) throw new Error(depotError?.message ?? 'Stickney depot missing')
      const start = BASE_DEPOT
      const target = { xM: Number(prospect.x_m), yM: Number(prospect.y_m) }
      const distanceM = Math.hypot(start.xM - ROVER_YARD.xM, start.yM - ROVER_YARD.yM) + Math.hypot(ROVER_YARD.xM - target.xM, ROVER_YARD.yM - target.yM)
      const etaSeconds = Math.max(90, Math.ceil(distanceM / 0.8))
      const job = await createTransportJob({
        commandId: randomUUID(), actorProfileId: user.id, locationId: location.id, domain: 'surface',
        sourceInventoryId: depot.id, destinationInventoryId: cacheId, vehicleRole: 'Tether Rover 01',
        resource: 'components', amount: 1,
        routeSnapshot: { passable: true, etaSeconds, routeKind: 'prospect-drill-deployment', prospectId, points: [start, ROVER_YARD, target] },
      })
      await beginLoadingTransportJob(user.id, job.id)
      const started = await startTransportJob(user.id, job.id)
      return NextResponse.json({ ok: true, action, job: started, etaSeconds })
    }

    if (action === 'start-drill') {
      if (!await completedDeployment(supabase, user.id, location.id, prospectId)) return NextResponse.json({ error: 'Bohrgerät und Verbrauchsmaterial müssen zuerst zum Prospektionsziel gebracht werden.' }, { status: 409 })
      const { data: existing } = await supabase.from('core_sample_jobs').select('*')
        .eq('profile_id', user.id).eq('location_id', location.id).eq('region_resource_id', prospectId)
        .contains('result', { operation: 'stickney_authorized_drilling' }).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (existing) return NextResponse.json({ ok: true, idempotent: true, job: existing })
      const point = localWorldToPlanetary({ xM: Number(prospect.x_m), yM: Number(prospect.y_m), zM: 0 }, frame)
      if (!point) throw new Error('Phobos frame origin unavailable')
      const { data: jobId, error: startError } = await supabase.rpc('start_core_sample_job_v2', {
        p_profile_id: user.id, p_location_id: location.id,
        p_latitude_deg: point.latDeg, p_longitude_deg: point.lonDeg,
        p_target_depth_m: CORE_DEPTH_M, p_rig_id: 'core_sample', p_wear_cost: CORE_WEAR_COST,
        p_energy_cost: CORE_ENERGY_COST, p_component_cost: CORE_COMPONENT_COST, p_duration_seconds: CORE_DURATION_SECONDS,
      })
      if (startError) {
        const message = startError.message || 'core_sample_start_failed'
        const known = ['core_sample_not_owned', 'drill_rig_not_owned', 'drill_rig_requires_service', 'insufficient_energy', 'insufficient_components']
        const code = known.find(value => message.includes(value)) ?? 'core_sample_start_failed'
        return NextResponse.json({ error: code }, { status: code.startsWith('insufficient_') || code === 'drill_rig_requires_service' ? 409 : 400 })
      }
      const { data: job, error: updateError } = await supabase.from('core_sample_jobs').update({
        region_resource_id: prospectId,
        result: {
          operation: 'stickney_authorized_drilling', body: 'phobos', surface_hub: 'stickney-alpha', prospect_id: prospectId,
          target_x_m: Number(prospect.x_m), target_y_m: Number(prospect.y_m),
          planetary_lat_deg: point.latDeg, planetary_lon_deg: point.lonDeg,
          target_provenance: prospect.properties?.provenance ?? 'derived-gameplay-model',
          note: 'In-world authorized drilling target; not a claim about a real Phobos deposit.',
        },
      }).eq('id', jobId).select('*').single()
      if (updateError) throw new Error(updateError.message)
      return NextResponse.json({ ok: true, action, job, durationSeconds: CORE_DURATION_SECONDS })
    }

    if (action === 'return-core') {
      const { data: sample, error: sampleError } = await supabase.from('research_samples').select('*').eq('prospect_id', prospectId).eq('sample_kind', 'drill_core').maybeSingle()
      if (sampleError) throw new Error(sampleError.message)
      if (!sample) return NextResponse.json({ error: 'Der Bohrkern ist noch nicht verfügbar.' }, { status: 409 })
      if (sample.status === 'returned' || sample.status === 'analyzed') return NextResponse.json({ ok: true, idempotent: true, sample })
      if (sample.return_job_id) {
        const { data: existingJob } = await supabase.from('transport_jobs').select('*').eq('id', sample.return_job_id).maybeSingle()
        if (existingJob) return NextResponse.json({ ok: true, idempotent: true, job: existingJob })
      }
      const { data: depot, error: depotError } = await supabase.from('logistics_inventories').select('id').contains('metadata', { role: 'stickney_depot' }).eq('active', true).limit(1).maybeSingle()
      if (depotError || !depot?.id) throw new Error(depotError?.message ?? 'Stickney depot missing')
      const start = { xM: Number(prospect.x_m), yM: Number(prospect.y_m) }
      const distanceM = Math.hypot(start.xM - ROVER_YARD.xM, start.yM - ROVER_YARD.yM) + Math.hypot(ROVER_YARD.xM - BASE_DEPOT.xM, ROVER_YARD.yM - BASE_DEPOT.yM)
      const etaSeconds = Math.max(90, Math.ceil(distanceM / 1.0))
      const job = await createTransportJob({
        commandId: randomUUID(), actorProfileId: user.id, locationId: location.id, domain: 'surface',
        sourceInventoryId: cacheId, destinationInventoryId: depot.id, vehicleRole: 'Tether Rover 01',
        resource: 'research_sample' as any, amount: 1,
        routeSnapshot: { passable: true, etaSeconds, routeKind: 'prospect-drill-core-return', prospectId, sampleKind: 'drill_core', points: [start, ROVER_YARD, BASE_DEPOT] },
      })
      await beginLoadingTransportJob(user.id, job.id)
      const started = await startTransportJob(user.id, job.id)
      return NextResponse.json({ ok: true, action, job: started, etaSeconds })
    }

    return NextResponse.json({ error: 'Ungültige Bohraktion.' }, { status: 400 })
  } catch (error) {
    console.error('phobos drilling operation failed:', error)
    return NextResponse.json({ error: 'Stickney-Bohrmission fehlgeschlagen.' }, { status: 503 })
  }
}
