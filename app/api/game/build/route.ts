// app/api/game/build/route.ts
// Erstellt: 31.05.2026
// Aktualisiert: 14.06.2026 – Punkt 4: Bewertung über gleitenden 7-Tick-Schnitt
//   (market_prices.avg_sell_7) statt Spot-sell_price. Manipulationsfest
//   („Gutachten ≠ Tageskurs"), Fallback auf Spot solange avg_sell_7 NULL.
//   getSaleQuote bleibt rein — die Route reicht nur den anderen Zahlenwert hinein.
// 10.06.2026 – Default-Response liefert zusätzlich colony_tax + entity_info.
//
// Datenmodell:
//   player_builds   = Auftragsbuch: building → complete|cancelled, selling → sold
//   tile_entities   = Weltzustand: was steht wo (3D), wem, seit wann
//   colony_settings = Steuer-/Abgabensätze je Kolonie

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BUILDABLE_ITEMS } from '@/lib/game/config'
import { getSaleQuote, BUILDING_SALE, type BuildableId, type SaleMode } from '@/lib/game/buildingSale'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

// Verkaufswert für eine Bestands-Entität berechnen
async function getQuoteForEntity(entity: any) {
  const { data: location } = await serviceClient
    .from('locations')
    .select('id, slug, name, population, population_max')
    .eq('id', entity.location_id)
    .single()

  if (!location) return { error: 'Standort nicht gefunden' as const }

  let resourceSellPrice: number | null = null
  const producedResource =
    entity.entity_id === 'mine'  ? 'metal'
    : entity.entity_id === 'solar' ? 'energy'
    : null

  if (producedResource) {
    const { data: price } = await serviceClient
      .from('market_prices')
      .select('sell_price, avg_sell_7')
      .eq('location_id', location.id)
      .eq('resource', producedResource)
      .single()
    // Punkt 4: gleitender 7-Tick-Schnitt (manipulationsfest), Fallback auf Spot.
    resourceSellPrice = price?.avg_sell_7 ?? price?.sell_price ?? null
  }

  const quote = getSaleQuote({
    buildableId: entity.entity_id as BuildableId,
    resourceSellPrice,
    population: location.population,
    populationMax: location.population_max,
  })

  return { quote, location, resourceSellPrice }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // ───────────────────────────────────────────────────────────────
  // Laufende Vorgänge + Bestand laden (+ colony_tax + entity_info)
  // ───────────────────────────────────────────────────────────────
  if (!action) {
    const { data: due } = await serviceClient
      .from('player_builds')
      .select('*')
      .eq('profile_id', user.id)
      .in('status', ['building', 'selling'])
      .lte('completes_at', new Date().toISOString())

    for (const build of due ?? []) {
      if (build.status === 'building') await completeBuild(build, user.id)
      if (build.status === 'selling')  await completeSale(build, user.id)
    }

    const { data: active } = await serviceClient
      .from('player_builds')
      .select('*, locations(slug, name)')
      .eq('profile_id', user.id)
      .in('status', ['building', 'selling'])
      .order('completes_at')

    // Eigene Gebäude + staatliche + NPC-Gebäude
    const { data: ownEntities } = await serviceClient
      .from('tile_entities')
      .select('*, locations(slug, name)')
      .eq('profile_id', user.id)

    const { data: stateEntities } = await serviceClient
      .from('tile_entities')
      .select('*, locations(slug, name)')
      .is('profile_id', null)
      .eq('is_state_owned', true)

    // NPC-Gebäude: actor_id gesetzt, mit display_name als username
    const { data: npcEntities } = await serviceClient
      .from('tile_entities')
      .select('*, locations(slug, name), actors(display_name)')
      .not('actor_id', 'is', null)

    // display_name → username normalisieren (NPCs erscheinen wie Spieler)
    const npcNormalized = (npcEntities ?? []).map((e: any) => ({
      ...e,
      username: e.actors?.display_name ?? null,
      actors: undefined,
    }))

    const entities = [...(ownEntities ?? []), ...(stateEntities ?? []), ...npcNormalized]

    const locationIds = [...new Set((entities ?? []).map((e: any) => e.location_id))]
    let colonyTax: Record<string, { tax_property: number; tax_transaction: number; tax_landing: number }> = {}

    if (locationIds.length > 0) {
      const { data: settings } = await serviceClient
        .from('colony_settings')
        .select('location_id, tax_property, tax_transaction, tax_landing')
        .in('location_id', locationIds)

      for (const s of settings ?? []) {
        colonyTax[s.location_id] = {
          tax_property:    Number(s.tax_property)    ?? 0,
          tax_transaction: Number(s.tax_transaction) ?? 0,
          tax_landing:     Number(s.tax_landing)     ?? 0,
        }
      }
    }

    const entityInfo: Record<string, {
      ertragswert: number
      produktion: number | null
      ressource: string | null
      resourceSellPrice: number | null
    }> = {}

    await Promise.all(
      (entities ?? []).map(async (e: any) => {
        const item = BUILDABLE_ITEMS[e.entity_id]
        if (!item || item.type !== 'building') return

        const result = await getQuoteForEntity(e)
        if ('error' in result) return

        entityInfo[e.id] = {
          ertragswert:       result.quote.ertragswert,
          produktion:        item.produces?.amount ?? null,
          ressource:         item.produces?.resource ?? null,
          resourceSellPrice: result.resourceSellPrice,
        }
      })
    )

    return NextResponse.json({
      builds:     active ?? [],
      entities:   entities ?? [],
      colonyTax,
      entityInfo,
    })
  }

  // ───────────────────────────────────────────────────────────────
  // Bauauftrag starten
  // ───────────────────────────────────────────────────────────────
  if (action === 'start') {
    const buildableId  = searchParams.get('buildableId')
    const locationSlug = searchParams.get('location')
    const tileRow      = parseInt(searchParams.get('tileRow') ?? '0')
    const tileCol      = parseInt(searchParams.get('tileCol') ?? '0')
    const tileLevel    = parseInt(searchParams.get('tileLevel') ?? '0')

    if (!buildableId || !locationSlug) {
      return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })
    }
    if (tileLevel < -3 || tileLevel > 0) {
      return NextResponse.json({ error: 'Ungültige Ebene' }, { status: 400 })
    }
    if (tileRow < 0 || tileRow > 7 || tileCol < 0 || tileCol > 11 ||
        Number.isNaN(tileRow) || Number.isNaN(tileCol)) {
      return NextResponse.json({ error: 'Ungültige Kachel-Koordinate' }, { status: 400 })
    }

    const buildable = BUILDABLE_ITEMS[buildableId]
    if (!buildable) {
      return NextResponse.json({ error: 'Unbekannter Bautyp' }, { status: 400 })
    }

    // Standort-Check: manche Gebäude nur an bestimmten Orten baubar
    if (buildable.allowedLocations && !buildable.allowedLocations.includes(locationSlug)) {
      return NextResponse.json({
        error: `${buildable.name} kann hier nicht gebaut werden.`
      }, { status: 400 })
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (!profile || profile.credits < buildable.cost) {
      return NextResponse.json({ error: 'Unzureichende Credits.' }, { status: 400 })
    }

    const { data: location } = await serviceClient
      .from('locations')
      .select('id')
      .eq('slug', locationSlug)
      .single()

    if (!location) {
      return NextResponse.json({ error: 'Kolonie nicht gefunden' }, { status: 404 })
    }

    const { data: occupied } = await serviceClient
      .from('tile_entities')
      .select('id')
      .eq('location_id', location.id)
      .eq('tile_level', tileLevel)
      .eq('tile_row', tileRow)
      .eq('tile_col', tileCol)
      .eq('entity_type', 'building')
      .limit(1)

    if (occupied && occupied.length > 0) {
      return NextResponse.json({ error: 'Kachel ist bereits bebaut.' }, { status: 400 })
    }

    const { data: pending } = await serviceClient
      .from('player_builds')
      .select('id')
      .eq('location_id', location.id)
      .eq('tile_level', tileLevel)
      .eq('tile_row', tileRow)
      .eq('tile_col', tileCol)
      .in('status', ['building', 'selling'])
      .limit(1)

    if (pending && pending.length > 0) {
      return NextResponse.json({ error: 'Auf dieser Kachel läuft bereits ein Vorgang.' }, { status: 400 })
    }

    const completesAt = new Date()
    completesAt.setHours(completesAt.getHours() + buildable.buildTimeTicks * 24)

    await serviceClient.from('player_builds').insert({
      profile_id:   user.id,
      buildable_id: buildableId,
      target_type:  buildable.type,
      location_id:  location.id,
      tile_level:   tileLevel,
      tile_row:     tileRow,
      tile_col:     tileCol,
      status:       'building',
      completes_at: completesAt.toISOString(),
    })

    await serviceClient
      .from('profiles')
      .update({ credits: profile.credits - buildable.cost })
      .eq('id', user.id)

    return NextResponse.json({
      ok:          true,
      newCredits:  profile.credits - buildable.cost,
      buildable:   buildable.name,
      completesAt: completesAt.toISOString(),
    })
  }

  // ───────────────────────────────────────────────────────────────
  // Laufenden Bau abbrechen (50% Rückerstattung)
  // ───────────────────────────────────────────────────────────────
  if (action === 'cancel') {
    const buildId = searchParams.get('buildId')
    if (!buildId) return NextResponse.json({ error: 'Fehlende Build ID' }, { status: 400 })

    const { data: build } = await serviceClient
      .from('player_builds')
      .select('*')
      .eq('id', buildId)
      .eq('profile_id', user.id)
      .eq('status', 'building')
      .single()

    if (!build) return NextResponse.json({ error: 'Bauauftrag nicht gefunden' }, { status: 404 })

    const buildable = BUILDABLE_ITEMS[build.buildable_id]
    const refund = Math.floor((buildable?.cost ?? 0) * 0.5)

    await serviceClient
      .from('player_builds')
      .update({ status: 'cancelled' })
      .eq('id', buildId)

    const { data: profile } = await serviceClient
      .from('profiles').select('credits').eq('id', user.id).single()

    if (profile) {
      await serviceClient
        .from('profiles')
        .update({ credits: profile.credits + refund })
        .eq('id', user.id)
    }

    return NextResponse.json({ ok: true, refund })
  }

  // ───────────────────────────────────────────────────────────────
  // Verkaufswert anzeigen (ohne Verkauf)
  // ───────────────────────────────────────────────────────────────
  if (action === 'sellQuote') {
    const entityId = searchParams.get('entityId')
    if (!entityId) return NextResponse.json({ error: 'Fehlende Entity ID' }, { status: 400 })

    const { data: entity } = await serviceClient
      .from('tile_entities')
      .select('*')
      .eq('id', entityId)
      .eq('profile_id', user.id)
      .eq('entity_type', 'building')
      .single()

    if (!entity) return NextResponse.json({ error: 'Gebäude nicht gefunden oder gehört dir nicht' }, { status: 404 })

    const result = await getQuoteForEntity(entity)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({
      quote: result.quote,
      durationTicks: BUILDING_SALE.VERKAUFSDAUER_TICKS,
    })
  }

  // ───────────────────────────────────────────────────────────────
  // Gebäude verkaufen
  // ───────────────────────────────────────────────────────────────
  if (action === 'sell') {
    const entityId = searchParams.get('entityId')
    const mode = (searchParams.get('mode') ?? 'normal') as SaleMode
    if (!entityId) return NextResponse.json({ error: 'Fehlende Entity ID' }, { status: 400 })

    const { data: entity } = await serviceClient
      .from('tile_entities')
      .select('*')
      .eq('id', entityId)
      .eq('profile_id', user.id)
      .eq('entity_type', 'building')
      .single()

    if (!entity) return NextResponse.json({ error: 'Gebäude nicht gefunden oder gehört dir nicht' }, { status: 404 })

    const result = await getQuoteForEntity(entity)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    const { quote } = result

    const payout = mode === 'instant' ? quote.valueInstant : quote.valueNormal

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (payout < 0 && (profile?.credits ?? 0) < Math.abs(payout)) {
      return NextResponse.json(
        { error: `Entsorgung kostet ${Math.abs(payout)} Cr – unzureichende Credits.` },
        { status: 400 }
      )
    }

    const completesAt = new Date()
    if (mode === 'normal') {
      completesAt.setHours(completesAt.getHours() + BUILDING_SALE.VERKAUFSDAUER_TICKS * 24)
    }

    await serviceClient.from('player_builds').insert({
      profile_id:   user.id,
      buildable_id: entity.entity_id,
      target_type:  'building',
      location_id:  entity.location_id,
      tile_level:   entity.tile_level,
      tile_row:     entity.tile_row,
      tile_col:     entity.tile_col,
      status:       mode === 'instant' ? 'sold' : 'selling',
      sale_payout:  payout,
      completes_at: completesAt.toISOString(),
    })

    await serviceClient.from('tile_entities').delete().eq('id', entity.id)

    if (mode === 'instant') {
      await serviceClient
        .from('profiles')
        .update({ credits: (profile?.credits ?? 0) + payout })
        .eq('id', user.id)

      return NextResponse.json({ ok: true, sold: true, payout, mode })
    }

    return NextResponse.json({
      ok: true,
      selling: true,
      payout,
      completesAt: completesAt.toISOString(),
      mode,
    })
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}

// Fertigen Build aktivieren
async function completeBuild(build: any, profileId: string) {
  const buildable = BUILDABLE_ITEMS[build.buildable_id]
  if (!buildable) return

  await serviceClient
    .from('player_builds')
    .update({ status: 'complete' })
    .eq('id', build.id)

  if (buildable.type === 'building') {
    await serviceClient.from('tile_entities').insert({
      profile_id:  profileId,
      location_id: build.location_id,
      tile_level:  build.tile_level ?? 0,
      tile_row:    build.tile_row,
      tile_col:    build.tile_col,
      entity_type: 'building',
      entity_id:   build.buildable_id,
    })
  }
}

// Fälligen Verkauf abschließen → Auszahlung
async function completeSale(build: any, profileId: string) {
  await serviceClient
    .from('player_builds')
    .update({ status: 'sold' })
    .eq('id', build.id)

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('credits')
    .eq('id', profileId)
    .single()

  if (profile) {
    await serviceClient
      .from('profiles')
      .update({ credits: profile.credits + (build.sale_payout ?? 0) })
      .eq('id', profileId)
  }
}
