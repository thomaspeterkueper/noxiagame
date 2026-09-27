import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const TARGET_MASS_KG = 50
const ENERGY_COST = 18
const COMPONENT_COST = 1
const WEAR_COST = 6
const DURATION_SECONDS = 6 * 60
const ROBOT_FRAME_ID = 'PHOBOS-EXCAVATOR-MR1'
const ROBOT_LABEL = 'Stickney Excavation Robot 01'

async function userFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

async function phobosLocation(supabase: ReturnType<typeof createServiceClient>) {
  const { data, error } = await supabase.from('locations').select('id,slug').eq('slug', 'phobos').maybeSingle()
  if (error || !data) throw new Error(error?.message ?? 'Phobos location missing')
  return data
}

async function requirePresence(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await supabase.from('profiles').select('current_location').eq('id', userId).maybeSingle()
  return data?.current_location === 'phobos'
}

async function prospectById(supabase: ReturnType<typeof createServiceClient>, prospectId: string) {
  const { data, error } = await supabase.from('region_resources').select('id,resource_type,x_m,y_m,abundance,properties,discovered_at').eq('id', prospectId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.properties?.body !== 'phobos' || data.properties?.surface_hub !== 'stickney-alpha') return null
  return data
}

async function coreEvidence(supabase: ReturnType<typeof createServiceClient>, userId: string, prospectId: string) {
  const { data: sample, error } = await supabase.from('research_samples').select('id,status').eq('prospect_id', prospectId).eq('owner_profile_id', userId).eq('sample_kind', 'drill_core').maybeSingle()
  if (error) throw new Error(error.message)
  if (!sample) return null
  const { data: analysis, error: analysisError } = await supabase.from('sample_analyses').select('id,quality_score,finding,development_status,measured_signal_index').eq('sample_id', sample.id).maybeSingle()
  if (analysisError) throw new Error(analysisError.message)
  return analysis ?? null
}

async function roverYardInventory(supabase: ReturnType<typeof createServiceClient>, locationId: string) {
  const { data, error } = await supabase.from('logistics_inventories').select('id').eq('location_id', locationId).contains('metadata', { role: 'surface_rover' }).eq('active', true).limit(1).maybeSingle()
  if (error || !data?.id) throw new Error(error?.message ?? 'Phobos rover yard missing')
  return data.id as string
}

async function ensureRobot(supabase: ReturnType<typeof createServiceClient>, userId: string, locationId: string) {
  const canonicalKey = `phobos-stickney-excavator:${userId}`
  const { data: existing, error } = await supabase.from('vehicle_instances').select('*').eq('canonical_key', canonicalKey).maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) return existing
  const nodeId = await roverYardInventory(supabase, locationId)
  const { data, error: insertError } = await supabase.from('vehicle_instances').insert({
    canonical_key: canonicalKey,
    frame_id: ROBOT_FRAME_ID,
    label: ROBOT_LABEL,
    owner_profile_id: userId,
    location_id: locationId,
    current_node_inventory_id: nodeId,
    status: 'ready',
    condition: 100,
    wear: 0,
    cargo_capacity_t: 1,
    energy: [{ carrier: 'battery', stateOfCharge: 1, nominalKWh: 24 }],
    crew_ids: [],
    modules: ['microgravity-anchor-spikes', 'regolith-bucket', 'tether-reel', 'autonomy-pack', 'sample-weighing-cell'],
    modifications: { surfaceHub: 'stickney-alpha', tetherRequired: true, autonomyLevel: 'supervised-autonomy' },
    emergent_state: { duty: 'pilot-extraction', xM: 48, yM: -26 },
  }).select('*').single()
  if (insertError || !data) throw new Error(insertError?.message ?? 'Robot provisioning failed')
  return data
}

