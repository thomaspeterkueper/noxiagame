import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ROBOT_FLEET_ROLES, ROBOT_RETROFIT_PROFILES, isRobotFleetRole, robotRetrofitProfile } from '@/lib/game/vehicles/robotRetrofit'

async function userFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const s = createServiceClient()
  const { data: { user } } = await s.auth.getUser(token)
  return user ?? null
}

async function locationBySlug(s: ReturnType<typeof createServiceClient>, slug: string) {
  const { data, error } = await s.from('locations').select('id,slug').eq('slug', slug).maybeSingle()
  if (error || !data?.id) throw new Error(error?.message ?? 'Location missing')
  return data
}

async function requirePresence(s: ReturnType<typeof createServiceClient>, userId: string, slug: string) {
  const { data, error } = await s.from('profiles').select('current_location').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.current_location === slug
}

async function resourceRows(s: ReturnType<typeof createServiceClient>, locationId: string) {
  const [{ data: energy, error: ee }, { data: components, error: ce }] = await Promise.all([
    s.from('resources').select('id,stock').eq('location_id', locationId).eq('resource', 'energy').single(),
    s.from('resources').select('id,stock').eq('location_id', locationId).eq('resource', 'components').single(),
  ])
  if (ee || !energy) throw new Error(ee?.message ?? 'Energy row missing')
  if (ce || !components) throw new Error(ce?.message ?? 'Components row missing')
  return { energy, components }
}

