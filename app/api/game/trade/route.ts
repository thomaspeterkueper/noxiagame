// app/api/game/trade/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 01.09.2026 — persistente Schiff→Landing-Pad-Zuordnung bei Travel
// Version:      0.8.0
//
// v0.8.0 – Docking-Kapazität: Ziele mit operationalen Landing-Pads werden
//   serverseitig gegen konkrete ship_docking_assignments geprüft. Ziele ohne
//   verwaltete Pads bleiben im Legacy-Modus, damit bestehende Welten nicht
//   durch den Rollout blockiert werden.
// v0.5.4 – Pilot-Kompetenz: erfolgreiche Reisen zählen serverseitig auf
//   profiles.flight_count. Das Dashboard soll nur den fertigen Wert lesen.
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
// v0.3.0 – Ably: publishTransaction nach Kauf/Verkauf.

import { NextRequest, NextResponse } from 'next/server'
import { publishTransaction } from '@/lib/ably/server'
import { createClient } from '@supabase/supabase-js'
import { PRICE_MIN, PRICE_MAX, PRICE_IMPULSE_PER_TON } from '@/lib/game/config'
import { flightEnergyCost } from '@/lib/game/ships'
import { operationalDockingPads, selectFreeDockingPad } from '@/lib/game/dockingAssignments'

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

async function incrementFlightCount(profileId: string): Promise<number> {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('flight_count')
    .eq('id', profileId)
    .single()

  const next = Number(profile?.flight_count ?? 0) + 1

  await serviceClient
    .from('profiles')
    .update({ flight_count: next })
    .eq('id', profileId)

  return next
}