async function resolveDueJobs(supabase: ReturnType<typeof createServiceClient>, userId: string, locationId: string) {
  const now = new Date().toISOString()
  const { data: due, error } = await supabase.from('pilot_extraction_jobs').select('*').eq('profile_id', userId).eq('location_id', locationId).eq('status', 'running').lte('completes_at', now)
  if (error) throw new Error(error.message)
  for (const job of due ?? []) {
    const prospect = await prospectById(supabase, job.prospect_id)
    const analysis = await coreEvidence(supabase, userId, job.prospect_id)
    if (!prospect || !analysis || analysis.development_status !== 'extraction_candidate') {
      await supabase.from('pilot_extraction_jobs').update({ status: 'failed', completed_at: now, updated_at: now, result: { ...(job.result ?? {}), error: 'evidence_no_longer_sufficient' } }).eq('id', job.id)
      await supabase.from('vehicle_instances').update({ status: 'ready', updated_at: now }).eq('id', job.robot_vehicle_id)
      continue
    }
    const { data: robot, error: robotError } = await supabase.from('vehicle_instances').select('condition,wear').eq('id', job.robot_vehicle_id).single()
    if (robotError || !robot) throw new Error(robotError?.message ?? 'Robot state missing')
    const abundance = Math.max(0, Math.min(1, Number(prospect.abundance ?? 0)))
    const quality = Math.max(0, Math.min(1, Number(analysis.quality_score ?? 0)))
    const condition = Math.max(0, Math.min(100, Number(robot.condition ?? 100))) / 100
    const recoveryEfficiency = Math.max(0.25, Math.min(0.95, 0.42 + abundance * 0.38 + quality * 0.15 + condition * 0.05))
    const recoveredMassKg = Number((Number(job.target_mass_kg) * recoveryEfficiency).toFixed(2))
    const energyPerKg = Number((Number(job.energy_cost) / Math.max(0.1, recoveredMassKg)).toFixed(3))
    const specificWear = Number((Number(job.wear_cost) / Math.max(0.1, recoveredMassKg)).toFixed(3))
    const verdict = recoveredMassKg >= 35 && energyPerKg <= 0.6 && quality >= 0.78 ? 'viable' : recoveredMassKg >= 25 && energyPerKg <= 0.9 ? 'marginal' : 'rejected'
    const nextWear = Math.min(100, Number(robot.wear ?? 0) + Number(job.wear_cost))
    const nextCondition = Math.max(0, Number(robot.condition ?? 100) - Math.ceil(Number(job.wear_cost) * 0.5))
    const result = {
      ...(job.result ?? {}),
      recovered_mass_kg: recoveredMassKg,
      recovery_efficiency: Number(recoveryEfficiency.toFixed(3)),
      energy_per_kg: energyPerKg,
      wear_per_kg: specificWear,
      pilot_verdict: verdict,
      resource_type: prospect.resource_type,
      evidence_quality: quality,
      robot_condition_after: nextCondition,
      robot_wear_after: nextWear,
      commercial_inventory_credit: false,
      interpretation: 'In-world robotic pilot extraction result; test mass is not yet commercial production.',
    }
    await supabase.from('pilot_extraction_jobs').update({ status: 'completed', recovered_mass_kg: recoveredMassKg, completed_at: now, result, updated_at: now }).eq('id', job.id)
    const yardId = await roverYardInventory(supabase, locationId)
    await supabase.from('vehicle_instances').update({
      status: nextCondition <= 20 ? 'maintenance' : 'ready', condition: nextCondition, wear: nextWear, current_node_inventory_id: yardId,
      emergent_state: { duty: 'pilot-extraction', xM: 48, yM: -26, lastPilotJobId: job.id, lastVerdict: verdict }, updated_at: now,
    }).eq('id', job.robot_vehicle_id)
    await supabase.from('region_resources').update({ properties: {
      ...(prospect.properties ?? {}), pilot_extraction_status: verdict, pilot_recovered_mass_kg: recoveredMassKg,
      pilot_energy_per_kg: energyPerKg, pilot_robot_wear: Number(job.wear_cost), pilot_completed_at: now,
      commercial_extraction_status: verdict === 'viable' ? 'pilot_viable_pending_scaleup' : 'blocked',
    } }).eq('id', prospect.id)
  }
}

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePresence(supabase, user.id)) return NextResponse.json({ error: 'Pilotabbau ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
  try {
    const location = await phobosLocation(supabase)
    await resolveDueJobs(supabase, user.id, location.id)
    const robot = await ensureRobot(supabase, user.id, location.id)
    const { data: jobs, error } = await supabase.from('pilot_extraction_jobs').select('*').eq('profile_id', user.id).eq('location_id', location.id).order('created_at', { ascending: false }).limit(20)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, robot, jobs: jobs ?? [] })
  } catch (error) {
    console.error('phobos pilot extraction lookup failed:', error)
    return NextResponse.json({ error: 'Robotischer Pilotabbau nicht verfügbar.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePresence(supabase, user.id)) return NextResponse.json({ error: 'Pilotabbau ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const prospectId = typeof body.prospectId === 'string' ? body.prospectId : ''
  if (!prospectId) return NextResponse.json({ error: 'prospectId erforderlich' }, { status: 400 })
  try {
    const location = await phobosLocation(supabase)
    await resolveDueJobs(supabase, user.id, location.id)
    const prospect = await prospectById(supabase, prospectId)
    if (!prospect?.discovered_at) return NextResponse.json({ error: 'Prospektionsziel nicht verfügbar.' }, { status: 404 })
    const analysis = await coreEvidence(supabase, user.id, prospectId)
    if (!analysis || analysis.development_status !== 'extraction_candidate') return NextResponse.json({ error: 'Direkte Bohrkern-Evidenz reicht für einen Pilotabbau noch nicht aus.' }, { status: 409 })
    const robot = await ensureRobot(supabase, user.id, location.id)
    if (robot.status !== 'ready') return NextResponse.json({ error: 'Der Abbauroboter ist derzeit nicht einsatzbereit.' }, { status: 409 })
    if (Number(robot.condition ?? 0) < 35 || Number(robot.wear ?? 100) > 75) return NextResponse.json({ error: 'Der Abbauroboter benötigt vor dem Einsatz Wartung.' }, { status: 409 })
    const { data: active } = await supabase.from('pilot_extraction_jobs').select('id').eq('profile_id', user.id).eq('prospect_id', prospectId).eq('status', 'running').maybeSingle()
    if (active) return NextResponse.json({ ok: true, idempotent: true, jobId: active.id })
    const [{ data: energyRow, error: energyError }, { data: componentRow, error: componentError }] = await Promise.all([
      supabase.from('resources').select('id,stock').eq('location_id', location.id).eq('resource', 'energy').single(),
      supabase.from('resources').select('id,stock').eq('location_id', location.id).eq('resource', 'components').single(),
    ])
    if (energyError || !energyRow) throw new Error(energyError?.message ?? 'Energy resource row missing')
    if (componentError || !componentRow) throw new Error(componentError?.message ?? 'Component resource row missing')
    if (Number(energyRow.stock ?? 0) < ENERGY_COST) return NextResponse.json({ error: 'Nicht genug Energie für den Pilotabbau.' }, { status: 409 })
    if (Number(componentRow.stock ?? 0) < COMPONENT_COST) return NextResponse.json({ error: 'Nicht genug Komponenten für Verschleißteile.' }, { status: 409 })
    const now = new Date()
    const completesAt = new Date(now.getTime() + DURATION_SECONDS * 1000).toISOString()
    const { data: job, error } = await supabase.from('pilot_extraction_jobs').insert({
      profile_id: user.id, location_id: location.id, prospect_id: prospectId, robot_vehicle_id: robot.id,
      status: 'running', target_mass_kg: TARGET_MASS_KG, energy_cost: ENERGY_COST, component_cost: COMPONENT_COST, wear_cost: WEAR_COST,
      started_at: now.toISOString(), completes_at: completesAt,
      result: { operation: 'stickney_robotic_pilot_extraction', targetX_m: prospect.x_m, targetY_m: prospect.y_m, autonomy: 'supervised-autonomy', tetherRequired: true },
    }).select('*').single()
    if (error || !job) throw new Error(error?.message ?? 'Pilot extraction job insert failed')
    await Promise.all([
      supabase.from('resources').update({ stock: Number(energyRow.stock) - ENERGY_COST, updated_at: now.toISOString() }).eq('id', energyRow.id),
      supabase.from('resources').update({ stock: Number(componentRow.stock) - COMPONENT_COST, updated_at: now.toISOString() }).eq('id', componentRow.id),
      supabase.from('vehicle_instances').update({ status: 'in_transit', emergent_state: { duty: 'pilot-extraction', pilotJobId: job.id, xM: prospect.x_m, yM: prospect.y_m, phase: 'deploy-and-extract' }, updated_at: now.toISOString() }).eq('id', robot.id),
    ])
    return NextResponse.json({ ok: true, job, robot, durationSeconds: DURATION_SECONDS })
  } catch (error) {
    console.error('phobos pilot extraction failed:', error)
    return NextResponse.json({ error: 'Pilotabbau konnte nicht gestartet werden.' }, { status: 503 })
  }
}
