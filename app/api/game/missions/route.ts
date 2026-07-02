// app/api/game/missions/route.ts
// Erstellt: 02.07.2026
// Aktualisiert: 02.07.2026 — echte Tabellen ships/trade_transactions/ship_cargo verwendet
// Version: 0.1.1
//
// Liefert wenige klare Startmissionen, damit neue Spieler das Spielprinzip
// schnell verstehen: Raumfahrt, Handel, Forschung, Industrie und Mondbasis.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

type Step = {
  id: string
  title: string
  description: string
  action: 'shipyard' | 'warehouse' | 'travel' | 'grid' | 'academy' | 'none'
}

type Mission = {
  id: string
  title: string
  theme: string
  summary: string
  reward: string
  steps: Step[]
}

const MISSIONS: Mission[] = [
  {
    id: 'm_start_ship',
    title: 'Startklar',
    theme: 'Raumfahrt',
    summary: 'Besorgen Sie sich ein einsatzfähiges Schiff. Ohne Schiff bleiben Handel, Expansion und Mondprogramm Theorie.',
    reward: '+ Orientierung',
    steps: [
      { id: 'ship_owned', title: 'Ein Schiff besitzen', description: 'Öffnen Sie die Werft und kaufen oder aktivieren Sie ein geeignetes Schiff.', action: 'shipyard' },
    ],
  },
  {
    id: 'm_first_trade',
    title: 'Der erste Handel',
    theme: 'Handel',
    summary: 'Kaufen Sie Ware an einem Standort und verkaufen oder liefern Sie sie an anderer Stelle.',
    reward: '+ Handelsverständnis',
    steps: [
      { id: 'cargo_ready', title: 'Laderaum nutzen', description: 'Öffnen Sie das Warenhaus und kaufen Sie Wasser, Energie oder Metall.', action: 'warehouse' },
      { id: 'trade_done', title: 'Ersten Handel abschließen', description: 'Verkaufen Sie Ware oder erfüllen Sie einen Auftrag.', action: 'warehouse' },
    ],
  },
  {
    id: 'm_first_flight',
    title: 'Der erste Flug',
    theme: 'Navigation',
    summary: 'Reisen Sie zu einem anderen Standort. Dadurch wird klar, dass Noxia nicht an einem Ort stattfindet.',
    reward: '+ Raumgefühl',
    steps: [
      { id: 'flight_done', title: 'Standort wechseln', description: 'Öffnen Sie die Standort-/Reiseansicht und fliegen Sie zu einem erreichbaren Ziel.', action: 'travel' },
    ],
  },
  {
    id: 'm_first_industry',
    title: 'Erste Produktion',
    theme: 'Industrie',
    summary: 'Errichten Sie ein Produktionsgebäude. Energie, Wasser und Metall sind die Grundlage späterer Kolonien.',
    reward: '+ Produktionsverständnis',
    steps: [
      { id: 'production_built', title: 'Produktionsgebäude bauen', description: 'Klicken Sie auf eine freie Kachel und bauen Sie z. B. Solarfeld, Mine oder Eisbohrer.', action: 'grid' },
    ],
  },
  {
    id: 'm_first_knowledge',
    title: 'Wissen freischalten',
    theme: 'Forschung',
    summary: 'Wissenschaft ist ein Kernmotor von Noxia. Sammeln Sie erste Wissenspunkte.',
    reward: '+ Forschungsverständnis',
    steps: [
      { id: 'knowledge_gained', title: 'Erste Wissenspunkte sammeln', description: 'Suchen Sie eine Akademie und nutzen Sie Aufgaben oder Handbuch.', action: 'academy' },
    ],
  },
  {
    id: 'm_moon_basis',
    title: 'Die erste Mondbasis',
    theme: 'Kolonisation',
    summary: 'Verbinden Sie Raumfahrt, Versorgung und Bau zu einer dauerhaften Präsenz auf dem Mond.',
    reward: '+ Mondprogramm',
    steps: [
      { id: 'moon_reached', title: 'Mond erreichen', description: 'Fliegen Sie zum Mond oder besitzen Sie dort ein erstes Gebäude.', action: 'travel' },
      { id: 'moon_power', title: 'Energie auf dem Mond sichern', description: 'Bauen Sie ein Solarfeld oder eine andere Energiequelle auf dem Mond.', action: 'grid' },
      { id: 'moon_water', title: 'Wasser oder Eis sichern', description: 'Bauen Sie einen Eisbohrer oder Wasserextraktor auf dem Mond.', action: 'grid' },
    ],
  },
]

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const serviceClient = createServiceClient()
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

