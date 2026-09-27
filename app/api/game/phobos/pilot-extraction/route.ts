import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const TARGET_MASS_KG = 50
const ENERGY_COST = 22
const COMPONENT_COST = 1
const DURATION_SECONDS = 6 * 60
const MAINTENANCE_ENERGY_COST = 8
const MAINTENANCE_COMPONENT_COST = 1
const YARD_X_M = 48
const YARD_Y_M = -26

type RobotRole = 'prospector' | 'excavator' | 'hauler' | 'maintenance'
type RobotSpec = {
  role: RobotRole
  canonicalPrefix: string
  frameId: string
  label: string
  cargoCapacityT: number
  modules: string[]
  nominalWear: number
}

const ROBOT_SPECS: RobotSpec[] = [
  {
    role: 'prospector', canonicalPrefix: 'phobos-stickney-prospector', frameId: 'PHOBOS-PROSPECTOR-PR1', label: 'Stickney Prospector Robot 01', cargoCapacityT: 0.1, nominalWear: 2,
    modules: ['microgravity-anchor-spikes', 'spectrometer-pack', 'ground-imaging-radar', 'tether-reel', 'autonomy-pack'],
  },
  {
    role: 'excavator', canonicalPrefix: 'phobos-stickney-excavator', frameId: 'PHOBOS-EXCAVATOR-MR1', label: 'Stickney Excavation Robot 01', cargoCapacityT: 0.3, nominalWear: 6,
    modules: ['microgravity-anchor-spikes', 'regolith-bucket', 'reaction-canceling-auger', 'tether-reel', 'autonomy-pack'],
  },
  {
    role: 'hauler', canonicalPrefix: 'phobos-stickney-hauler', frameId: 'PHOBOS-HAULER-HR1', label: 'Stickney Hauler Robot 01', cargoCapacityT: 0.2, nominalWear: 4,
    modules: ['microgravity-anchor-spikes', 'sealed-sample-hopper', 'mass-balance-cell', 'tether-reel', 'autonomy-pack'],
  },
  {
    role: 'maintenance', canonicalPrefix: 'phobos-stickney-maintenance', frameId: 'PHOBOS-MAINT-MR1', label: 'Stickney Maintenance Robot 01', cargoCapacityT: 0.2, nominalWear: 2,
    modules: ['microgravity-anchor-spikes', 'tool-changer', 'inspection-camera', 'spares-rack', 'tether-reel', 'autonomy-pack'],
  },
]

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

async function ensureFleet(supabase: ReturnType<typeof createServiceClient>, userId: string, locationId: string) {
  const yardId = await roverYardInventory(supabase, locationId)
  const robots: any[] = []
  for (const spec of ROBOT_SPECS) {
    const canonicalKey = `${spec.canonicalPrefix}:${userId}`
    const { data: existing, error } = await supabase.from('vehicle_instances').select('*').eq('canonical_key', canonicalKey).maybeSingle()
    if (error) throw new Error(error.message)
    if (existing) {
      robots.push(existing)
      continue
    }
    const { data, error: insertError } = await supabase.from('vehicle_instances').insert({
      canonical_key: canonicalKey,
      frame_id: spec.frameId,
      label: spec.label,
      owner_profile_id: userId,
      location_id: locationId,
      current_node_inventory_id: yardId,
      status: 'ready',
      condition: 100,
      wear: 0,
      cargo_capacity_t: spec.cargoCapacityT,
      energy: [{ carrier: 'battery', stateOfCharge: 1, nominalKWh: spec.role === 'excavator' ? 24 : 14 }],
      crew_ids: [],
      modules: spec.modules,
      modifications: { surfaceHub: 'stickney-alpha', tetherRequired: true, autonomyLevel: 'supervised-autonomy', fleetRole: spec.role },
      emergent_state: { duty: 'pilot-extraction-fleet', fleetRole: spec.role, xM: YARD_X_M, yM: YARD_Y_M },
    }).select('*').single()
    if (insertError || !data) throw new Error(insertError?.message ?? `Robot provisioning failed: ${spec.role}`)
    robots.push(data)
  }
  return robots
}

function roleOf(robot: any): RobotRole {
  const role = robot?.modifications?.fleetRole
  return ROBOT_SPECS.some(spec => spec.role === role) ? role : 'excavator'
}

