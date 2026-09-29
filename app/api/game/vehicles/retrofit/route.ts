import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  ROBOT_FLEET_ROLES,
  ROBOT_MODULE_DEFINITIONS,
  ROBOT_RETROFIT_PROFILES,
  isRobotFleetRole,
  replaceableRobotModules,
  robotRetrofitProfile,
} from '@/lib/game/vehicles/robotRetrofit'

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

async function workshopInventory(s: ReturnType<typeof createServiceClient>, locationId: string) {
  const { data, error } = await s.from('logistics_inventories')
    .select('id,label,location_id,metadata')
    .eq('location_id', locationId)
    .contains('metadata', { role: 'equipment_workshop' })
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (error || !data?.id) throw new Error(error?.message ?? 'Equipment workshop missing')
  return data
}

async function equipmentForWorkshop(s: ReturnType<typeof createServiceClient>, inventoryId: string) {
  const { data, error } = await s.from('equipment_items')
    .select('id,equipment_key,serial_number,status,condition,wear,owner_profile_id,metadata,updated_at')
    .eq('inventory_id', inventoryId)
    .order('equipment_key')
    .order('condition', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

async function equipmentInstalledOnVehicle(s: ReturnType<typeof createServiceClient>, vehicleId: string) {
  const { data, error } = await s.from('equipment_items')
    .select('id,equipment_key,serial_number,status,condition,wear,metadata,updated_at')
    .eq('installed_vehicle_id', vehicleId)
    .eq('status', 'installed')
    .order('equipment_key')
  if (error) throw new Error(error.message)
  return data ?? []
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

function stockSummary(items: any[]) {
  const counts: Record<string, number> = {}
  for (const item of items) {
    if (item.status !== 'stored' || Number(item.condition ?? 0) < 35 || Number(item.wear ?? 100) > 80) continue
    counts[item.equipment_key] = (counts[item.equipment_key] ?? 0) + 1
  }
  return counts
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
    if (!robot?.location_id) return NextResponse.json({ error: 'Fahrzeug nicht gefunden.' }, { status: 404 })
    const workshop = await workshopInventory(s, robot.location_id)
    const [workshopEquipment, installedEquipment] = await Promise.all([
      equipmentForWorkshop(s, workshop.id),
      equipmentInstalledOnVehicle(s, robot.id),
    ])
    return NextResponse.json({
      ok: true,
      robot,
      profiles: Object.values(ROBOT_RETROFIT_PROFILES),
      moduleDefinitions: ROBOT_MODULE_DEFINITIONS,
      workshop: { ...workshop, equipment: workshopEquipment, available: stockSummary(workshopEquipment) },
      installedEquipment,
    })
  } catch (error) {
    console.error('robot retrofit lookup failed:', error)
    return NextResponse.json({ error: 'Umbauprofile oder Modullager nicht verfügbar.' }, { status: 503 })
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
    const previousModules = Array.isArray(robot.modules) ? robot.modules.filter((m: unknown): m is string => typeof m === 'string') : []
    const currentEquipmentKeys = replaceableRobotModules(previousModules)
    const targetEquipmentKeys = replaceableRobotModules(profile.modules)
    const workshop = await workshopInventory(s, location.id)
    const workshopEquipment = await equipmentForWorkshop(s, workshop.id)
    const available = stockSummary(workshopEquipment)
    const alreadyInstalled = new Set(currentEquipmentKeys)
    const missing = targetEquipmentKeys.filter(key => !alreadyInstalled.has(key) && (available[key] ?? 0) < 1)
    if (missing.length) {
      return NextResponse.json({
        error: `Benötigtes Werkstattmodul fehlt: ${missing.map(key => ROBOT_MODULE_DEFINITIONS[key]?.label ?? key).join(', ')}`,
        missingModules: missing,
      }, { status: 409 })
    }

    const now = new Date().toISOString()
    const retrofitHistory = Array.isArray(robot.modifications?.retrofitHistory) ? robot.modifications.retrofitHistory : []
    const stateOfCharge = Math.max(0, Math.min(1, Number(robot.energy?.[0]?.stateOfCharge ?? 1)))
    const nextModifications = {
      ...(robot.modifications ?? {}),
      chassisClass: 'stickney-modular-robot-v1',
      fleetRole: targetRole,
      dryMassKg: profile.dryMassKg,
      peakPowerKw: profile.peakPowerKw,
      payloadCapacityKg: profile.cargoCapacityT * 1000,
      capabilities: profile.capabilities,
      retrofitAt: now,
      retrofitHistory: [...retrofitHistory.slice(-9), {
        at: now,
        fromRole: currentRole ?? null,
        toRole: targetRole,
        removedModules: currentEquipmentKeys.filter(m => !targetEquipmentKeys.includes(m)),
        installedModules: targetEquipmentKeys.filter(m => !currentEquipmentKeys.includes(m)),
        inventoryBacked: true,
      }],
    }
    const nextEmergent = { ...(robot.emergent_state ?? {}), fleetRole: targetRole, phase: 'retrofit-complete', retrofitAt: now }
    const { data: transaction, error: txError } = await s.rpc('noxia_retrofit_robot_equipment', {
      p_profile_id: user.id,
      p_vehicle_id: robot.id,
      p_workshop_inventory_id: workshop.id,
      p_target_role: targetRole,
      p_current_equipment_keys: currentEquipmentKeys,
      p_target_equipment_keys: targetEquipmentKeys,
      p_vehicle_modules: profile.modules,
      p_vehicle_energy: [{ carrier: 'battery', stateOfCharge, nominalKWh: profile.batteryKWh }],
      p_cargo_capacity_t: profile.cargoCapacityT,
      p_modifications: nextModifications,
      p_emergent_state: nextEmergent,
      p_energy_cost: profile.energyCost,
      p_component_cost: profile.componentCost,
    })
    if (txError) {
      const match = String(txError.message ?? '').match(/module_unavailable:([^\s]+)/)
      if (match) return NextResponse.json({ error: `Werkstattmodul nicht verfügbar: ${ROBOT_MODULE_DEFINITIONS[match[1]]?.label ?? match[1]}` }, { status: 409 })
      if (String(txError.message ?? '').includes('insufficient_resources')) return NextResponse.json({ error: 'Nicht genug Energie oder Komponenten für diesen Modulumbau.' }, { status: 409 })
      throw new Error(txError.message)
    }

    const configuration = await reconcileStickneyConfiguration(s, user.id, location.id, robot.id)
    const { data: refreshed, error: re } = await s.from('vehicle_instances').select('*').eq('id', robot.id).single()
    if (re || !refreshed) throw new Error(re?.message ?? 'Refreshed vehicle missing')
    const [nextWorkshopEquipment, installedEquipment] = await Promise.all([
      equipmentForWorkshop(s, workshop.id),
      equipmentInstalledOnVehicle(s, robot.id),
    ])
    return NextResponse.json({
      ok: true,
      robot: refreshed,
      profile,
      transaction,
      configuration,
      cost: { energy: profile.energyCost, components: profile.componentCost },
      workshop: { ...workshop, equipment: nextWorkshopEquipment, available: stockSummary(nextWorkshopEquipment) },
      installedEquipment,
    })
  } catch (error) {
    console.error('robot retrofit failed:', error)
    return NextResponse.json({ error: 'Modulumbau konnte nicht durchgeführt werden.' }, { status: 503 })
  }
}
