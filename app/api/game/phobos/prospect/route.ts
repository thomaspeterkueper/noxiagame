import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  beginLoadingTransportJob,
  createTransportJob,
  startTransportJob,
} from '@/lib/game/core/logistics'
import {
  observationSeriesConfidence,
  prospectGroundTruthKey,
  prospectObservationDescriptor,
} from '@/lib/game/science/prospectObservationSeries'

const DEFAULT_RADIUS_M = 180
const MAX_RADIUS_M = 600
const CHANCE: Record<string, number> = { trace: 0.45, viable: 0.72, rich: 0.9, exceptional: 0.97 }
const ROVER_YARD = { xM: 48, yM: -26 }
const BASE_DEPOT = { xM: 22, yM: 2 }

type ObservationSnapshot = {
  signalKind?: string | null
  sourceType?: string | null
  interpretationLabel?: string | null
  confidence?: string | null
  measurementCount?: number | null
  lastMeasuredAt?: string | null
  evidenceKind?: string | null
  evidence?: Record<string, unknown> | null
}

async function userFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function finite(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function dto(row: any, sample?: { cacheInventoryId?: string | null; sampleAvailable?: boolean }, observation?: ObservationSnapshot | null) {
  const props = row.properties ?? {}
  return {
    id: row.id,
    resourceType: row.resource_type,
    xM: row.x_m,
    yM: row.y_m,
    abundance: row.discovered_at ? row.abundance : null,
    tier: props.tier ?? null,
    confidence: props.confidence ?? null,
    provenance: props.provenance ?? null,
    discoveredAt: row.discovered_at,
    discoveredVia: row.discovered_via,
    sampledAt: props.sampled_at ?? null,
    cacheInventoryId: sample?.cacheInventoryId ?? null,
    sampleAvailable: sample?.sampleAvailable ?? false,
    observation: observation ?? null,
  }
}

async function candidates(supabase = createServiceClient()) {
  const { data, error } = await supabase
    .from('region_resources')
    .select('id,resource_type,x_m,y_m,abundance,properties,discovered_at,discovered_via')
    .contains('properties', { body: 'phobos', surface_hub: 'stickney-alpha' })
  if (error) throw new Error(error.message)
  return data ?? []
}

async function phobosLocationId(supabase: ReturnType<typeof createServiceClient>) {
  const { data, error } = await supabase.from('locations').select('id').eq('slug', 'phobos').maybeSingle()
  if (error || !data?.id) throw new Error(error?.message ?? 'Phobos location missing')
  return data.id as string
}

async function ensureProspectCache(supabase: ReturnType<typeof createServiceClient>, row: any) {
  const { data: existing, error: lookupError } = await supabase
    .from('logistics_inventories')
    .select('id')
    .eq('storage_kind', 'native')
    .eq('subject_type', 'region_resource')
    .eq('subject_id', row.id)
    .maybeSingle()
  if (lookupError) throw new Error(lookupError.message)
  if (existing?.id) return existing.id as string

  const locationId = await phobosLocationId(supabase)
  const { data, error } = await supabase
    .from('logistics_inventories')
    .insert({
      owner_profile_id: null,
      location_id: locationId,
      inventory_kind: 'facility',
      storage_kind: 'native',
      subject_type: 'region_resource',
      subject_id: row.id,
      label: `Stickney Prospect · ${String(row.resource_type).replaceAll('_', ' ')}`,
      capacity: 4,
      public_deposit: false,
      public_withdraw: true,
      active: true,
      metadata: {
        role: 'prospect_sample_cache',
        body: 'phobos',
        surfaceHub: 'stickney-alpha',
        prospectId: row.id,
        resourceType: row.resource_type,
        xM: row.x_m,
        yM: row.y_m,
        provenance: row.properties?.provenance ?? 'derived-gameplay-model',
      },
    })
    .select('id')
    .single()
  if (error) {
    const { data: raced } = await supabase
      .from('logistics_inventories')
      .select('id')
      .eq('storage_kind', 'native')
      .eq('subject_type', 'region_resource')
      .eq('subject_id', row.id)
      .maybeSingle()
    if (raced?.id) return raced.id as string
    throw new Error(error.message)
  }
  return data.id as string
}

function observationSnapshot(row: any): ObservationSnapshot {
  return {
    signalKind: row.signal_kind ?? null,
    sourceType: row.source_type ?? null,
    interpretationLabel: row.interpretation_label ?? null,
    confidence: row.confidence ?? null,
    measurementCount: Number(row.measurement_count ?? 0),
    lastMeasuredAt: row.last_measured_at ?? null,
    evidenceKind: row.evidence_kind ?? null,
    evidence: row.evidence ?? null,
  }
}

async function observationMap(supabase: ReturnType<typeof createServiceClient>, resourceIds: string[]) {
  if (!resourceIds.length) return new Map<string, ObservationSnapshot>()
  const { data, error } = await supabase
    .from('scanner_discoveries')
    .select('region_resource_id,signal_kind,source_type,interpretation_label,confidence,evidence,last_measured_at,measurement_count,evidence_kind')
    .in('region_resource_id', resourceIds)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).filter(row => row.region_resource_id).map(row => [String(row.region_resource_id), observationSnapshot(row)]))
}

