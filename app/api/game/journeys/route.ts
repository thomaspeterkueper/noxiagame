// app/api/game/journeys/route.ts
// Erstellt: 01.07.2026
// Aktualisiert: 01.07.2026 — Default-Schritte und einfache Fortschrittsberechnung ergänzt
// Version: 0.2.0

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const JOURNEY_TITLES: Record<string, string> = {
  moon_colony: 'Mondbasis gründen',
  merchant: 'Handel & Logistik',
  research: 'Forschung aufbauen',
  industry: 'Industrie errichten',
}

const DEFAULT_STEPS: Record<string, { id: string; journey_key: string; step_order: number; title: string; description: string; optional: boolean }[]> = {
  moon_colony: [
    { id: 'moon-1', journey_key: 'moon_colony', step_order: 1, title: 'Ein geeignetes Schiff besitzen', description: 'Kaufen oder aktivieren Sie ein Schiff, mit dem Sie andere Standorte erreichen können.', optional: false },
    { id: 'moon-2', journey_key: 'moon_colony', step_order: 2, title: 'Zum Mond reisen', description: 'Öffnen Sie den Reisedialog und fliegen Sie zur Mondkolonie.', optional: false },
    { id: 'moon-3', journey_key: 'moon_colony', step_order: 3, title: 'Energieversorgung sichern', description: 'Errichten oder nutzen Sie Energieproduktion auf dem Mond.', optional: false },
    { id: 'moon-4', journey_key: 'moon_colony', step_order: 4, title: 'Wasser oder Eis erschließen', description: 'Sichern Sie Wasser als Grundlage jeder dauerhaften Mondbasis.', optional: false },
  ],
  merchant: [
    { id: 'merchant-1', journey_key: 'merchant', step_order: 1, title: 'Laderaum prüfen', description: 'Prüfen Sie Ihr aktives Schiff und den freien Laderaum.', optional: false },
    { id: 'merchant-2', journey_key: 'merchant', step_order: 2, title: 'Ware kaufen', description: 'Kaufen Sie Wasser, Energie oder Metall an einem Standort mit gutem Preis.', optional: false },
    { id: 'merchant-3', journey_key: 'merchant', step_order: 3, title: 'Zu einem anderen Markt reisen', description: 'Transportieren Sie die Ware zu einem Standort mit besserem Verkaufspreis.', optional: false },
    { id: 'merchant-4', journey_key: 'merchant', step_order: 4, title: 'Ware verkaufen oder Auftrag erfüllen', description: 'Verkaufen Sie profitabel oder erfüllen Sie einen offenen Auftrag.', optional: false },
  ],
  research: [
    { id: 'research-1', journey_key: 'research', step_order: 1, title: 'Akademie finden', description: 'Suchen Sie einen Standort mit Akademie oder Forschungseinrichtung.', optional: false },
    { id: 'research-2', journey_key: 'research', step_order: 2, title: 'Erste Wissenspunkte sammeln', description: 'Nutzen Sie Akademie-Aufgaben, um Wissen zu gewinnen.', optional: false },
    { id: 'research-3', journey_key: 'research', step_order: 3, title: 'Forschungsinfrastruktur aufbauen', description: 'Bereiten Sie eigene Forschungsgebäude oder Forschungskapazität vor.', optional: false },
  ],
  industry: [
    { id: 'industry-1', journey_key: 'industry', step_order: 1, title: 'Produktionsstandort wählen', description: 'Suchen Sie einen Standort mit freier Fläche und passenden Ressourcen.', optional: false },
    { id: 'industry-2', journey_key: 'industry', step_order: 2, title: 'Erstes Produktionsgebäude bauen', description: 'Bauen Sie Energie- oder Rohstoffproduktion.', optional: false },
    { id: 'industry-3', journey_key: 'industry', step_order: 3, title: 'Überschuss erzeugen', description: 'Produzieren Sie mehr, als der Standort verbraucht.', optional: false },
  ],
}

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
    return DEFAULT_STEPS[key] ?? []
  }).sort((a, b) => a.journey_key.localeCompare(b.journey_key) || a.step_order - b.step_order)
}

function progressFor(journeyKey: string, steps: any[], ctx: { ships: any[]; entities: any[]; trades: any[]; knowledge: number; currentLocation?: string }) {
  const total = Math.max(1, steps.filter(s => !s.optional).length)
  let done = 0

  if (journeyKey === 'moon_colony') {
    if (ctx.ships.length > 0) done++
    if (ctx.currentLocation === 'moon' || ctx.entities.some(e => e.locations?.slug === 'moon')) done++
    if (ctx.entities.some(e => e.locations?.slug === 'moon' && ['solar', 'solar_field', 'power_plant'].includes(e.entity_id))) done++
    if (ctx.entities.some(e => e.locations?.slug === 'moon' && ['ice_drill', 'water_extractor'].includes(e.entity_id))) done++
  }

  if (journeyKey === 'merchant') {
    if (ctx.ships.length > 0) done++
    if (ctx.ships.some(s => (s.cargo_max ?? 0) > 0)) done++
    if ((ctx.trades?.length ?? 0) > 0) done += 2
  }

  if (journeyKey === 'research') {
    if (ctx.entities.some(e => e.entity_id === 'school' || e.entity_id === 'academy' || e.entity_id === 'research_lab')) done++
    if (ctx.knowledge > 0) done++
    if (ctx.entities.some(e => e.profile_id && (e.entity_id === 'school' || e.entity_id === 'academy' || e.entity_id === 'research_lab'))) done++
  }

  if (journeyKey === 'industry') {
    if (ctx.entities.length > 0) done++
    if (ctx.entities.some(e => ['solar', 'solar_field', 'mine', 'ice_drill', 'water_extractor'].includes(e.entity_id))) done++
    if (ctx.entities.filter(e => ['solar', 'solar_field', 'mine', 'ice_drill', 'water_extractor'].includes(e.entity_id)).length >= 2) done++
  }

  done = Math.min(done, total)
  return { progress: done, progress_max: total, progress_percent: Math.round((done / total) * 100) }
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
    ? await serviceClient
        .from('journey_steps')
        .select('*')
        .in('journey_key', keys)
        .order('step_order', { ascending: true })
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
  const title = JOURNEY_TITLES[journeyKey]

  if (!title) {
    return NextResponse.json({ error: 'Unbekannter Weg.' }, { status: 400 })
  }

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

  if (error) {
    return NextResponse.json({ error: 'Weg konnte nicht gestartet werden.', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, journey: data })
}
