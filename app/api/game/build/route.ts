// route.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; Build/Sell-Route
// Version:      1.0.0
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSaleQuote, BUILDING_SALE, type SaleMode, type DBBuildingDef } from '@/lib/game/buildingSale'
import { BUILDINGS } from '@/lib/game/buildings'
import { getBuildRequirements } from '@/lib/knowledge/buildRequirements'
import { getNoxiaKnowledgeState } from '@/lib/knowledge/service'

const WORLD_COLS = 32
const WORLD_ROWS = 24

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env['SUPABASE_SERVICE_ROLE_KEY'] as string,
)

const MODULE_COSTS: Record<string, { cost: number; buildTicks: number }> = {
  solar_array: { cost: 1800, buildTicks: 2 },
  docking_bay: { cost: 2200, buildTicks: 3 },
  habitat_module: { cost: 2000, buildTicks: 3 },
  research_lab: { cost: 3000, buildTicks: 4 },
  water_recycler: { cost: 2500, buildTicks: 3 },
  storage_bay: { cost: 1500, buildTicks: 2 },
  observatory: { cost: 2800, buildTicks: 4 },
  reactor: { cost: 8000, buildTicks: 6 },
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

function localBuildingDef(key: string): (DBBuildingDef & { name: string; allowed_locations: string[] | null; build_time_ticks: number }) | null {
  const def = BUILDINGS[key]
  if (!def || def.planned) return null
  return {
    name: def.name,
    cost_credits: def.cost,
    population_bonus: def.populationBonus ?? 0,
    production: def.produces ? [{ resource: def.produces.resource, amount: def.produces.amount }] : [],
    consumption: def.consumes ? [{ resource: def.consumes.resource, amount: def.consumes.amount }] : [],
    allowed_locations: def.allowedLocations ?? null,
    build_time_ticks: def.buildTimeTicks,
  }
}

async function loadBuildingDef(key: string): Promise<DBBuildingDef | null> {
  const { data } = await serviceClient
    .from('building_definitions')
    .select('key, cost_credits, population_bonus, production, consumption, allowed_locations, build_time_ticks, name')
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle()

  if (!data) return localBuildingDef(key)
  return {
    cost_credits: data.cost_credits ?? 0,
    population_bonus: data.population_bonus ?? 0,
    production: Array.isArray(data.production) ? data.production : [],
    consumption: Array.isArray(data.consumption) ? data.consumption : [],
  }
}

async function loadRawBuildingDef(key: string) {
  const { data } = await serviceClient
    .from('building_definitions')
    .select('allowed_locations, name, build_time_ticks')
    .eq('key', key)
    .maybeSingle()

  return data ?? localBuildingDef(key)
}

async function loadAllBuildingDefs(): Promise<Map<string, DBBuildingDef & { name: string; allowed_locations: string[] | null }>> {
  const { data } = await serviceClient
    .from('building_definitions')
    .select('key, name, cost_credits, population_bonus, production, consumption, allowed_locations')
    .eq('is_active', true)

  const map = new Map<string, DBBuildingDef & { name: string; allowed_locations: string[] | null }>()
  for (const row of data ?? []) {
    map.set(row.key, {
      name: row.name,
      cost_credits: row.cost_credits ?? 0,
      population_bonus: row.population_bonus ?? 0,
      production: Array.isArray(row.production) ? row.production : [],
      consumption: Array.isArray(row.consumption) ? row.consumption : [],
      allowed_locations: row.allowed_locations ?? null,
    })
  }

  for (const [key, def] of Object.entries(BUILDINGS)) {
    if (!map.has(key) && !def.planned) {
      const local = localBuildingDef(key)
      if (local) map.set(key, local)
    }
  }

  return map
}

async function getQuoteForEntity(entity: any, def: DBBuildingDef) {
  const { data: location } = await serviceClient
    .from('locations')
    .select('id, slug, name, population, population_max')
    .eq('id', entity.location_id)
    .single()

  if (!location) return { error: 'Standort nicht gefunden' as const }

  const hauptprod = def.production[0] ?? null
  let resourceSellPrice: number | null = null
  if (hauptprod) {
    const { data: price } = await serviceClient
      .from('market_prices')
      .select('sell_price, avg_sell_7')
      .eq('location_id', location.id)
      .eq('resource', hauptprod.resource)
      .maybeSingle()
    resourceSellPrice = price?.avg_sell_7 ?? price?.sell_price ?? null
  }

  return {
    quote: getSaleQuote({ buildableId: entity.entity_id, def, resourceSellPrice, population: location.population, populationMax: location.population_max }),
    location,
    resourceSellPrice,
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (!action) {
    const { data: due } = await serviceClient
      .from('player_builds')
      .select('*')
      .eq('profile_id', user.id)
      .in('status', ['building', 'selling'])
      .lte('completes_at', new Date().toISOString())

    for (const build of due ?? []) {
      if (build.status === 'building') await completeBuild(build, user.id)
      if (build.status === 'selling') await completeSale(build, user.id)
    }

    const { data: active } = await serviceClient
      .from('player_builds')
      .select('*, locations(slug, name)')
      .eq('profile_id', user.id)
      .in('status', ['building', 'selling'])
      .order('completes_at')

    const { data: ownEntities } = await serviceClient
      .from('tile_entities')
      .select('*, locations(slug, name)')
      .eq('profile_id', user.id)
      .in('entity_type', ['building', 'module'])

    const { data: stateEntities } = await serviceClient
      .from('tile_entities')
      .select('*, locations(slug, name)')
      .is('profile_id', null)
      .eq('is_state_owned', true)
      .in('entity_type', ['building', 'module'])

    const { data: npcEntities } = await serviceClient
      .from('tile_entities')
      .select('*, locations(slug, name), actors(display_name)')
      .not('actor_id', 'is', null)

    const npcNormalized = (npcEntities ?? []).map((e: any) => ({ ...e, username: e.actors?.display_name ?? null, actors: undefined }))
    const ownLocationIds = [...new Set([...(ownEntities ?? []).map((e: any) => e.location_id), ...(stateEntities ?? []).map((e: any) => e.location_id)])].filter(Boolean)

    const { data: otherEntities } = ownLocationIds.length > 0
      ? await serviceClient
          .from('tile_entities')
          .select('*, locations(slug, name), profiles(username)')
          .neq('profile_id', user.id)
          .is('actor_id', null)
          .eq('is_state_owned', false)
          .in('location_id', ownLocationIds)
          .in('entity_type', ['building'])
      : { data: [] }

    const otherNormalized = (otherEntities ?? []).map((e: any) => ({ ...e, username: e.profiles?.username ?? 'Unbekannter Pilot', profiles: undefined }))
    const entities = [...(ownEntities ?? []), ...(stateEntities ?? []), ...npcNormalized, ...otherNormalized]
    const locationIds = [...new Set(entities.map((e: any) => e.location_id))]
    const colonyTax: Record<string, { tax_property: number; tax_transaction: number; tax_landing: number }> = {}

    if (locationIds.length > 0) {
      const { data: settings } = await serviceClient
        .from('colony_settings')
        .select('location_id, tax_property, tax_transaction, tax_landing')
        .in('location_id', locationIds)
      for (const s of settings ?? []) {
        colonyTax[s.location_id] = { tax_property: Number(s.tax_property) ?? 0, tax_transaction: Number(s.tax_transaction) ?? 0, tax_landing: Number(s.tax_landing) ?? 0 }
      }
    }

    const allDefs = await loadAllBuildingDefs()
    const entityInfo: Record<string, { ertragswert: number; produktion: number | null; ressource: string | null; resourceSellPrice: number | null }> = {}
    await Promise.all(entities.map(async (e: any) => {
      if (e.entity_type !== 'building') return
      const def = allDefs.get(e.entity_id)
      if (!def) return
      const result = await getQuoteForEntity(e, def)
      if ('error' in result) return
      entityInfo[e.id] = { ertragswert: result.quote.ertragswert, produktion: def.production[0]?.amount ?? null, ressource: def.production[0]?.resource ?? null, resourceSellPrice: result.resourceSellPrice }
    }))

    return NextResponse.json({ builds: active ?? [], entities: entities ?? [], colonyTax, entityInfo })
  }

  if (action === 'start') {
    const buildableId = searchParams.get('buildableId')
    const locationSlug = searchParams.get('location')
    const tileRow = parseInt(searchParams.get('tileRow') ?? '0')
    const tileCol = parseInt(searchParams.get('tileCol') ?? '0')
    const tileLevel = parseInt(searchParams.get('tileLevel') ?? '0')

    if (!buildableId || !locationSlug) return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })
    if (tileLevel < -3 || tileLevel > 0) return NextResponse.json({ error: 'Ungültige Ebene' }, { status: 400 })
    if (tileRow < 0 || tileRow >= WORLD_ROWS || tileCol < 0 || tileCol >= WORLD_COLS || Number.isNaN(tileRow) || Number.isNaN(tileCol)) {
      return NextResponse.json({ error: 'Ungültige Kachel-Koordinate' }, { status: 400 })
    }

    const moduleDef = MODULE_COSTS[buildableId]
    if (moduleDef) {
      const { data: locationForModule } = await serviceClient.from('locations').select('id, location_type').eq('slug', locationSlug).single()
      if (!locationForModule || locationForModule.location_type !== 'station') return NextResponse.json({ error: 'Module können nur auf Stationen gebaut werden.' }, { status: 400 })
      const { data: profileM } = await serviceClient.from('profiles').select('credits').eq('id', user.id).single()
      if (!profileM || profileM.credits < moduleDef.cost) return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })
      const { data: existingModules } = await serviceClient.from('tile_entities').select('slot').eq('location_id', locationForModule.id).eq('entity_type', 'module').order('slot', { ascending: false }).limit(1)
      const nextSlot = existingModules?.length ? (existingModules[0].slot ?? 0) + 1 : 0
      await serviceClient.from('profiles').update({ credits: profileM.credits - moduleDef.cost }).eq('id', user.id)
      await serviceClient.from('tile_entities').insert({ profile_id: user.id, location_id: locationForModule.id, entity_type: 'module', entity_id: buildableId, tile_level: 0, tile_row: null, tile_col: null, slot: nextSlot, is_state_owned: false, condition: 100, status: 'active' })
      return NextResponse.json({ ok: true, credits: profileM.credits - moduleDef.cost })
    }

    const knowledge = await getNoxiaKnowledgeState(user.id)
    const gate = getBuildRequirements(buildableId, { completedModules: knowledge.completedModules, unlocked: knowledge.unlocked })
    if (!gate.ok) return NextResponse.json({ error: `Wissen fehlt: ${gate.requiredUnlock}` }, { status: 403 })

    const buildingDef = await loadBuildingDef(buildableId)
    if (!buildingDef) return NextResponse.json({ error: 'Unbekannter oder inaktiver Bautyp', buildableId }, { status: 400 })

    const rawDef = await loadRawBuildingDef(buildableId)
    if (rawDef?.allowed_locations?.length && !rawDef.allowed_locations.includes(locationSlug)) {
      return NextResponse.json({ error: `${rawDef.name} kann hier nicht gebaut werden.` }, { status: 400 })
    }

    const { data: profile } = await serviceClient.from('profiles').select('credits').eq('id', user.id).single()
    if (!profile || profile.credits < buildingDef.cost_credits) return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })

    const { data: location } = await serviceClient.from('locations').select('id').eq('slug', locationSlug).single()
    if (!location) return NextResponse.json({ error: 'Kolonie nicht gefunden' }, { status: 404 })

    const { data: occupied } = await serviceClient.from('tile_entities').select('id').eq('location_id', location.id).eq('tile_level', tileLevel).eq('tile_row', tileRow).eq('tile_col', tileCol).eq('entity_type', 'building').limit(1)
    if (occupied && occupied.length > 0) return NextResponse.json({ error: 'Kachel ist bereits bebaut.' }, { status: 400 })

    const { data: pending } = await serviceClient.from('player_builds').select('id').eq('location_id', location.id).eq('tile_level', tileLevel).eq('tile_row', tileRow).eq('tile_col', tileCol).in('status', ['building', 'selling']).limit(1)
    if (pending && pending.length > 0) return NextResponse.json({ error: 'Auf dieser Kachel läuft bereits ein Vorgang.' }, { status: 400 })

    const buildTimeTicks = rawDef?.build_time_ticks ?? 1
    const completesAt = new Date()
    completesAt.setHours(completesAt.getHours() + buildTimeTicks * 24)

    await serviceClient.from('player_builds').insert({ profile_id: user.id, buildable_id: buildableId, target_type: 'building', location_id: location.id, tile_level: tileLevel, tile_row: tileRow, tile_col: tileCol, status: 'building', completes_at: completesAt.toISOString() })
    await serviceClient.from('profiles').update({ credits: profile.credits - buildingDef.cost_credits }).eq('id', user.id)

    return NextResponse.json({ ok: true, newCredits: profile.credits - buildingDef.cost_credits, buildable: rawDef?.name ?? buildableId, completesAt: completesAt.toISOString() })
  }

  if (action === 'cancel') {
    const buildId = searchParams.get('buildId')
    if (!buildId) return NextResponse.json({ error: 'Fehlende Build ID' }, { status: 400 })
    const { data: build } = await serviceClient.from('player_builds').select('*').eq('id', buildId).eq('profile_id', user.id).eq('status', 'building').single()
    if (!build) return NextResponse.json({ error: 'Bauauftrag nicht gefunden' }, { status: 404 })
    const { data: defForCancel } = await serviceClient.from('building_definitions').select('cost_credits').eq('key', build.buildable_id).maybeSingle()
    const local = localBuildingDef(build.buildable_id)
    const refund = Math.floor(((defForCancel?.cost_credits ?? local?.cost_credits) ?? 0) * 0.5)
    await serviceClient.from('player_builds').update({ status: 'cancelled' }).eq('id', buildId)
    const { data: profile } = await serviceClient.from('profiles').select('credits').eq('id', user.id).single()
    if (profile) await serviceClient.from('profiles').update({ credits: profile.credits + refund }).eq('id', user.id)
    return NextResponse.json({ ok: true, refund })
  }

  if (action === 'sellQuote') {
    const entityId = searchParams.get('entityId')
    if (!entityId) return NextResponse.json({ error: 'Fehlende Entity ID' }, { status: 400 })
    const { data: entity } = await serviceClient.from('tile_entities').select('*').eq('id', entityId).eq('profile_id', user.id).eq('entity_type', 'building').single()
    if (!entity) return NextResponse.json({ error: 'Gebäude nicht gefunden oder gehört dir nicht' }, { status: 404 })
    const def = await loadBuildingDef(entity.entity_id)
    if (!def) return NextResponse.json({ error: 'Gebäude-Definition nicht gefunden' }, { status: 400 })
    const result = await getQuoteForEntity(entity, def)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ quote: result.quote, durationTicks: BUILDING_SALE.VERKAUFSDAUER_TICKS })
  }

  if (action === 'sell') {
    const entityId = searchParams.get('entityId')
    const mode = (searchParams.get('mode') ?? 'normal') as SaleMode
    if (!entityId) return NextResponse.json({ error: 'Fehlende Entity ID' }, { status: 400 })
    const { data: entity } = await serviceClient.from('tile_entities').select('*').eq('id', entityId).eq('profile_id', user.id).eq('entity_type', 'building').single()
    if (!entity) return NextResponse.json({ error: 'Gebäude nicht gefunden oder gehört dir nicht' }, { status: 404 })
    const def = await loadBuildingDef(entity.entity_id)
    if (!def) return NextResponse.json({ error: 'Gebäude-Definition nicht gefunden' }, { status: 400 })
    const result = await getQuoteForEntity(entity, def)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    const payout = mode === 'instant' ? result.quote.valueInstant : result.quote.valueNormal
    const { data: profile } = await serviceClient.from('profiles').select('credits').eq('id', user.id).single()
    if (payout < 0 && (profile?.credits ?? 0) < Math.abs(payout)) return NextResponse.json({ error: `Entsorgung kostet ${Math.abs(payout)} Cr – unzureichende Credits.` }, { status: 400 })
    const completesAt = new Date()
    if (mode === 'normal') completesAt.setHours(completesAt.getHours() + BUILDING_SALE.VERKAUFSDAUER_TICKS * 24)
    await serviceClient.from('player_builds').insert({ profile_id: user.id, buildable_id: entity.entity_id, target_type: 'building', location_id: entity.location_id, tile_level: entity.tile_level, tile_row: entity.tile_row, tile_col: entity.tile_col, status: mode === 'instant' ? 'sold' : 'selling', sale_payout: payout, completes_at: completesAt.toISOString() })
    await serviceClient.from('tile_entities').delete().eq('id', entity.id)
    if (mode === 'instant') {
      await serviceClient.from('profiles').update({ credits: (profile?.credits ?? 0) + payout }).eq('id', user.id)
      return NextResponse.json({ ok: true, sold: true, payout, mode })
    }
    return NextResponse.json({ ok: true, selling: true, payout, completesAt: completesAt.toISOString(), mode })
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}

async function completeBuild(build: any, profileId: string) {
  const def = await loadBuildingDef(build.buildable_id)
  if (!def) return
  await serviceClient.from('player_builds').update({ status: 'complete' }).eq('id', build.id)
  await serviceClient.from('tile_entities').insert({ profile_id: profileId, location_id: build.location_id, tile_level: build.tile_level ?? 0, tile_row: build.tile_row, tile_col: build.tile_col, entity_type: 'building', entity_id: build.buildable_id })
}

async function completeSale(build: any, profileId: string) {
  await serviceClient.from('player_builds').update({ status: 'sold' }).eq('id', build.id)
  const { data: profile } = await serviceClient.from('profiles').select('credits').eq('id', profileId).single()
  if (profile) await serviceClient.from('profiles').update({ credits: profile.credits + (build.sale_payout ?? 0) }).eq('id', profileId)
}