async function annotateSamples(supabase: ReturnType<typeof createServiceClient>, rows: any[]) {
  const discovered = rows.filter(row => row.discovered_at)
  if (!discovered.length) return []
  const cacheRows = await Promise.all(discovered.map(async row => ({ row, cacheId: await ensureProspectCache(supabase, row) })))
  const cacheIds = cacheRows.map(item => item.cacheId)
  const [sampleResult, observations] = await Promise.all([
    supabase
      .from('logistics_inventory_items')
      .select('inventory_id,amount')
      .in('inventory_id', cacheIds)
      .eq('resource', 'research_sample'),
    observationMap(supabase, discovered.map(row => String(row.id))),
  ])
  if (sampleResult.error) throw new Error(sampleResult.error.message)
  const available = new Map((sampleResult.data ?? []).map(item => [item.inventory_id, Number(item.amount ?? 0) > 0]))
  return cacheRows.map(({ row, cacheId }) => dto(
    row,
    { cacheInventoryId: cacheId, sampleAvailable: available.get(cacheId) === true },
    observations.get(String(row.id)) ?? null,
  ))
}

async function requirePhobosPresence(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('current_location').eq('id', userId).maybeSingle()
  return profile?.current_location === 'phobos'
}

async function recordProspectObservation(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  locationId: string,
  row: any,
  measuredAt: string,
) {
  const descriptor = prospectObservationDescriptor(String(row.resource_type))
  const groundTruthKey = prospectGroundTruthKey(String(row.id))
  const { data: existing, error: lookupError } = await supabase
    .from('scanner_discoveries')
    .select('id,measurement_count,first_discovered_at,discovered_by_profile_id')
    .eq('location_id', locationId)
    .eq('ground_truth_key', groundTruthKey)
    .maybeSingle()
  if (lookupError) throw new Error(lookupError.message)

  const measurementCount = Number(existing?.measurement_count ?? 0) + 1
  const confidence = observationSeriesConfidence(measurementCount)
  const evidence = {
    body: 'phobos',
    surfaceHub: 'stickney-alpha',
    observables: descriptor.observables,
    measurementSeries: 'stickney_surface_prospect_v1',
    modelProvenance: row.properties?.provenance ?? 'derived-gameplay-model',
    note: 'In-world indirect observation tied to a modelled prospect; not evidence of a real Phobos deposit.',
  }
  const shared = {
    signal_kind: descriptor.signalKind,
    source_type: descriptor.sourceType,
    interpretation_label: descriptor.interpretationLabel,
    confidence,
    evidence,
    last_measured_at: measuredAt,
    measurement_count: measurementCount,
    region_resource_id: row.id,
    resource_type: row.resource_type,
    abundance_tier: row.properties?.tier ?? null,
    evidence_kind: descriptor.evidenceKind,
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('scanner_discoveries')
      .update(shared)
      .eq('id', existing.id)
      .select('id,signal_kind,source_type,interpretation_label,confidence,evidence,last_measured_at,measurement_count,evidence_kind')
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  const { data, error } = await supabase
    .from('scanner_discoveries')
    .insert({
      ...shared,
      discovered_by_profile_id: userId,
      location_id: locationId,
      ground_truth_key: groundTruthKey,
      first_discovered_at: measuredAt,
    })
    .select('id,signal_kind,source_type,interpretation_label,confidence,evidence,last_measured_at,measurement_count,evidence_kind')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePhobosPresence(supabase, user.id)) return NextResponse.json({ error: 'Prospektion ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })

  try {
    const rows = await candidates(supabase)
    return NextResponse.json({ ok: true, body: 'phobos', hub: 'stickney-alpha', discoveries: await annotateSamples(supabase, rows) })
  } catch {
    return NextResponse.json({ error: 'Prospektionsdaten nicht verfügbar.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePhobosPresence(supabase, user.id)) return NextResponse.json({ error: 'Prospektion ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : 'scan'

  try {
    const rows = await candidates(supabase)

    if (action === 'collect-sample') {
      const row = rows.find((candidate: any) => candidate.id === body.prospectId && candidate.discovered_at)
      if (!row) return NextResponse.json({ error: 'Entdecktes Prospektionsziel nicht gefunden.' }, { status: 404 })
      const props = row.properties ?? {}
      if (props.sampled_at) return NextResponse.json({ error: 'An diesem Ziel wurde bereits eine Referenzprobe entnommen.' }, { status: 409 })
      const cacheId = await ensureProspectCache(supabase, row)
      const sampledAt = new Date().toISOString()
      const { error: itemError } = await supabase
        .from('logistics_inventory_items')
        .upsert({ inventory_id: cacheId, resource: 'research_sample', amount: 1, updated_at: sampledAt }, { onConflict: 'inventory_id,resource' })
      if (itemError) throw new Error(itemError.message)
      const { data: updated, error: updateError } = await supabase
        .from('region_resources')
        .update({ properties: { ...props, sampled_at: sampledAt, sampled_by: user.id, sample_kind: 'regolith_reference' } })
        .eq('id', row.id)
        .select('id,resource_type,x_m,y_m,abundance,properties,discovered_at,discovered_via')
        .single()
      if (updateError) throw new Error(updateError.message)
      return NextResponse.json({ ok: true, action, prospect: dto(updated, { cacheInventoryId: cacheId, sampleAvailable: true }) })
    }

    if (action === 'return-sample') {
      const row = rows.find((candidate: any) => candidate.id === body.prospectId && candidate.discovered_at)
      if (!row) return NextResponse.json({ error: 'Entdecktes Prospektionsziel nicht gefunden.' }, { status: 404 })
      const cacheId = await ensureProspectCache(supabase, row)
      const { data: sampleItem, error: sampleError } = await supabase
        .from('logistics_inventory_items')
        .select('amount')
        .eq('inventory_id', cacheId)
        .eq('resource', 'research_sample')
        .maybeSingle()
      if (sampleError) throw new Error(sampleError.message)
      if (Number(sampleItem?.amount ?? 0) < 1) return NextResponse.json({ error: 'Am Prospektionspunkt liegt keine Probe zum Rücktransport bereit.' }, { status: 409 })

      const { data: depot, error: depotError } = await supabase
        .from('logistics_inventories')
        .select('id,location_id')
        .contains('metadata', { role: 'stickney_depot' })
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      if (depotError || !depot?.id || !depot.location_id) throw new Error(depotError?.message ?? 'Stickney depot missing')

      const start = { xM: Number(row.x_m), yM: Number(row.y_m) }
      const distanceM = Math.hypot(start.xM - ROVER_YARD.xM, start.yM - ROVER_YARD.yM) + Math.hypot(ROVER_YARD.xM - BASE_DEPOT.xM, ROVER_YARD.yM - BASE_DEPOT.yM)
      const etaSeconds = Math.max(60, Math.ceil(distanceM / 1.2))
      const job = await createTransportJob({
        commandId: randomUUID(),
        actorProfileId: user.id,
        locationId: depot.location_id,
        domain: 'surface',
        sourceInventoryId: cacheId,
        destinationInventoryId: depot.id,
        vehicleRole: 'Tether Rover 01',
        resource: 'research_sample' as any,
        amount: 1,
        routeSnapshot: {
          passable: true,
          etaSeconds,
          routeKind: 'prospect-sample-return',
          prospectId: row.id,
          points: [start, ROVER_YARD, BASE_DEPOT],
        },
      })
      await beginLoadingTransportJob(user.id, job.id)
      const started = await startTransportJob(user.id, job.id)
      return NextResponse.json({ ok: true, action, job: started, etaSeconds })
    }

    const xM = finite(body.xM, 0)
    const yM = finite(body.yM, 0)
    const radiusM = Math.min(MAX_RADIUS_M, Math.max(25, finite(body.radiusM, DEFAULT_RADIUS_M)))
    const inRange = rows.filter((row: any) => {
      const x = Number(row.x_m), y = Number(row.y_m)
      return Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x - xM, y - yM) <= radiusM
    })
    const alreadyKnown = inRange.filter((row: any) => row.discovered_at)
    const undiscovered = inRange.filter((row: any) => !row.discovered_at)
    const locationId = await phobosLocationId(supabase)
    const now = new Date().toISOString()
    const newlyDiscovered: any[] = []
    const observations: any[] = []

    const { error: scanEventError } = await supabase.from('events').insert({
      profile_id: user.id,
      location_id: locationId,
      type: 'phobos_prospect_scan',
      payload: {
        body: 'phobos',
        surfaceHub: 'stickney-alpha',
        xM,
        yM,
        radiusM,
        scannedTargetIds: inRange.map((row: any) => row.id),
        knownTargetIds: alreadyKnown.map((row: any) => row.id),
      },
    })
    if (scanEventError) throw new Error(scanEventError.message)

    for (const row of alreadyKnown) {
      observations.push(await recordProspectObservation(supabase, user.id, locationId, row, now))
    }

    for (const row of undiscovered) {
      const props = row.properties ?? {}
      const chance = CHANCE[String(props.tier ?? 'trace')] ?? CHANCE.trace
      if (Math.random() >= chance) continue
      const nextProperties = { ...props, discovered_from_x_m: xM, discovered_from_y_m: yM }
      const { data: updated, error } = await supabase
        .from('region_resources')
        .update({ discovered_at: now, discovered_via: 'phobos_rover_observation', properties: nextProperties })
        .eq('id', row.id)
        .is('discovered_at', null)
        .select('id,resource_type,x_m,y_m,abundance,properties,discovered_at,discovered_via')
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (updated) {
        observations.push(await recordProspectObservation(supabase, user.id, locationId, updated, now))
        await ensureProspectCache(supabase, updated)
        newlyDiscovered.push(updated)
      }
    }

    return NextResponse.json({
      ok: true,
      body: 'phobos',
      hub: 'stickney-alpha',
      xM, yM, radiusM,
      scannedTargets: inRange.length,
      recordedMeasurements: observations.length,
      alreadyKnown: await annotateSamples(supabase, alreadyKnown),
      newlyDiscovered: await annotateSamples(supabase, newlyDiscovered),
      missedTargets: Math.max(0, undiscovered.length - newlyDiscovered.length),
    })
  } catch (error) {
    console.error('phobos prospect operation failed:', error)
    return NextResponse.json({ error: 'Stickney-Operation fehlgeschlagen.' }, { status: 503 })
  }
}
