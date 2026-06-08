// app/api/game/trade/route.ts
// Erstellt:     30.05.2026
// Aktualisiert: 08.06.2026
// Version:      0.3.0
//
// v0.3.0 – Transaktionsbasierter Preisimpuls + Server-Preis (Arbitrage-Fix):
//   - PREIS-WAHRHEIT serverseitig: buy/sell rechnen NICHT mehr mit dem
//     Client-Param `price`, sondern lesen buy_price/sell_price aus
//     market_prices. Der Client-Param wird ignoriert (latenter Exploit
//     geschlossen: Client konnte vorher Kosten/Erlös frei setzen).
//   - PREISIMPULS pro gehandelter Tonne (PRICE_IMPULSE_PER_TON, linear):
//       buy  → buy_price  steigt  (× (1 + x·menge)), clamp PRICE_MAX
//       sell → sell_price sinkt   (× (1 − x·menge)), clamp PRICE_MIN
//     Die ganze Buchung läuft zum Preis VOR dem Impuls; danach repreist der
//     Markt für den nächsten Handel. So entwertet eine Route sich beim
//     Befahren → Intra-Tick-Arbitrage geschlossen.
//   - Antwort enthält priceUpdate { resource, buyPrice, sellPrice } → der
//     Client kann den bewegten Preis sofort zeigen (Erschöpfung live sichtbar).
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
import { PRICE_MIN, PRICE_MAX, PRICE_IMPULSE_PER_TON } from '@/lib/game/config'

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

  const { data: ship } = await serviceClient
    .from('ships')
    .select('id, location, cargo_max, ship_type_id')
    .eq('profile_id', user.id)
    .single()

  if (!ship) {
    return NextResponse.json({ error: 'Schiff nicht gefunden' }, { status: 404 })
  }

  // ── PREIS-WAHRHEIT: aktueller Marktpreis am STANDORT DES SCHIFFS ──────────
  // (nicht am Client-Param `location` und nicht am Client-Param `price`).
  // Der Handel findet dort statt, wo das Schiff liegt; alles andere wäre
  // manipulierbar. Wir brauchen den Preis ohnehin, um den Impuls anzuwenden.
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
  let booked = 0          // tatsächlich gebuchte Menge (Teilbuchung)
  let unitPrice = 0       // verwendeter Server-Preis (für die Antwort)

  if (action === 'buy') {
    // Preis-Wahrheit: Kaufpreis aus market_prices, nicht aus dem Client.
    unitPrice = serverBuy
    // ── TEILBUCHUNG: so viel wie Frachtraum UND Credits erlauben ────────────
    const maxByCargo   = Math.max(0, ship.cargo_max - cargoUsed)
    const maxByCredits = unitPrice > 0 ? Math.floor(profile.credits / unitPrice) : amount
    booked = Math.min(amount, maxByCargo, maxByCredits)

    if (booked <= 0) {
      const reason = maxByCargo <= 0 ? 'Frachtraum voll' : 'Unzureichende Credits'
      return NextResponse.json({ error: reason }, { status: 400 })
    }

    const totalCost = unitPrice * booked
    newCredits -= totalCost
    newCargoAmount += booked
    profit = -totalCost
  } else {
    // action === 'sell' – Preis-Wahrheit: Verkaufspreis aus market_prices.
    unitPrice = serverSell
    // ── TEILBUCHUNG: höchstens was an Bord ist ──────────────────────────────
    booked = Math.min(amount, newCargoAmount)

    if (booked <= 0) {
      return NextResponse.json({ error: 'Nicht genug Ware' }, { status: 400 })
    }

    newCredits += unitPrice * booked
    newCargoAmount -= booked
    profit = unitPrice * booked
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

  // ── PREISIMPULS ───────────────────────────────────────────────────────────
  // Erst nach der Buchung: die ganze Menge lief zum Preis VOR dem Impuls,
  // jetzt repreist der Markt für den NÄCHSTEN Handel.
  //   buy  → buy_price  rauf,  sell  → sell_price runter,  linear in `booked`.
  // Gerichtet ⇒ die Spanne wächst, sell < buy bleibt erhalten; die defensive
  // Klemme greift nur bei (eigentlich unmöglichen) Alt-Daten mit sell ≥ buy.
  let priceUpdate: { resource: string; buyPrice: number; sellPrice: number } | null = null

  let newBuy  = serverBuy
  let newSell = serverSell
  if (action === 'buy') {
    newBuy = Math.min(PRICE_MAX, Math.round(serverBuy * (1 + PRICE_IMPULSE_PER_TON * booked)))
  } else {
    newSell = Math.max(PRICE_MIN, Math.round(serverSell * (1 - PRICE_IMPULSE_PER_TON * booked)))
  }
  if (newSell >= newBuy) newSell = newBuy - 1   // Constraint sell_below_buy schützen

  if (newBuy !== serverBuy || newSell !== serverSell) {
    await serviceClient
      .from('market_prices')
      .update({ buy_price: newBuy, sell_price: newSell })
      .eq('id', market.id)
    priceUpdate = { resource, buyPrice: newBuy, sellPrice: newSell }
  }

  const updatedCargoMap = { ...cargoMap, [resource]: newCargoAmount }

  return NextResponse.json({
    ok: true,                      // ← explizit, der Store prüft data.ok
    bookedAmount: booked,          // ← tatsächlich gebucht
    requestedAmount: amount,       // ← gewünscht (für "7 von 10"-Anzeige)
    unitPrice,                     // ← Server-Preis, zu dem gebucht wurde
    priceUpdate,                   // ← bewegter Preis nach dem Impuls (oder null)
    credits: newCredits,
    location: ship.location ?? 'moon',
    cargoMax: ship.cargo_max ?? 100,
    cargo: updatedCargoMap,
    shipId: ship.id,
    shipTypeId: ship.ship_type_id ?? 'freighter_mk1',
  })
}
