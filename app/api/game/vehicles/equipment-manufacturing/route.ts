import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlayerUnlocks } from '@/lib/knowledge/unlocks'
import { ROBOT_MODULE_RECIPES, missingRecipeUnlocks, robotModuleRecipe } from '@/lib/game/vehicles/robotModuleManufacturing'

async function userFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const s = createServiceClient()
  const { data: { user } } = await s.auth.getUser(token)
  return user ?? null
}

async function context(s: ReturnType<typeof createServiceClient>, profileId: string) {
  const { data: profile, error: pe } = await s.from('profiles').select('current_location').eq('id', profileId).maybeSingle()
  if (pe) throw new Error(pe.message)
  if (profile?.current_location !== 'phobos') throw new Error('NOT_ON_PHOBOS')
  const { data: location, error: le } = await s.from('locations').select('id,slug').eq('slug', 'phobos').maybeSingle()
  if (le || !location?.id) throw new Error(le?.message ?? 'PHOBOS_MISSING')
  const { data: workshop, error: we } = await s.from('logistics_inventories').select('id,label').eq('location_id', location.id).contains('metadata', { role: 'equipment_workshop' }).eq('active', true).limit(1).maybeSingle()
  if (we || !workshop?.id) throw new Error(we?.message ?? 'WORKSHOP_MISSING')
  return { location, workshop }
}

async function snapshot(s: ReturnType<typeof createServiceClient>, profileId: string) {
  await s.rpc('noxia_finalize_equipment_manufacturing', { p_profile_id: profileId })
  const { location, workshop } = await context(s, profileId)
  const [unlocks, stockResult, jobsResult] = await Promise.all([
    getPlayerUnlocks(profileId),
    s.from('location_resources').select('resource,stock').eq('location_id', location.id).in('resource', ['metal','components','energy']),
    s.from('equipment_manufacturing_commands').select('*').eq('profile_id', profileId).eq('location_id', location.id).order('requested_at', { ascending: false }).limit(20),
  ])
  if (stockResult.error) throw new Error(stockResult.error.message)
  if (jobsResult.error) throw new Error(jobsResult.error.message)
  const stock = Object.fromEntries((stockResult.data ?? []).map((row: any) => [row.resource, Number(row.stock ?? 0)]))
  const recipes = Object.values(ROBOT_MODULE_RECIPES).map(recipe => ({
    ...recipe,
    missingUnlocks: missingRecipeUnlocks(recipe, unlocks),
    unlocked: missingRecipeUnlocks(recipe, unlocks).length === 0,
    affordable: stock.metal >= recipe.metalCost && stock.components >= recipe.componentCost && stock.energy >= recipe.energyCost,
  }))
  return { workshop, stock, recipes, jobs: jobsResult.data ?? [], unlocks }
}

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const s = createServiceClient()
  try {
    return NextResponse.json({ ok: true, ...(await snapshot(s, user.id)) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'NOT_ON_PHOBOS') return NextResponse.json({ error: 'Modulfertigung ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
    console.error('equipment manufacturing lookup failed:', error)
    return NextResponse.json({ error: 'Werkstattfertigung nicht verfügbar.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const equipmentKey = typeof body.equipmentKey === 'string' ? body.equipmentKey : ''
  const recipe = robotModuleRecipe(equipmentKey)
  if (!recipe) return NextResponse.json({ error: 'Unbekanntes Fertigungsrezept.' }, { status: 400 })
  const s = createServiceClient()
  try {
    const { location, workshop } = await context(s, user.id)
    const unlocks = await getPlayerUnlocks(user.id)
    const missing = missingRecipeUnlocks(recipe, unlocks)
    if (missing.length) return NextResponse.json({ error: 'Technologie noch nicht freigeschaltet.', missingUnlocks: missing }, { status: 403 })
    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey ? body.idempotencyKey : `robot-module:${user.id}:${equipmentKey}:${crypto.randomUUID()}`
    const { data, error } = await s.rpc('noxia_start_equipment_manufacturing', {
      p_profile_id: user.id,
      p_location_id: location.id,
      p_workshop_inventory_id: workshop.id,
      p_equipment_key: equipmentKey,
      p_required_unlocks: recipe.requiredUnlocks,
      p_metal_cost: recipe.metalCost,
      p_component_cost: recipe.componentCost,
      p_energy_cost: recipe.energyCost,
      p_duration_seconds: recipe.durationSeconds,
      p_recipe_version: recipe.recipeVersion,
      p_idempotency_key: idempotencyKey,
      p_metadata: { source: 'surface-workshop', equipmentClass: 'robot_module' },
    })
    if (error) {
      const msg = error.message ?? ''
      if (msg.includes('MISSING_UNLOCK')) return NextResponse.json({ error: 'Technologie noch nicht freigeschaltet.' }, { status: 403 })
      if (msg.includes('INSUFFICIENT_')) return NextResponse.json({ error: 'Nicht genug lokaler Werkstattbestand.' }, { status: 409 })
      throw new Error(msg)
    }
    return NextResponse.json({ ok: true, job: data, ...(await snapshot(s, user.id)) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'NOT_ON_PHOBOS') return NextResponse.json({ error: 'Modulfertigung ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })
    console.error('equipment manufacturing start failed:', error)
    return NextResponse.json({ error: 'Fertigungsauftrag konnte nicht gestartet werden.' }, { status: 503 })
  }
}