function fleetReadiness(robots: any[]) {
  return robots.map(robot => ({
    id: robot.id,
    role: roleOf(robot),
    label: robot.label,
    status: robot.status,
    condition: Number(robot.condition ?? 0),
    wear: Number(robot.wear ?? 100),
    ready: robot.status === 'ready' && Number(robot.condition ?? 0) >= 35 && Number(robot.wear ?? 100) <= 75,
  }))
}

async function resolveDueJobs(supabase: ReturnType<typeof createServiceClient>, userId: string, locationId: string) {
  const now = new Date().toISOString()
  const { data: due, error } = await supabase.from('pilot_extraction_jobs').select('*').eq('profile_id', userId).eq('location_id', locationId).eq('status', 'running').lte('completes_at', now)
  if (error) throw new Error(error.message)
  for (const job of due ?? []) {
    const prospect = await prospectById(supabase, job.prospect_id)
    const analysis = await coreEvidence(supabase, userId, job.prospect_id)
    const fleetIds = Array.isArray(job.result?.fleet_vehicle_ids) ? job.result.fleet_vehicle_ids : [job.robot_vehicle_id]
    const { data: robots, error: robotsError } = await supabase.from('vehicle_instances').select('*').in('id', fleetIds)
    if (robotsError) throw new Error(robotsError.message)
    if (!prospect || !analysis || analysis.development_status !== 'extraction_candidate' || !robots?.length) {
      await supabase.from('pilot_extraction_jobs').update({ status: 'failed', completed_at: now, updated_at: now, result: { ...(job.result ?? {}), error: 'evidence_or_fleet_no_longer_sufficient' } }).eq('id', job.id)
      if (fleetIds.length) await supabase.from('vehicle_instances').update({ status: 'ready', updated_at: now }).in('id', fleetIds)
      continue
    }

    const abundance = Math.max(0, Math.min(1, Number(prospect.abundance ?? 0)))
    const quality = Math.max(0, Math.min(1, Number(analysis.quality_score ?? 0)))
    const avgCondition = robots.reduce((sum, robot) => sum + Number(robot.condition ?? 100), 0) / Math.max(1, robots.length) / 100
    const prospector = robots.find(robot => roleOf(robot) === 'prospector')
    const hauler = robots.find(robot => roleOf(robot) === 'hauler')
    const prospectingFactor = prospector ? 0.035 : 0
    const haulFactor = hauler ? 0.025 : 0
    const recoveryEfficiency = Math.max(0.25, Math.min(0.95, 0.38 + abundance * 0.36 + quality * 0.15 + avgCondition * 0.045 + prospectingFactor + haulFactor))
    const recoveredMassKg = Number((Number(job.target_mass_kg) * recoveryEfficiency).toFixed(2))
    const energyPerKg = Number((Number(job.energy_cost) / Math.max(0.1, recoveredMassKg)).toFixed(3))
    const verdict = recoveredMassKg >= 35 && energyPerKg <= 0.68 && quality >= 0.78 ? 'viable' : recoveredMassKg >= 25 && energyPerKg <= 0.95 ? 'marginal' : 'rejected'

    const yardId = await roverYardInventory(supabase, locationId)
    const roleTelemetry: Record<string, unknown> = {}
    for (const robot of robots) {
      const role = roleOf(robot)
      const spec = ROBOT_SPECS.find(item => item.role === role) ?? ROBOT_SPECS[1]
      const addedWear = spec.nominalWear
      const nextWear = Math.min(100, Number(robot.wear ?? 0) + addedWear)
      const nextCondition = Math.max(0, Number(robot.condition ?? 100) - Math.ceil(addedWear * 0.45))
      roleTelemetry[role] = { vehicleId: robot.id, label: robot.label, wearAdded: addedWear, wearAfter: nextWear, conditionAfter: nextCondition }
      await supabase.from('vehicle_instances').update({
        status: nextCondition <= 20 ? 'maintenance' : 'ready',
        condition: nextCondition,
        wear: nextWear,
        current_node_inventory_id: yardId,
        emergent_state: { duty: 'pilot-extraction-fleet', fleetRole: role, xM: YARD_X_M, yM: YARD_Y_M, lastPilotJobId: job.id, lastVerdict: verdict },
        updated_at: now,
      }).eq('id', robot.id)
    }

    const result = {
      ...(job.result ?? {}),
      recovered_mass_kg: recoveredMassKg,
      recovery_efficiency: Number(recoveryEfficiency.toFixed(3)),
      energy_per_kg: energyPerKg,
      pilot_verdict: verdict,
      resource_type: prospect.resource_type,
      evidence_quality: quality,
      fleet_telemetry: roleTelemetry,
      commercial_inventory_credit: false,
      interpretation: 'In-world cooperative robotic pilot extraction result; test mass is not yet commercial production.',
    }
    await supabase.from('pilot_extraction_jobs').update({ status: 'completed', recovered_mass_kg: recoveredMassKg, completed_at: now, result, updated_at: now }).eq('id', job.id)
    await supabase.from('region_resources').update({ properties: {
      ...(prospect.properties ?? {}),
      pilot_extraction_status: verdict,
      pilot_recovered_mass_kg: recoveredMassKg,
      pilot_energy_per_kg: energyPerKg,
      pilot_completed_at: now,
      pilot_robotics_mode: 'cooperative_four_robot_fleet',
      commercial_extraction_status: verdict === 'viable' ? 'pilot_viable_pending_scaleup' : 'blocked',
    } }).eq('id', prospect.id)
  }
}