async function reserveDestinationPad(input: {
  shipId: string
  destinationLocationId: string
}): Promise<{ managed: boolean; padEntityId: string | null; error?: string }> {
  const { data: padRows, error: padError } = await serviceClient
    .from('tile_entities')
    .select('id, profile_id, entity_type, entity_id, parent_id, slot, status, condition')
    .eq('location_id', input.destinationLocationId)
    .eq('entity_type', 'building')
    .in('entity_id', ['landing_pad', 'landing_pad_extra_pad'])

  if (padError) return { managed: false, padEntityId: null, error: padError.message }

  const rows = (padRows ?? []) as any[]
  const basePads = rows
    .filter(row => row.entity_id === 'landing_pad')
    .map(row => ({ id: row.id, status: row.status, condition: row.condition }))

  const expansions = rows
    .filter(row => row.entity_id === 'landing_pad_extra_pad' && row.parent_id)
    .map(row => ({
      id: row.id,
      parentEntityId: row.parent_id,
      expansionId: row.entity_id,
      profileId: row.profile_id ?? null,
      status: row.status,
      slot: row.slot ?? null,
      condition: row.condition ?? null,
    }))

  const pads = operationalDockingPads({ basePads, expansions })

  // Backwards-compatible rollout boundary: a destination with no operational
  // managed pad remains legacy and must not suddenly become unreachable.
  if (pads.length === 0) return { managed: false, padEntityId: null }

  const { data: assignmentRows, error: assignmentError } = await serviceClient
    .from('ship_docking_assignments')
    .select('ship_id, location_id, pad_entity_id')
    .eq('location_id', input.destinationLocationId)

  if (assignmentError) return { managed: true, padEntityId: null, error: assignmentError.message }

  const assignments = (assignmentRows ?? []).map((row: any) => ({
    shipId: row.ship_id,
    locationId: row.location_id,
    padEntityId: row.pad_entity_id,
  }))

  // Try free candidates in deterministic order. The unique(pad_entity_id)
  // constraint arbitrates concurrent arrivals; on a race we try the next pad.
  const remaining = [...pads]
  while (remaining.length > 0) {
    const candidate = selectFreeDockingPad({
      pads: remaining,
      assignments,
      arrivingShipId: input.shipId,
    })
    if (!candidate) break

    const { error } = await serviceClient
      .from('ship_docking_assignments')
      .upsert({
        ship_id: input.shipId,
        location_id: input.destinationLocationId,
        pad_entity_id: candidate.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ship_id' })

    if (!error) return { managed: true, padEntityId: candidate.id }

    // Unique pad collision from a concurrent arrival: remove this candidate and
    // try another one. Other DB failures are surfaced instead of hiding them.
    if ((error as any).code !== '23505') {
      return { managed: true, padEntityId: null, error: error.message }
    }
    const idx = remaining.findIndex(pad => pad.id === candidate.id)
    if (idx >= 0) remaining.splice(idx, 1)
    assignments.push({ shipId: `race:${candidate.id}`, locationId: input.destinationLocationId, padEntityId: candidate.id })
  }

  return { managed: true, padEntityId: null }
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

    // Aktives Schiff — ship_types separat (kein FK-Join da Beziehung nicht im Cache)
    const { data: shipRows } = await serviceClient
      .from('ships')
      .select('id, location, cargo_max, ship_type_id, is_active')
      .eq('profile_id', user.id)
    const ship: any = (shipRows as any[])?.find((s: any) => s.is_active)
      ?? (shipRows as any[])?.[0]
      ?? null

    // ship_types separat laden
    const { data: shipType } = ship?.ship_type_id
      ? await serviceClient
          .from('ship_types')
          .select('speed_mult, range_distance')
          .eq('id', ship.ship_type_id)
          .single()
      : { data: null }

    console.log(`getTrades v0.5.4: user=${user.id} ship=${ship?.id} loc=${ship?.location} active=${ship?.is_active}`)

    const { data: cargo } = ship
      ? await serviceClient
          .from('ship_cargo')
          .select('resource, amount')
          .eq('ship_id', ship.id)
      : { data: [] }

    const cargoMap: Record<string, number> = { water: 0, energy: 0, metal: 0 }
    for (const c of cargo ?? []) cargoMap[c.resource] = c.amount

    const st: any = shipType

    return NextResponse.json({
      credits: profile?.credits ?? 5000,
      location: ship?.location ?? 'moon',
      cargoMax: ship?.cargo_max ?? 100,
      cargo: cargoMap,
      shipId: ship?.id,
      shipTypeId: ship?.ship_type_id ?? 'freighter_mk1',
      speedMult: Number(st?.speed_mult ?? 1.0),
      rangeDistance: Number(st?.range_distance ?? 28),
    })
  }

  const resource = searchParams.get('resource') as string
  const amount = parseInt(searchParams.get('amount') ?? '1', 10)
  const location = searchParams.get('location') as string
  const clientPrice = parseInt(searchParams.get('price') ?? '0', 10)

  // Travel — Energie aus Laderaum entnehmen (Treibstoff-Mechanik)
  if (action === 'travel') {
    const dest = resource

    const { data: shipRowsT } = await serviceClient
      .from('ships')
      .select('id, location, cargo_max, ship_type_id, is_active')
      .eq('profile_id', user.id)
    const travelShip: any = (shipRowsT as any[])?.find((s: any) => s.is_active)
      ?? (shipRowsT as any[])?.[0]
      ?? null

    if (!travelShip) return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })

    const fromLocation = travelShip.location
    const energyNeeded = flightEnergyCost(fromLocation, dest)

    const { data: energyCargo } = await serviceClient
      .from('ship_cargo')
      .select('amount')
      .eq('ship_id', travelShip.id)
      .eq('resource', 'energy')
      .maybeSingle()

    const energyOnBoard = Number(energyCargo?.amount ?? 0)

    console.log(`travel: ${fromLocation} → ${dest}, energyNeeded=${energyNeeded}, onBoard=${energyOnBoard}`)

    if (energyOnBoard < energyNeeded) {
      return NextResponse.json({
        error: `Nicht genug Energie. Benötigt: ${energyNeeded}t, an Bord: ${energyOnBoard}t`,
        energyNeeded,
        energyOnBoard,
        shipLocation: fromLocation,
      }, { status: 400 })
    }

    const { data: destLoc } = await serviceClient
      .from('locations')
      .select('id')
      .eq('slug', dest)
      .maybeSingle()

    if (!destLoc) {
      return NextResponse.json({ error: 'Zielort nicht gefunden' }, { status: 404 })
    }

    let landingFee = 0
    let payerCredits: number | null = null
    if (fromLocation !== dest) {
      const { data: destSettings } = await serviceClient
        .from('colony_settings')
        .select('tax_landing')
        .eq('location_id', destLoc.id)
        .maybeSingle()
      landingFee = Math.max(0, Math.round(Number(destSettings?.tax_landing ?? 0)))

      if (landingFee > 0) {
        const { data: payerProfile } = await serviceClient
          .from('profiles')
          .select('credits')
          .eq('id', user.id)
          .single()
        payerCredits = Number(payerProfile?.credits ?? 0)
        if (!payerProfile || payerCredits < landingFee) {
          return NextResponse.json({
            error: `Landegebühr ${landingFee} Cr — nicht genug Credits`,
            landingFee,
          }, { status: 400 })
        }
      }
    }

    // Capacity is checked and a concrete pad reserved before any fee/energy is
    // consumed. Legacy destinations without operational managed pads remain
    // reachable and release any stale old assignment after a successful move.
    let dockingManaged = false
    let dockingPadEntityId: string | null = null
    if (fromLocation !== dest) {
      const reservation = await reserveDestinationPad({
        shipId: travelShip.id,
        destinationLocationId: destLoc.id,
      })
      if (reservation.error) {
        return NextResponse.json({ error: `Docking konnte nicht geprüft werden: ${reservation.error}` }, { status: 503 })
      }
      dockingManaged = reservation.managed
      dockingPadEntityId = reservation.padEntityId
      if (dockingManaged && !dockingPadEntityId) {
        return NextResponse.json({
          error: 'Kein freier Landeplatz am Ziel verfügbar.',
          code: 'NO_LANDING_CAPACITY',
          destination: dest,
        }, { status: 409 })
      }
    }

    if (landingFee > 0 && payerCredits != null) {
      await serviceClient.from('profiles')
        .update({ credits: payerCredits - landingFee })
        .eq('id', user.id)

      const { data: destTick } = await serviceClient
        .from('tick_log')
        .select('tick_number')
        .order('tick_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      await serviceClient.from('colony_ledger').insert({
        location_id:   destLoc.id,
        tick:          Number(destTick?.tick_number ?? 0),
        entry_type:    'landing_fee',
        profile_id:    user.id,
        resource_type: null,
        amount:        landingFee,
        note:          `Landegebühr ${dest}`,
      })
    }

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

    await serviceClient
      .from('ships')
      .update({ location: dest })
      .eq('id', travelShip.id)

    if (fromLocation !== dest && !dockingManaged) {
      await serviceClient
        .from('ship_docking_assignments')
        .delete()
        .eq('ship_id', travelShip.id)
    }

    const flightCount = fromLocation !== dest
      ? await incrementFlightCount(user.id)
      : Number.NaN

    return NextResponse.json({
      ok: true,
      location: dest,
      energyUsed: energyNeeded,
      flightCount,
      landingFee,
      docking: {
        managed: dockingManaged,
        padEntityId: dockingPadEntityId,
      },
    })
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Ungültige Menge' }, { status: 400 })
  }

  if (action !== 'buy' && action !== 'sell') {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  }

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, credits, username')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  }

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

  publishTransaction({
    profileId: user.id,
    username: profile?.username,
    resource,
    amount:       booked,
    profit,
    fromLocation: action === 'buy' ? location : location,
    toLocation:   location,
  }).catch(() => {})

  await serviceClient.from('trade_transactions').insert({
    profile_id: user.id,
    from_location: location,
    to_location: location,
    resource,
    amount: booked,
    profit,
  })

  if (action === 'sell') {
    try {
      await serviceClient.rpc('upsert_location_reputation', {
        p_profile_id:  user.id,
        p_location_id: loc.id,
        p_deliveries:  1,
        p_volume:      booked,
      })
    } catch {
      // Ruf ist nicht geschäftskritisch — Fehler werden ignoriert
    }
  }

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