async function reconcileStickneyConfiguration(s: ReturnType<typeof createServiceClient>, userId: string, locationId: string, changedRobotId: string) {
  const { data: fleet, error } = await s.from('vehicle_instances').select('id,status,modifications').eq('owner_profile_id', userId).eq('location_id', locationId)
  if (error) throw new Error(error.message)
  const stickney = (fleet ?? []).filter(robot => robot.modifications?.surfaceHub === 'stickney-alpha')
  const roleSet = new Set(stickney.map(robot => robot.modifications?.fleetRole).filter(isRobotFleetRole))
  const complete = ROBOT_FLEET_ROLES.every(role => roleSet.has(role))
  const now = new Date().toISOString()
  if (complete) {
    const configurationIds = stickney.filter(robot => robot.status === 'configuration').map(robot => robot.id)
    if (configurationIds.length) await s.from('vehicle_instances').update({ status: 'ready', updated_at: now }).in('id', configurationIds)
  } else {
    await s.from('vehicle_instances').update({ status: 'configuration', updated_at: now }).eq('id', changedRobotId)
  }
  return { complete, roleSet: [...roleSet] }
}

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const robotId = req.nextUrl.searchParams.get('robotId') ?? ''
  if (!robotId) return NextResponse.json({ error: 'robotId erforderlich' }, { status: 400 })
  const s = createServiceClient()
  try {
    const { data: robot, error } = await s.from('vehicle_instances').select('*').eq('id', robotId).eq('owner_profile_id', user.id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!robot) return NextResponse.json({ error: 'Fahrzeug nicht gefunden.' }, { status: 404 })
    return NextResponse.json({ ok: true, robot, profiles: Object.values(ROBOT_RETROFIT_PROFILES) })
  } catch (error) {
    console.error('robot retrofit lookup failed:', error)
    return NextResponse.json({ error: 'Umbauprofile nicht verfügbar.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const robotId = typeof body.robotId === 'string' ? body.robotId : ''
  const locationSlug = typeof body.locationSlug === 'string' ? body.locationSlug : ''
  const targetRole = body.targetRole
  if (!robotId || !locationSlug || !isRobotFleetRole(targetRole)) return NextResponse.json({ error: 'robotId, locationSlug und gültige targetRole erforderlich.' }, { status: 400 })

  const s = createServiceClient()
  try {
    const location = await locationBySlug(s, locationSlug)
    if (!await requirePresence(s, user.id, locationSlug)) return NextResponse.json({ error: 'Umbau ist nur vor Ort möglich.' }, { status: 409 })
    const { data: robot, error } = await s.from('vehicle_instances').select('*').eq('id', robotId).eq('owner_profile_id', user.id).eq('location_id', location.id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!robot) return NextResponse.json({ error: 'Fahrzeug nicht gefunden.' }, { status: 404 })
    if (!String(robot.frame_id ?? '').startsWith('PHOBOS-') || robot.modifications?.surfaceHub !== 'stickney-alpha') return NextResponse.json({ error: 'Dieses Fahrzeug unterstützt den Stickney-Modulumbau nicht.' }, { status: 409 })
    if (!['ready', 'configuration'].includes(String(robot.status))) return NextResponse.json({ error: 'Umbau ist nur bei stillstehendem Fahrzeug möglich.' }, { status: 409 })

    const { data: active } = await s.from('pilot_extraction_jobs').select('id').eq('profile_id', user.id).eq('location_id', location.id).eq('status', 'running').limit(1).maybeSingle()
    if (active) return NextResponse.json({ error: 'Umbau ist während eines laufenden Flotteneinsatzes gesperrt.' }, { status: 409 })

    const currentRole = robot.modifications?.fleetRole
    if (currentRole === targetRole) return NextResponse.json({ ok: true, idempotent: true, robot })
    const profile = robotRetrofitProfile(targetRole)
    const { energy, components } = await resourceRows(s, location.id)
    if (Number(energy.stock ?? 0) < profile.energyCost || Number(components.stock ?? 0) < profile.componentCost) return NextResponse.json({ error: 'Nicht genug Energie oder Komponenten für diesen Modulumbau.' }, { status: 409 })

    const now = new Date().toISOString()
    const previousModules = Array.isArray(robot.modules) ? robot.modules : []
    const retrofitHistory = Array.isArray(robot.modifications?.retrofitHistory) ? robot.modifications.retrofitHistory : []
    const stateOfCharge = Math.max(0, Math.min(1, Number(robot.energy?.[0]?.stateOfCharge ?? 1)))
    const nextModifications = {
      ...(robot.modifications ?? {}),
      chassisClass: 'stickney-modular-robot-v1',
      fleetRole: targetRole,
      dryMassKg: profile.dryMassKg,
      peakPowerKw: profile.peakPowerKw,
      capabilities: profile.capabilities,
      retrofitAt: now,
      retrofitHistory: [...retrofitHistory.slice(-9), { at: now, fromRole: currentRole ?? null, toRole: targetRole, removedModules: previousModules.filter((m: string) => !profile.modules.includes(m)), installedModules: profile.modules.filter(m => !previousModules.includes(m)) }],
    }

    const [{ error: e1 }, { error: e2 }, { data: updated, error: ue }] = await Promise.all([
      s.from('resources').update({ stock: Number(energy.stock) - profile.energyCost, updated_at: now }).eq('id', energy.id),
      s.from('resources').update({ stock: Number(components.stock) - profile.componentCost, updated_at: now }).eq('id', components.id),
      s.from('vehicle_instances').update({
        modules: profile.modules,
        cargo_capacity_t: profile.cargoCapacityT,
        energy: [{ carrier: 'battery', stateOfCharge, nominalKWh: profile.batteryKWh }],
        modifications: nextModifications,
        emergent_state: { ...(robot.emergent_state ?? {}), fleetRole: targetRole, phase: 'retrofit-complete', retrofitAt: now },
        updated_at: now,
      }).eq('id', robot.id).select('*').single(),
    ])
    if (e1 || e2 || ue || !updated) throw new Error(e1?.message ?? e2?.message ?? ue?.message ?? 'Retrofit failed')

    const configuration = await reconcileStickneyConfiguration(s, user.id, location.id, updated.id)
    const { data: refreshed, error: re } = await s.from('vehicle_instances').select('*').eq('id', updated.id).single()
    if (re || !refreshed) throw new Error(re?.message ?? 'Refreshed vehicle missing')
    return NextResponse.json({ ok: true, robot: refreshed, profile, configuration, cost: { energy: profile.energyCost, components: profile.componentCost } })
  } catch (error) {
    console.error('robot retrofit failed:', error)
    return NextResponse.json({ error: 'Modulumbau konnte nicht durchgeführt werden.' }, { status: 503 })
  }
}
