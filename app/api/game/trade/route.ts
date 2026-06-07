// app/api/game/trade/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 07.06.2026
// Version:      0.2.0
//
// v0.2.0 – Cargo-Loop-Atomicity (Multiplayer-Voraussetzung Nr. 2):
//   - buy/sell buchen die VOLLE Menge in einem Call (kein 1t-Loop mehr nötig)
//   - TEILBUCHUNG: Reicht es nicht für die ganze Menge, wird gebucht was geht:
//       buy:  booked = min(amount, frachtraumFrei, floor(credits/price))
//       sell: booked = min(amount, anBord)
//     Antwort enthält bookedAmount + requestedAmount, der Client zeigt
//     "7 von 10 gebucht" an. booked <= 0 → Fehler wie bisher.
//   - Antwort enthält jetzt explizit ok: true (der Store prüft data.ok;
//     vorher fehlte das Feld bei buy/sell → uneindeutiges Verhalten)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const { data: ship } = await serviceClient
      .from('ships')
      .select('id, location, cargo_max, ship_type_id')
      .eq('profile_id', user.id)
      .single()

    const { data: cargo } = ship
      ? await serviceClient
          .from('ship_cargo')
          .select('resource, amount')
          .eq('ship_id', ship.id)
      : { data: [] }

    const cargoMap: Record<string, number> = { water: 0, energy: 0, metal: 0 }
    for (const c of cargo ?? []) cargoMap[c.resource] = c.amount

    return NextResponse.json({
      credits: profile?.credits ?? 5000,
      location: ship?.location ?? 'moon',
      cargoMax: ship?.cargo_max ?? 100,
      cargo: cargoMap,
      shipId: ship?.id,
      shipTypeId: ship?.ship_type_id ?? 'freighter_mk1',
    })
  }

  const resource = searchParams.get('resource') as string
  const amount = parseInt(searchParams.get('amount') ?? '1', 10)
  const price = parseInt(searchParams.get('price') ?? '0', 10)
  const location = searchParams.get('location') as string

  // Travel braucht keine Menge/Preis – VOR der Mengen-Validierung behandeln.
  // (Der Store sendet amount=0; die Validierung unten würde das ablehnen.)
  if (action === 'travel') {
    await serviceClient
      .from('ships')
      .update({ location: resource })
      .eq('profile_id', user.id)

    return NextResponse.json({ ok: true, location: resource })
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Ungültige Menge' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Ungültiger Preis' }, { status: 400 })
  }

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, credits')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 404 })
  }

  const { data: ship } = await serviceClient
    .from('ships')
    .select('id, location, cargo_max, ship_type_id')
    .eq('profile_id', user.id)
    .single()

  if (!ship) {
    return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })
  }

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
  let booked = 0   // tatsächlich gebuchte Menge (Teilbuchung)

  if (action === 'buy') {
    // ── TEILBUCHUNG: so viel wie Frachtraum UND Credits erlauben ────────────
    const maxByCargo   = Math.max(0, ship.cargo_max - cargoUsed)
    const maxByCredits = price > 0 ? Math.floor(profile.credits / price) : amount
    booked = Math.min(amount, maxByCargo, maxByCredits)

    if (booked <= 0) {
      const reason = maxByCargo <= 0 ? 'Frachtraum voll' : 'Unzureichende Credits'
      return NextResponse.json({ error: reason }, { status: 400 })
    }

    const totalCost = price * booked
    newCredits -= totalCost
    newCargoAmount += booked
    profit = -totalCost
  } else if (action === 'sell') {
    // ── TEILBUCHUNG: höchstens was an Bord ist ──────────────────────────────
    booked = Math.min(amount, newCargoAmount)

    if (booked <= 0) {
      return NextResponse.json({ error: 'Nicht genug Ware' }, { status: 400 })
    }

    newCredits += price * booked
    newCargoAmount -= booked
    profit = price * booked
  } else {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
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

  // EINE Transaktionszeile für die ganze Buchung (statt N × 1t)
  await serviceClient.from('trade_transactions').insert({
    profile_id: user.id,
    from_location: location,
    to_location: location,
    resource,
    amount: booked,
    profit,
  })

  const updatedCargoMap = { ...cargoMap, [resource]: newCargoAmount }

  return NextResponse.json({
    ok: true,                      // ← explizit, der Store prüft data.ok
    bookedAmount: booked,          // ← tatsächlich gebucht
    requestedAmount: amount,       // ← gewünscht (für "7 von 10"-Anzeige)
    credits: newCredits,
    location: ship.location ?? 'moon',
    cargoMax: ship.cargo_max ?? 100,
    cargo: updatedCargoMap,
    shipId: ship.id,
    shipTypeId: ship.ship_type_id ?? 'freighter_mk1',
  })
}
