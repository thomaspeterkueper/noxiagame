import { NextRequest, NextResponse } from 'next/server'
import { BUILDINGS } from '@/lib/game/buildings'
import { BUILDING_SALE, getSaleQuote, type DBBuildingDef } from '@/lib/game/buildingSale'
import { TICK_INTERVAL_SECONDS } from '@/lib/game/tick'
import { createServiceClient } from '@/lib/supabase/service'

type WorldObjectAction = 'sell' | 'demolish'

type ActionBody = {
  entityId?: string
  action?: WorldObjectAction
}

type LoadedDef = DBBuildingDef & { name: string }

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(auth.slice(7))
  return user
}

async function loadDefinition(entityId: string): Promise<LoadedDef | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('building_definitions')
    .select('key,name,cost_credits,population_bonus,production,consumption,is_active')
    .eq('key', entityId)
    .eq('is_active', true)
    .maybeSingle()

  if (data) {
    return {
      name: data.name ?? entityId,
      cost_credits: Number(data.cost_credits ?? 0),
      population_bonus: Number(data.population_bonus ?? 0),
      production: Array.isArray(data.production) ? data.production : [],
      consumption: Array.isArray(data.consumption) ? data.consumption : [],
    }
  }

  const local = BUILDINGS[entityId]
  if (!local || local.planned) return null
  return {
    name: local.name,
    cost_credits: local.cost,
    population_bonus: local.populationBonus ?? 0,
    production: local.produces ? [{ resource: local.produces.resource, amount: local.produces.amount }] : [],
    consumption: local.consumes ? [{ resource: local.consumes.resource, amount: local.consumes.amount }] : [],
  }
}

async function quoteFor(entity: any, def: LoadedDef) {
  const supabase = createServiceClient()
  const { data: location } = await supabase
    .from('locations')
    .select('id,slug,name,population,population_max')
    .eq('id', entity.location_id)
    .single()
  if (!location) return null

  const mainProduction = def.production[0] ?? null
  let resourceSellPrice: number | null = null
  if (mainProduction) {
    const { data: price } = await supabase
      .from('market_prices')
      .select('sell_price,avg_sell_7')
      .eq('location_id', location.id)
      .eq('resource', mainProduction.resource)
      .maybeSingle()
    resourceSellPrice = price?.avg_sell_7 ?? price?.sell_price ?? null
  }

  return {
    location,
    quote: getSaleQuote({
      buildableId: entity.entity_id,
      def,
      resourceSellPrice,
      population: Number(location.population ?? 0),
      populationMax: Number(location.population_max ?? 0),
      condition: Number(entity.condition ?? 100),
    }),
  }
}

async function ownedEntity(req: NextRequest, entityId: string) {
  const user = await getUser(req)
  if (!user) return { user: null, entity: null, status: 401 as const }
  const supabase = createServiceClient()
  const { data: entity } = await supabase
    .from('tile_entities')
    .select('*')
    .eq('id', entityId)
    .eq('profile_id', user.id)
    .in('entity_type', ['building', 'module'])
    .maybeSingle()
  return { user, entity, status: entity ? 200 as const : 404 as const }
}

async function childCount(entityId: string) {
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('tile_entities')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', entityId)
  return Number(count ?? 0)
}

export async function GET(req: NextRequest) {
  const entityId = new URL(req.url).searchParams.get('entityId')?.trim()
  if (!entityId) return NextResponse.json({ error: 'Fehlende Entity ID' }, { status: 400 })

  const { user, entity, status } = await ownedEntity(req, entityId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status })
  if (!entity) return NextResponse.json({ error: 'Gebäude nicht gefunden oder gehört dir nicht' }, { status })

  const def = await loadDefinition(entity.entity_id)
  if (!def) return NextResponse.json({ error: 'Gebäude-Definition nicht gefunden' }, { status: 400 })
  const priced = await quoteFor(entity, def)
  if (!priced) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  return NextResponse.json({
    entity: { id: entity.id, entityId: entity.entity_id, name: def.name },
    quote: priced.quote,
    demolitionCost: priced.quote.rueckbau,
    saleDurationTicks: BUILDING_SALE.VERKAUFSDAUER_TICKS,
    saleDurationSeconds: BUILDING_SALE.VERKAUFSDAUER_TICKS * TICK_INTERVAL_SECONDS,
    childCount: await childCount(entity.id),
  })
}

