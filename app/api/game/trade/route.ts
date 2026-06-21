// app/api/game/trade/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 21.06.2026 20:35
// Version:      0.5.2
//
// v0.5.0 – Schiffsdaten vollständig: loadFromServer-Block joint jetzt
//   ship_types und liefert speedMult + rangeDistance.
//   - BUGFIX: speed_mult kam nie im Client an (ship_types nicht gejoint) →
//     Transit rechnete immer mit 1.0, Schiffsgeschwindigkeit war wirkungslos.
//   - rangeDistance (statische Reichweite, Basis-Distanz) fürs Reiseziel-
//     Filter im Dashboard (Schicht 2 des ortszentrierten Redesigns).
//
// v0.4.0 – Transaktionssteuer (colony_settings.tax_transaction).
// v0.3.0 – Transaktionsbasierter Preisimpuls + Server-Preis (Arbitrage-Fix).
// v0.2.0 – Cargo-Loop-Atomicity.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRICE_MIN, PRICE_MAX, PRICE_IMPULSE_PER_TON } from '@/lib/game/config'
import { flightEnergyCost } from '@/lib/game/ships'

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

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // Handelshistorie laden (für Statistiken)
  if (action === 'getTrades') {
    const { data: trades } = await serviceClient
      .from('trade_transactions')
      .select('*')
      .eq('profile_id', user.id)
      .order('traded_at', { ascending: false })
      .limit(100)

    return NextResponse.json({ trades: trades ?? [] })
  }

  // Spielstand laden (kein action Parameter)
  if (!action) {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    // Aktives Schiff via is_active flag — kein profiles-Zugriff nötig
    const { data: shipRows, error: shipErr } = await serviceClient
      .from('ships')
      .select('id, location, cargo_max, ship_type_id, is_active, ship_types(speed_mult, range_distance)')
      .eq('profile_id', user.id)
    const ship: any = (shipRows as any[])?.find((s: any) => s.is_active)
      ?? (shipRows as any[])?.[0]
      ?? null

    console.log(`getTrades: user=${user.id} shipErr=${JSON.stringify(shipErr)} ships=${JSON.stringify((shipRows as any[])?.map((s:any)=>({id:s.id,loc:s.location,active:s.is_active})))} → ship=${ship?.id} loc=${ship?.location}`)

    const { data: cargo } = ship
      ? await serviceClient
          .from('ship_cargo')
          .select('resource, amount')
          .eq('ship_id', ship.id)
      : { data: [] }

    const cargoMap: Record<string, number> = { water: 0, energy: 0, metal: 0 }
    for (const c of cargo ?? []) cargoMap[c.resource] = c.amount

    // ship_types kommt als verschachteltes Objekt (oder Array, je nach Join).
    const st: any = Array.isArray((ship as any)?.ship_types)
      ? (ship as any)?.ship_types?.[0]
      : (ship as any)?.ship_types

    return NextResponse.json({
      credits: profile?.credits ?? 5000,
      location: ship?.location ?? 'moon',
      cargoMax: ship?.cargo_max ?? 100,
      cargo: cargoMap,
      shipId: ship?.id,
      shipTypeId: ship?.ship_type_id ?? 'freighter_mk1',
      speedMult: Number(st?.speed_mult ?? 1.0),          // BUGFIX: war nie geliefert
      rangeDistance: Number(st?.range_distance ?? 28),   // statische Reichweite
    })
  }

  const resource = searchParams.get('resource') as string
  const amount = parseInt(searchParams.get('amount') ?? '1', 10)
  const location = searchParams.get('location') as string
  const clientPrice = parseInt(searchParams.get('price') ?? '0', 10)

  // Travel — Energie aus Laderaum entnehmen (Treibstoff-Mechanik)
  if (action === 'travel') {
    const dest = resource  // resource-Parameter = Zielort beim Travel

    // Aktives Schiff für Travel via is_active
    const { data: shipRowsT } = await serviceClient
      .from('ships')
      .select('id, location, cargo_max, is_active')
      .eq('profile_id', user.id)
    const travelShip: any = (shipRowsT as any[])?.find((s: any) => s.is_active)
      ?? (shipRowsT as any[])?.[0]
      ?? null

    if (!travelShip) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })

    const energyNeeded = flightEnergyCost(travelShip.location, dest)

    // Energie im Laderaum prüfen
    const { data: energyCargo } = await serviceClient
      .from('ship_cargo')
      .select('amount')
      .eq('ship_id', travelShip.id)
      .eq('resource', 'energy')
      .maybeSingle()

    const energyOnBoard = Number(energyCargo?.amount ?? 0)

    console.log(`travel: ${travelShip.location} → ${dest}, energyNeeded=${energyNeeded}, onBoard=${energyOnBoard}`)

    if (energyOnBoard < energyNeeded) {
      return NextResponse.json({
        error: `Nicht genug Energie. Benötigt: ${energyNeeded}t, an Bord: ${energyOnBoard}t`,
        energyNeeded,
        energyOnBoard,
        shipLocation: travelShip.location,
      }, { status: 400 })
    }

    // Energie verbrauchen
    const energyLeft = energyOnBoard - energyNeeded
    if (energyLeft > 0) {
      await serviceClient.from('ship_cargo')
        .update({ amount: energyLeft })
        .eq('ship_id', travelShip.id)
        .eq('resource', 'energy')
    } else {
      await serviceClient.from('ship_cargo')
        .delete()
        .eq('ship_id', travelShip.id)
        .eq('resource', 'energy')
    }

    // Schiff bewegen (per ID — nur das spezifische Schiff)
    await serviceClient
      .from('ships')
      .update({ location: dest })
      .eq('id', travelShip.id)

    return NextResponse.json({ ok: true, location: dest, energyUsed: energyNeeded })
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Ungültige Menge' }, { status: 400 })
  }

  if (action !== 'buy' && action !== 'sell') {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  }

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, credits')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  }

  // Aktives Schiff für buy/sell via is_active
  const { data: shipRows2 } = await serviceClient
    .from('ships')
    .select('id, location, cargo_max, ship_type_id, is_active')
    .eq('profile_id', user.id)
  const ship: any = (shipRows2 as any[])?.find((s: any) => s.is_active)
    ?? (shipRows2 as any[])?.[0]
    ?? null

  if (!ship) {
    return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })
  }

  // ── PREIS-WAHRHEIT: aktueller Marktpreis am STANDORT DES SCHIFFS ──────────
  const { data: loc } = await serviceClient
    .from('locations')
    .select('id, slug')
    .eq('slug', ship.location)
    .single()

  if (!loc) {
    return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  }

  const { data: market } = await serviceClient
    .from('market_prices')
    .select('id, buy_price, sell_price')
    .eq('location_id', loc.id)
    .eq('resource', resource)
    .single()

  if (!market) {
    return NextResponse.json({ error: 'Kein Marktpreis für diese Ressource' }, { status: 404 })
  }

  const serverBuy  = market.buy_price
  const serverSell = market.sell_price

  // ── TRANSAKTIONSSTEUER: Satz der Kolonie (serverseitig, nie vom Client) ──
  const { data: settings } = await serviceClient
    .from('colony_settings')
    .select('tax_transaction')
    .eq('location_id', loc.id)
    .maybeSingle()
  const taxRate = Number(settings?.tax_transaction ?? 0)

  const { data: lastTick } = await serviceClient
    .from('tick_log')
    .select('tick_number')
    .order('tick_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const currentTick = Number(lastTick?.tick_number ?? 0)

  const { data: cargoRows } = await serviceClient
    .from('ship_cargo')
    .select('resource, amount')
    .eq('ship_id', ship.id)

  const cargoMap: Record<string, number> = { water: 0, energy: 0, metal: 0 }
  for (const c of cargoRows ?? []) cargoMap[c.resource] = c.amount

  const cargoUsed = Object.values(cargoMap).reduce((a, b) => a + b, 0)

  let newCredits = profile.credits
  let newCargoAmount = cargoMap[resource] ?? 0
  let profit = 0
  let booked = 0
  let unitPrice = 0
  let tax = 0

  if (action === 'buy') {
    // Auktionspreis: Client sendet ausgehandelten Preis. Server prüft Plausibilität
    // (clientPrice > 0 und ≤ serverBuy). Sonst Fallback auf serverBuy.
    unitPrice = (clientPrice > 0 && clientPrice <= serverBuy) ? clientPrice : serverBuy
    const perTon       = unitPrice * (1 + taxRate)
    const maxByCargo   = Math.max(0, ship.cargo_max - cargoUsed)
    const maxByCredits = perTon > 0 ? Math.floor(profile.credits / perTon) : amount
    booked = Math.min(amount, maxByCargo, maxByCredits)

    if (booked <= 0) {
      const reason = maxByCargo <= 0 ? 'Frachtraum voll' : 'Unzureichende Credits'
      return NextResponse.json({ error: reason }, { status: 400 })
    }

    const goods = unitPrice * booked
    tax = Math.round(taxRate * goods)
    newCredits -= (goods + tax)
    newCargoAmount += booked
    profit = -(goods + tax)
  } else {
    // Auktionspreis: Client sendet ausgehandelten Preis. Server prüft (≥ serverSell).
    unitPrice = (clientPrice > 0 && clientPrice >= serverSell) ? clientPrice : serverSell
    booked = Math.min(amount, newCargoAmount)

    if (booked <= 0) {
      return NextResponse.json({ error: 'Nicht genug Ware' }, { status: 400 })
    }

    const goods = unitPrice * booked
    tax = Math.round(taxRate * goods)
    newCredits += (goods - tax)
    newCargoAmount -= booked
    profit = goods - tax
  }

  await serviceClient
    .from('profiles')
    .update({ credits: newCredits })
    .eq('id', user.id)

  if (newCargoAmount > 0) {
    await serviceClient
      .from('ship_cargo')
      .upsert(
        { ship_id: ship.id, resource, amount: newCargoAmount },
        { onConflict: 'ship_id,resource' }
      )
  } else {
    await serviceClient
      .from('ship_cargo')
      .delete()
      .eq('ship_id', ship.id)
      .eq('resource', resource)
  }

  await serviceClient.from('trade_transactions').insert({
    profile_id: user.id,
    from_location: location,
    to_location: location,
    resource,
    amount: booked,
    profit,
  })

  if (tax > 0) {
    await serviceClient.from('colony_ledger').insert({
      location_id:   loc.id,
      tick:          currentTick,
      entry_type:    'tax_transaction',
      profile_id:    user.id,
      resource_type: resource,
      amount:        tax,
      note:          `Transaktionssteuer ${action} ${booked}t ${resource}`,
    })
  }

  // ── PREISIMPULS ───────────────────────────────────────────────────────────
  let priceUpdate: { resource: string; buyPrice: number; sellPrice: number } | null = null

  let newBuy  = serverBuy
  let newSell = serverSell
  if (action === 'buy') {
    newBuy = Math.min(PRICE_MAX, Math.round(serverBuy * (1 + PRICE_IMPULSE_PER_TON * booked)))
  } else {
    newSell = Math.max(PRICE_MIN, Math.round(serverSell * (1 - PRICE_IMPULSE_PER_TON * booked)))
  }
  if (newSell >= newBuy) newSell = newBuy - 1

  if (newBuy !== serverBuy || newSell !== serverSell) {
    await serviceClient
      .from('market_prices')
      .update({ buy_price: newBuy, sell_price: newSell })
      .eq('id', market.id)
    priceUpdate = { resource, buyPrice: newBuy, sellPrice: newSell }
  }

  const updatedCargoMap = { ...cargoMap, [resource]: newCargoAmount }

  return NextResponse.json({
    ok: true,
    bookedAmount: booked,
    requestedAmount: amount,
    unitPrice,
    taxCharged: tax,
    taxRate,
    priceUpdate,
    credits: newCredits,
    location: ship.location ?? 'moon',
    cargoMax: ship.cargo_max ?? 100,
    cargo: updatedCargoMap,
    shipId: ship.id,
    shipTypeId: ship.ship_type_id ?? 'freighter_mk1',
  })
}