function isProductionEntity(entityId: string) {
  return ['solar', 'solar_field', 'mine', 'ice_drill', 'water_extractor', 'power_plant'].includes(entityId)
}

function completedStepIds(stepId: string, ctx: { ships: any[]; entities: any[]; trades: any[]; profile: any; knowledge: number; cargoUsed: number }) {
  switch (stepId) {
    case 'ship_owned':
      return ctx.ships.length > 0
    case 'cargo_ready':
      return ctx.cargoUsed > 0 || (ctx.trades?.length ?? 0) > 0
    case 'trade_done':
      return (ctx.trades?.length ?? 0) > 0
    case 'flight_done':
      return (ctx.profile?.flight_count ?? 0) > 0 || ctx.profile?.current_location !== 'earth'
    case 'production_built':
      return ctx.entities.some(e => isProductionEntity(e.entity_id))
    case 'knowledge_gained':
      return ctx.knowledge > 0
    case 'moon_reached':
      return ctx.profile?.current_location === 'moon' || ctx.entities.some(e => e.locations?.slug === 'moon')
    case 'moon_power':
      return ctx.entities.some(e => e.locations?.slug === 'moon' && ['solar', 'solar_field', 'power_plant'].includes(e.entity_id))
    case 'moon_water':
      return ctx.entities.some(e => e.locations?.slug === 'moon' && ['ice_drill', 'water_extractor'].includes(e.entity_id))
    default:
      return false
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()

  const [shipsR, entitiesR, tradesR, profileR, knowledgeR] = await Promise.all([
    serviceClient.from('ships').select('*').eq('profile_id', user.id),
    serviceClient.from('tile_entities').select('*, locations(slug)').eq('profile_id', user.id),
    serviceClient.from('trade_transactions').select('id').eq('profile_id', user.id).limit(50),
    serviceClient.from('profiles').select('current_location, flight_count').eq('id', user.id).single(),
    serviceClient.from('player_knowledge').select('knowledge_points').eq('profile_id', user.id).single(),
  ])

  const ships = shipsR.data ?? []
  const entities = entitiesR.data ?? []
  const trades = tradesR.data ?? []
  const profile = profileR.data ?? {}
  const knowledge = knowledgeR.data?.knowledge_points ?? 0

  const activeShip = ships.find((ship: any) => ship.is_active) ?? ships[0]
  const { data: cargoRows } = activeShip?.id
    ? await serviceClient.from('ship_cargo').select('amount').eq('ship_id', activeShip.id)
    : { data: [] }
  const cargoUsed = (cargoRows ?? []).reduce((sum: number, row: any) => sum + Number(row.amount ?? 0), 0)

  const ctx = { ships, entities, trades, profile, knowledge, cargoUsed }

  const missions = MISSIONS.map(mission => {
    const steps = mission.steps.map(step => ({ ...step, completed: completedStepIds(step.id, ctx) }))
    const completed = steps.filter(s => s.completed).length
    const total = steps.length
    const nextStep = steps.find(s => !s.completed) ?? null
    return {
      ...mission,
      steps,
      completed,
      total,
      progress_percent: Math.round((completed / Math.max(1, total)) * 100),
      status: completed >= total ? 'completed' : 'active',
      nextStep,
    }
  })

  return NextResponse.json({ missions })
}
