// app/api/game/journeys/route.ts
// Erstellt: 01.07.2026
// Aktualisiert: 02.07.2026 — Journey-Definitionen aus gemeinsamem Catalog angebunden
// Version: 0.4.0

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { DEFAULT_JOURNEY_STEPS, getJourneyTitle, isJourneyKey } from '@/lib/game/journeys'

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const serviceClient = createServiceClient()
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

function fallbackStepsFor(keys: string[], dbSteps: any[]) {
  const byKey = new Map<string, any[]>()
  for (const step of dbSteps ?? []) {
    const arr = byKey.get(step.journey_key) ?? []
    arr.push(step)
    byKey.set(step.journey_key, arr)
  }
  return keys.flatMap(key => {
    const existing = byKey.get(key)
    if (existing?.length) return existing
    return isJourneyKey(key) ? DEFAULT_JOURNEY_STEPS[key] : []
  }).sort((a, b) => a.journey_key.localeCompare(b.journey_key) || a.step_order - b.step_order)
}

function completedStepIds(journeyKey: string, ownSteps: any[], ctx: { ships: any[]; entities: any[]; trades: any[]; knowledge: number; currentLocation?: string }) {
  const ids = new Set<string>()
  const byOrder = new Map<number, string>()
  ownSteps.forEach(s => byOrder.set(s.step_order, s.id))
  const mark = (order: number, condition: boolean) => { const id = byOrder.get(order); if (id && condition) ids.add(id) }

  if (journeyKey === 'moon_colony') {
    mark(1, ctx.ships.length > 0)
    mark(2, ctx.currentLocation === 'moon' || ctx.entities.some(e => e.locations?.slug === 'moon'))
    mark(3, ctx.entities.some(e => e.locations?.slug === 'moon' && ['solar', 'solar_field', 'power_plant'].includes(e.entity_id)))
    mark(4, ctx.entities.some(e => e.locations?.slug === 'moon' && ['ice_drill', 'water_extractor'].includes(e.entity_id)))
  }

  if (journeyKey === 'merchant') {
    mark(1, ctx.ships.length > 0)
    mark(2, ctx.ships.some(s => (s.cargo_max ?? 0) > 0))
    mark(3, (ctx.trades?.length ?? 0) > 0)
    mark(4, (ctx.trades?.length ?? 0) > 0)
  }

  if (journeyKey === 'research') {
    mark(1, ctx.entities.some(e => e.entity_id === 'school' || e.entity_id === 'academy' || e.entity_id === 'research_lab'))
    mark(2, ctx.knowledge > 0)
    mark(3, ctx.entities.some(e => e.profile_id && (e.entity_id === 'school' || e.entity_id === 'academy' || e.entity_id === 'research_lab')))
  }

  if (journeyKey === 'industry') {
    mark(1, ctx.entities.length > 0)
    mark(2, ctx.entities.some(e => ['solar', 'solar_field', 'mine', 'ice_drill', 'water_extractor'].includes(e.entity_id)))
    mark(3, ctx.entities.filter(e => ['solar', 'solar_field', 'mine', 'ice_drill', 'water_extractor'].includes(e.entity_id)).length >= 2)
  }

  return Array.from(ids)
}

function progressFor(journeyKey: string, steps: any[], ctx: { ships: any[]; entities: any[]; trades: any[]; knowledge: number; currentLocation?: string }) {
  const requiredSteps = steps.filter(s => !s.optional)
  const total = Math.max(1, requiredSteps.length)
  const completed = completedStepIds(journeyKey, steps, ctx)
  const requiredCompleted = requiredSteps.filter(s => completed.includes(s.id)).length
  return { progress: requiredCompleted, progress_max: total, progress_percent: Math.round((requiredCompleted / total) * 100), completed_step_ids: completed }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: journeys, error } = await serviceClient
    .from('player_journeys')
    .select('*')
    .eq('profile_id', user.id)
    .eq('selected', true)
    .order('started_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Journeys konnten nicht geladen werden.', detail: error.message }, { status: 500 })
  }

  const keys = (journeys ?? []).map(j => j.journey_key)
  const { data: dbSteps } = keys.length > 0
    ? await serviceClient.from('journey_steps').select('*').in('journey_key', keys).order('step_order', { ascending: true })
    : { data: [] }

  const [shipsR, entitiesR, tradesR, profileR, knowledgeR] = await Promise.all([
    serviceClient.from('player_ships').select('*').eq('profile_id', user.id),
    serviceClient.from('tile_entities').select('*, locations(slug)').eq('profile_id', user.id),
    serviceClient.from('player_trades').select('id').eq('profile_id', user.id).limit(20),
    serviceClient.from('profiles').select('current_location').eq('id', user.id).single(),
    serviceClient.from('player_knowledge').select('knowledge_points').eq('profile_id', user.id).single(),
  ])

  const steps = fallbackStepsFor(keys, dbSteps ?? [])
  const ctx = {
    ships: shipsR.data ?? [],
    entities: entitiesR.data ?? [],
    trades: tradesR.data ?? [],
    knowledge: knowledgeR.data?.knowledge_points ?? 0,
    currentLocation: profileR.data?.current_location,
  }

  const enrichedJourneys = (journeys ?? []).map(j => {
    const ownSteps = steps.filter(s => s.journey_key === j.journey_key)
    const p = progressFor(j.journey_key, ownSteps, ctx)
    return { ...j, ...p }
  })

  return NextResponse.json({ journeys: enrichedJourneys, steps })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const journeyKey = String(body.journeyKey ?? '')
  const title = getJourneyTitle(journeyKey)

  if (!title) return NextResponse.json({ error: 'Unbekannter Weg.' }, { status: 400 })

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('player_journeys')
    .upsert({
      profile_id: user.id,
      journey_key: journeyKey,
      title,
      status: 'active',
      selected: true,
      progress: 0,
      progress_max: 100,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,journey_key' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: 'Weg konnte nicht gestartet werden.', detail: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, journey: data })
}