async function resourceRows(supabase: ReturnType<typeof createServiceClient>, locationId: string) {
  const [{ data: energyRow, error: energyError }, { data: componentRow, error: componentError }] = await Promise.all([
    supabase.from('resources').select('id,stock').eq('location_id', locationId).eq('resource', 'energy').single(),
    supabase.from('resources').select('id,stock').eq('location_id', locationId).eq('resource', 'components').single(),
  ])
  if (energyError || !energyRow) throw new Error(energyError?.message ?? 'Energy resource row missing')
  if (componentError || !componentRow) throw new Error(componentError?.message ?? 'Component resource row missing')
  return { energyRow, componentRow }
}

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePresence(supabase, user.id)) return NextResponse.json({ error: 'Robotikbetrieb ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
  try {
    const location = await phobosLocation(supabase)
    await resolveDueJobs(supabase, user.id, location.id)
    const robots = await ensureFleet(supabase, user.id, location.id)
    const { data: jobs, error } = await supabase.from('pilot_extraction_jobs').select('*').eq('profile_id', user.id).eq('location_id', location.id).order('created_at', { ascending: false }).limit(20)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, robots, fleetReadiness: fleetReadiness(robots), jobs: jobs ?? [] })
  } catch (error) {
    console.error('phobos robotic fleet lookup failed:', error)
    return NextResponse.json({ error: 'Robotikflotte nicht verfügbar.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!await requirePresence(supabase, user.id)) return NextResponse.json({ error: 'Robotikbetrieb ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : 'start-pilot'
  const prospectId = typeof body.prospectId === 'string' ? body.prospectId : ''

  try {
    const location = await phobosLocation(supabase)
    await resolveDueJobs(supabase, user.id, location.id)
    const robots = await ensureFleet(supabase, user.id, location.id)

    if (action === 'maintain-fleet') {
      if (robots.some(robot => ['in_transit', 'loading', 'unloading', 'reserved'].includes(String(robot.status)))) return NextResponse.json({ error: 'Wartung ist während eines Flotteneinsatzes nicht möglich.' }, { status: 409 })
      const { energyRow, componentRow } = await resourceRows(supabase, location.id)
      if (Number(energyRow.stock ?? 0) < MAINTENANCE_ENERGY_COST || Number(componentRow.stock ?? 0) < MAINTENANCE_COMPONENT_COST) return NextResponse.json({ error: 'Nicht genug Energie oder Ersatzteile für Flottenwartung.' }, { status: 409 })
      const now = new Date().toISOString()
      await Promise.all([
        supabase.from('resources').update({ stock: Number(energyRow.stock) - MAINTENANCE_ENERGY_COST, updated_at: now }).eq('id', energyRow.id),
        supabase.from('resources').update({ stock: Number(componentRow.stock) - MAINTENANCE_COMPONENT_COST, updated_at: now }).eq('id', componentRow.id),
      ])
      for (const robot of robots) {
        const role = roleOf(robot)
        const maintenanceGain = role === 'maintenance' ? 4 : 10
        const wearReduction = role === 'maintenance' ? 6 : 14
        await supabase.from('vehicle_instances').update({
          status: 'ready',
          condition: Math.min(100, Number(robot.condition ?? 0) + maintenanceGain),
          wear: Math.max(0, Number(robot.wear ?? 0) - wearReduction),
          emergent_state: { ...(robot.emergent_state ?? {}), duty: 'pilot-extraction-fleet', fleetRole: role, maintenanceAt: now, maintenanceBy: 'maintenance' },
          updated_at: now,
        }).eq('id', robot.id)
      }
      const refreshed = await ensureFleet(supabase, user.id, location.id)
      return NextResponse.json({ ok: true, action, robots: refreshed })
    }

    if (!prospectId) return NextResponse.json({ error: 'prospectId erforderlich' }, { status: 400 })
    const prospect = await prospectById(supabase, prospectId)
    if (!prospect?.discovered_at) return NextResponse.json({ error: 'Prospektionsziel nicht verfügbar.' }, { status: 404 })
    const analysis = await coreEvidence(supabase, user.id, prospectId)
    if (!analysis || analysis.development_status !== 'extraction_candidate') return NextResponse.json({ error: 'Direkte Bohrkern-Evidenz reicht für einen Pilotabbau noch nicht aus.' }, { status: 409 })

    const readiness = fleetReadiness(robots)
    const unavailable = readiness.filter(item => !item.ready)
    if (unavailable.length) return NextResponse.json({ error: `Flotte nicht vollständig einsatzbereit: ${unavailable.map(item => item.label).join(', ')}` }, { status: 409 })

    const { data: active } = await supabase.from('pilot_extraction_jobs').select('id').eq('profile_id', user.id).eq('prospect_id', prospectId).eq('status', 'running').maybeSingle()
    if (active) return NextResponse.json({ ok: true, idempotent: true, jobId: active.id })
    const { energyRow, componentRow } = await resourceRows(supabase, location.id)
    if (Number(energyRow.stock ?? 0) < ENERGY_COST) return NextResponse.json({ error: 'Nicht genug Energie für den Flotteneinsatz.' }, { status: 409 })
    if (Number(componentRow.stock ?? 0) < COMPONENT_COST) return NextResponse.json({ error: 'Nicht genug Komponenten für Verschleißteile.' }, { status: 409 })

    const excavator = robots.find(robot => roleOf(robot) === 'excavator')
    if (!excavator) throw new Error('Excavator missing from fleet')
    const now = new Date()
    const completesAt = new Date(now.getTime() + DURATION_SECONDS * 1000).toISOString()
    const fleetVehicleIds = robots.map(robot => robot.id)
    const { data: job, error } = await supabase.from('pilot_extraction_jobs').insert({
      profile_id: user.id,
      location_id: location.id,
      prospect_id: prospectId,
      robot_vehicle_id: excavator.id,
      status: 'running',
      target_mass_kg: TARGET_MASS_KG,
      energy_cost: ENERGY_COST,
      component_cost: COMPONENT_COST,
      wear_cost: ROBOT_SPECS.reduce((sum, spec) => sum + spec.nominalWear, 0),
      started_at: now.toISOString(),
      completes_at: completesAt,
      result: {
        operation: 'stickney_robotic_pilot_extraction',
        roboticsMode: 'cooperative_four_robot_fleet',
        fleet_vehicle_ids: fleetVehicleIds,
        targetX_m: prospect.x_m,
        targetY_m: prospect.y_m,
        autonomy: 'supervised-autonomy',
        tetherRequired: true,
        roleSequence: ['prospector', 'excavator', 'hauler', 'maintenance'],
      },
    }).select('*').single()
    if (error || !job) throw new Error(error?.message ?? 'Pilot extraction job insert failed')

    await Promise.all([
      supabase.from('resources').update({ stock: Number(energyRow.stock) - ENERGY_COST, updated_at: now.toISOString() }).eq('id', energyRow.id),
      supabase.from('resources').update({ stock: Number(componentRow.stock) - COMPONENT_COST, updated_at: now.toISOString() }).eq('id', componentRow.id),
    ])
    for (const robot of robots) {
      const role = roleOf(robot)
      await supabase.from('vehicle_instances').update({
        status: 'in_transit',
        emergent_state: { duty: 'pilot-extraction-fleet', fleetRole: role, pilotJobId: job.id, xM: prospect.x_m, yM: prospect.y_m, phase: role === 'prospector' ? 'survey' : role === 'excavator' ? 'excavate' : role === 'hauler' ? 'haul-test-mass' : 'field-support' },
        updated_at: now.toISOString(),
      }).eq('id', robot.id)
    }
    return NextResponse.json({ ok: true, job, robots, fleetReadiness: readiness, durationSeconds: DURATION_SECONDS })
  } catch (error) {
    console.error('phobos robotic fleet operation failed:', error)
    return NextResponse.json({ error: 'Robotischer Flotteneinsatz konnte nicht ausgeführt werden.' }, { status: 503 })
  }
}