export async function POST(req: NextRequest) {
  let body: ActionBody
  try { body = await req.json() as ActionBody }
  catch { return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 }) }

  const entityId = body.entityId?.trim()
  const action = body.action
  if (!entityId || (action !== 'sell' && action !== 'demolish')) {
    return NextResponse.json({ error: 'Entity ID und Aktion fehlen' }, { status: 400 })
  }

  const { user, entity, status } = await ownedEntity(req, entityId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status })
  if (!entity) return NextResponse.json({ error: 'Gebäude nicht gefunden oder gehört dir nicht' }, { status })

  const children = await childCount(entity.id)
  if (children > 0) {
    return NextResponse.json({ error: `Dieses Objekt besitzt noch ${children} untergeordnete Module. Diese müssen zuerst entfernt werden.` }, { status: 409 })
  }

  const def = await loadDefinition(entity.entity_id)
  if (!def) return NextResponse.json({ error: 'Gebäude-Definition nicht gefunden' }, { status: 400 })
  const priced = await quoteFor(entity, def)
  if (!priced) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.id).single()
  const credits = Number(profile?.credits ?? 0)

  if (action === 'demolish') {
    const cost = Math.max(0, Number(priced.quote.rueckbau ?? 0))
    if (credits < cost) return NextResponse.json({ error: `Rückbau kostet ${cost} Cr – unzureichende Credits.` }, { status: 400 })

    const { data: deleted, error: deleteError } = await supabase
      .from('tile_entities')
      .delete()
      .eq('id', entity.id)
      .eq('profile_id', user.id)
      .select('id')
      .maybeSingle()
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    if (!deleted) return NextResponse.json({ error: 'Gebäude wurde bereits entfernt.' }, { status: 409 })

    const { error: creditError } = await supabase.from('profiles').update({ credits: credits - cost }).eq('id', user.id)
    if (creditError) return NextResponse.json({ error: 'Rückbau wurde ausgeführt, Credits konnten aber nicht verbucht werden.' }, { status: 500 })

    return NextResponse.json({ ok: true, demolished: true, cost, credits: credits - cost })
  }

  const payout = Number(priced.quote.valueNormal ?? 0)
  if (payout < 0 && credits < Math.abs(payout)) {
    return NextResponse.json({ error: `Verkauf und Rückbau kosten ${Math.abs(payout)} Cr – unzureichende Credits.` }, { status: 400 })
  }

  const { data: deleted, error: deleteError } = await supabase
    .from('tile_entities')
    .delete()
    .eq('id', entity.id)
    .eq('profile_id', user.id)
    .select('*')
    .maybeSingle()
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  if (!deleted) return NextResponse.json({ error: 'Gebäude bereits im Verkauf oder nicht mehr vorhanden.' }, { status: 409 })

  const completesAt = new Date(Date.now() + BUILDING_SALE.VERKAUFSDAUER_TICKS * TICK_INTERVAL_SECONDS * 1000)
  const { error: saleError } = await supabase.from('player_builds').insert({
    profile_id: user.id,
    buildable_id: entity.entity_id,
    target_type: 'building',
    location_id: entity.location_id,
    tile_level: entity.tile_level ?? 0,
    tile_row: entity.tile_row ?? null,
    tile_col: entity.tile_col ?? null,
    placement_mode: entity.placement_mode ?? null,
    x_m: entity.x_m ?? null,
    y_m: entity.y_m ?? null,
    z_m: entity.z_m ?? null,
    rotation_deg: entity.rotation_deg ?? 0,
    footprint_width_m: entity.footprint_width_m ?? null,
    footprint_depth_m: entity.footprint_depth_m ?? null,
    site_id: entity.site_id ?? null,
    terrain_dataset_id: entity.terrain_dataset_id ?? null,
    terrain_status: entity.terrain_status ?? null,
    ground_elevation_m: entity.ground_elevation_m ?? null,
    terrain_min_elevation_m: entity.terrain_min_elevation_m ?? null,
    terrain_max_elevation_m: entity.terrain_max_elevation_m ?? null,
    terrain_slope_deg: entity.terrain_slope_deg ?? null,
    status: 'selling',
    sale_payout: payout,
    completes_at: completesAt.toISOString(),
  })

  if (saleError) {
    await supabase.from('tile_entities').insert(deleted)
    return NextResponse.json({ error: saleError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    selling: true,
    payout,
    saleDurationTicks: BUILDING_SALE.VERKAUFSDAUER_TICKS,
    completesAt: completesAt.toISOString(),
  })
}
