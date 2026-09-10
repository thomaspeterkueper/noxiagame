// app/api/game/trade/route.ts
// Aktualisiert: 10.09.2026 — atomarer Spot-Handel; Transit aus Trade herausgelöst
// Version:      1.0.0

import { NextRequest, NextResponse } from 'next/server'
import { publishTransaction } from '@/lib/ably/server'
import { createServiceClient } from '@/lib/supabase/service'
import { spotTradeCommand, type SpotTradeAction } from '@/lib/game/core/commands'
import { getPlayerTransitState } from '@/lib/game/core/transit'

const serviceClient = createServiceClient()

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

function spotError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('NOXIA_SPOT_CARGO_FULL')) return NextResponse.json({ error: 'Frachtraum voll' }, { status: 400 })
  if (message.includes('NOXIA_SPOT_CREDITS_INSUFFICIENT')) return NextResponse.json({ error: 'Unzureichende Credits' }, { status: 400 })
  if (message.includes('NOXIA_SPOT_CARGO_INSUFFICIENT')) return NextResponse.json({ error: 'Nicht genug Ware' }, { status: 400 })
  if (message.includes('NOXIA_SHIP_NOT_FOUND')) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })
  if (message.includes('NOXIA_PROFILE_NOT_FOUND')) return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  if (message.includes('NOXIA_LOCATION_NOT_FOUND')) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  if (message.includes('NOXIA_MARKET_PRICE_NOT_FOUND')) return NextResponse.json({ error: 'Kein Marktpreis für diese Ressource' }, { status: 404 })
  if (message.includes('NOXIA_SPOT_RESOURCE_INVALID')) return NextResponse.json({ error: 'Ungültige Ressource' }, { status: 400 })
  console.error('spot trade command failed:', message)
  return NextResponse.json({ error: 'Handel fehlgeschlagen' }, { status: 500 })
}

async function executeSpotTrade(userId: string, action: SpotTradeAction, resource: string, amount: number) {
  if (!resource) return NextResponse.json({ error: 'Ressource fehlt' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Ungültige Menge' }, { status: 400 })

  try {
    const result = await spotTradeCommand(userId, action, resource, amount)

    publishTransaction({
      profileId: userId,
      username: result.username ?? undefined,
      resource: result.resource,
      amount: result.booked_amount,
      profit: result.profit,
      fromLocation: result.location,
      toLocation: result.location,
    }).catch(() => {})

    if (action === 'sell') {
      const { data: loc } = await serviceClient
        .from('locations')
        .select('id')
        .eq('slug', result.location)
        .maybeSingle()
      if (loc) {
        try {
          await serviceClient.rpc('upsert_location_reputation', {
            p_profile_id: userId,
            p_location_id: loc.id,
            p_deliveries: 1,
            p_volume: result.booked_amount,
          })
        } catch {
          // Reputation is deliberately non-critical to settlement.
        }
      }
    }

    const { data: cargoRows } = await serviceClient
      .from('ship_cargo')
      .select('resource, amount')
      .eq('ship_id', result.ship_id)

    const cargo: Record<string, number> = { water: 0, energy: 0, metal: 0 }
    for (const row of cargoRows ?? []) cargo[row.resource] = row.amount

    return NextResponse.json({
      ok: true,
      bookedAmount: result.booked_amount,
      requestedAmount: result.requested_amount,
      unitPrice: result.unit_price,
      taxCharged: result.tax_charged,
      taxRate: result.tax_rate,
      priceUpdate: result.price_changed
        ? { resource: result.resource, buyPrice: result.market_buy_price, sellPrice: result.market_sell_price }
        : null,
      credits: result.credits,
      location: result.location,
      cargoMax: result.cargo_max,
      cargo,
      shipId: result.ship_id,
      shipTypeId: result.ship_type_id,
    })
  } catch (error) {
    return spotError(error)
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'getTrades') {
    const { data: trades } = await serviceClient
      .from('trade_transactions')
      .select('*')
      .eq('profile_id', user.id)
      .order('traded_at', { ascending: false })
      .limit(100)
    return NextResponse.json({ trades: trades ?? [] })
  }

  if (action === 'travel') {
    return NextResponse.json({
      error: 'Der synchrone Travel-Pfad wurde entfernt. Transit läuft über /api/game/transit.',
      code: 'TRAVEL_MOVED_TO_TRANSIT',
    }, { status: 410 })
  }

  if (!action) {
    // Also settles a due transit idempotently before the general ship snapshot.
    const transit = await getPlayerTransitState(user.id).catch(() => null)

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    const { data: shipRows } = await serviceClient
      .from('ships')
      .select('id, location, cargo_max, ship_type_id, is_active')
      .eq('profile_id', user.id)
    const ship: any = (shipRows as any[])?.find((s: any) => s.is_active)
      ?? (shipRows as any[])?.[0]
      ?? null

    const { data: shipType } = ship?.ship_type_id
      ? await serviceClient.from('ship_types').select('speed_mult, range_distance').eq('id', ship.ship_type_id).maybeSingle()
      : { data: null }

    const { data: cargoRows } = ship
      ? await serviceClient.from('ship_cargo').select('resource, amount').eq('ship_id', ship.id)
      : { data: [] }

    const cargo: Record<string, number> = { water: 0, energy: 0, metal: 0 }
    for (const row of cargoRows ?? []) cargo[row.resource] = row.amount

    return NextResponse.json({
      credits: profile?.credits ?? 5000,
      location: ship?.location ?? 'moon',
      cargoMax: ship?.cargo_max ?? 100,
      cargo,
      shipId: ship?.id,
      shipTypeId: ship?.ship_type_id ?? 'freighter_mk1',
      speedMult: Number((shipType as any)?.speed_mult ?? 1.0),
      rangeDistance: Number((shipType as any)?.range_distance ?? 28),
      transit,
    })
  }

  const resource = searchParams.get('resource') ?? ''
  const amount = Number.parseInt(searchParams.get('amount') ?? '1', 10)

  if (action === 'buy' || action === 'sell') {
    return executeSpotTrade(user.id, action, resource, amount)
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const action = body?.action
  if (action !== 'buy' && action !== 'sell') {
    return NextResponse.json({ error: 'POST unterstützt hier nur buy/sell; Reisen laufen über /api/game/transit.' }, { status: 400 })
  }

  return executeSpotTrade(
    user.id,
    action,
    typeof body?.resource === 'string' ? body.resource : '',
    Number.parseInt(String(body?.amount ?? '1'), 10),
  )
}
