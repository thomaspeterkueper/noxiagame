// lib/game/tick.ts
// Herz der Lazy-Tick-Engine (SPEC_balancing_0-1-5, Punkt 0+1).
//
// Ein "Tick" = ein vollständiger Simulationsschritt in fester Reihenfolge:
//   1. Population  (setzt consumption/production/stock, Bevölkerung, Kapazität)
//   2. Prices      (liest stock/balance → passt Marktpreise an, schreibt price_history)
//   3. Orders      (liest stock/balance → generiert/expired Aufträge)
// Die Reihenfolge ist zwingend: Prices/Orders lesen, was Population schreibt.
//
// runTick(supabase, tickNumber)  – führt EINEN vollständigen Tick aus
// runDueTicks(supabase)          – holt via claim_due_ticks() fällige Ticks nach
//
// Wird aufgerufen von: den Crons (Fallback) und der world-Route (Herzschlag).

import {
  CONSUMPTION_PER_100,
  GROWTH_RATE,
  DECLINE_RATE,
  PRICE_PRESSURE_HIGH,
  PRICE_PRESSURE_LOW,
  STOCK_LOW_THRESHOLD,
  STOCK_HIGH_THRESHOLD,
  PRICE_MIN,
  PRICE_MAX,
  ORDER_MIN_AMOUNT,
  ORDER_MAX_AMOUNT,
  ORDER_REWARD_MULT,
  ORDER_EXPIRE_HOURS,
} from './config'

export const TICK_INTERVAL_SECONDS = 3600   // 1 Stunde
export const TICK_MAX_CATCHUP      = 48      // höchstens 48 Ticks (2 Tage) nachrechnen

type SB = any  // Supabase Service-Client

// ─────────────────────────────────────────────────────────────────────
// 1) POPULATION – Verbrauch, Produktion (frisch aus Basis + tile_entities),
//    Bevölkerung, Kapazität, Überbelegung
// ─────────────────────────────────────────────────────────────────────
export async function runPopulationTick(supabase: SB) {
  const results: Record<string, unknown>[] = []
  const { data: locations } = await supabase.from('locations').select('*')

  for (const loc of locations ?? []) {
    const { data: resources } = await supabase
      .from('location_resources')
      .select('*')
      .eq('location_id', loc.id)

    const stock: Record<string, number> = {}
    const resMap: Record<string, any> = {}
    for (const r of resources ?? []) { stock[r.resource] = r.stock; resMap[r.resource] = r }

    const { data: buildings } = await supabase
      .from('tile_entities')
      .select('entity_id')
      .eq('location_id', loc.id)
      .eq('entity_type', 'building')

    const counts: Record<string, number> = {}
    for (const b of buildings ?? []) counts[b.entity_id] = (counts[b.entity_id] ?? 0) + 1

    const pop = loc.population
    const popMax = (loc.base_population_max ?? loc.population_max) + (counts['habitat'] ?? 0) * 100

    const consumed = {
      water:  Math.ceil((pop / 100) * CONSUMPTION_PER_100.water),
      energy: Math.ceil((pop / 100) * CONSUMPTION_PER_100.energy),
      metal:  Math.ceil((pop / 100) * CONSUMPTION_PER_100.metal),
    }

    const isSupplied =
      (stock['water']  ?? 0) >= consumed.water &&
      (stock['energy'] ?? 0) >= consumed.energy &&
      (stock['metal']  ?? 0) >= consumed.metal

    for (const res of ['water', 'energy', 'metal'] as const) {
      const r = resMap[res]; if (!r) continue
      const mineBonus  = res === 'metal'  ? (counts['mine']  ?? 0) * 5 : 0
      const solarBonus = res === 'energy' ? (counts['solar'] ?? 0) * 4 : 0
      const totalProd  = (r.base_production ?? r.production) + mineBonus + solarBonus
      const newStock   = Math.max(0, r.stock + totalProd - consumed[res])

      await supabase.from('location_resources')
        .update({ stock: newStock, production: totalProd, consumption: consumed[res] })
        .eq('id', r.id)
      stock[res] = newStock
    }

    let newPop: number, overcrowded = false
    if (pop > popMax) {
      overcrowded = true
      newPop = Math.max(popMax, pop - Math.ceil(pop * DECLINE_RATE))
    } else {
      const rate = isSupplied ? GROWTH_RATE : -DECLINE_RATE
      newPop = Math.round(Math.max(0, Math.min(popMax, pop * (1 + rate))))
    }

    await supabase.from('locations')
      .update({ population: newPop, population_max: popMax, is_supplied: isSupplied })
      .eq('id', loc.id)

    // Event-Stream: Wachstum / beginnende Not (Rohdaten für Kennzahlen)
    if (!isSupplied && newPop < pop) {
      await supabase.from('events').insert({
        location_id: loc.id, type: 'starvation',
        payload: { lost: pop - newPop, resource_gap: consumed, stock },
      })
    }

    results.push({ location: loc.slug, population: { before: pop, after: newPop, max: popMax }, isSupplied, overcrowded })
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────
// 2) PRICES – Lager-/Bilanz-/Versorgungsdruck, schreibt price_history
// ─────────────────────────────────────────────────────────────────────
export async function runPriceTick(supabase: SB, tickNumber: number) {
  const results: Record<string, unknown>[] = []
  const { data: prices } = await supabase
    .from('market_prices')
    .select('*, locations(id, slug, population, population_max, is_supplied)')

  for (const price of prices ?? []) {
    const loc = price.locations
    if (!loc) continue

    const { data: res } = await supabase
      .from('location_resources')
      .select('stock, consumption, production')
      .eq('location_id', loc.id)
      .eq('resource', price.resource)
      .single()
    if (!res) continue

    const stock = res.stock ?? 0
    const balance = (res.production ?? 0) - (res.consumption ?? 0)

    let multiplier = 1.0
    if (stock < STOCK_LOW_THRESHOLD)      multiplier = PRICE_PRESSURE_HIGH
    else if (stock > STOCK_HIGH_THRESHOLD) multiplier = PRICE_PRESSURE_LOW

    if (balance < -5 && stock < 200)       multiplier = Math.max(multiplier, 1.03)
    else if (balance > 5 && stock > 300)   multiplier = Math.min(multiplier, 0.98)

    if (!loc.is_supplied && price.resource === 'water') multiplier = Math.max(multiplier, 1.08)

    const popPct = loc.population / loc.population_max
    if (popPct > 0.7 && price.resource === 'water') multiplier = Math.max(multiplier, 1.02)

    if (multiplier === 1.0) {
      if (price.buy_price > 200)     multiplier = 0.99
      else if (price.buy_price < 30) multiplier = 1.01
    }

    const newBuy  = Math.round(Math.max(PRICE_MIN, Math.min(PRICE_MAX, price.buy_price * multiplier)))
    const newSell = Math.round(Math.max(PRICE_MIN, Math.min(PRICE_MAX - 1, price.sell_price * multiplier)))
    const safeSell = Math.min(newSell, newBuy - 5)

    if (!(newBuy === price.buy_price && safeSell === price.sell_price)) {
      await supabase.from('market_prices')
        .update({ buy_price: newBuy, sell_price: safeSell })
        .eq('id', price.id)
    }

    // Preisverlauf schreiben (immer, auch unverändert → lückenlose Ø-Basis)
    await supabase.from('price_history').insert({
      location_id: loc.id, resource: price.resource, tick_number: tickNumber,
      buy_price: newBuy, sell_price: safeSell,
    })

    results.push({ location: loc.slug, resource: price.resource, buy: newBuy, sell: safeSell })
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────
// 3) ORDERS – abgelaufene schließen, neue bei Knappheit generieren
// ─────────────────────────────────────────────────────────────────────
export async function runOrderTick(supabase: SB) {
  const created: Record<string, unknown>[] = []

  await supabase.from('trade_orders')
    .update({ status: 'expired' })
    .eq('status', 'open')
    .lt('expires_at', new Date().toISOString())

  const { data: locations } = await supabase
    .from('locations').select('id, slug, population, is_supplied')

  for (const loc of locations ?? []) {
    const { data: resources } = await supabase
      .from('location_resources')
      .select('resource, stock, consumption, production')
      .eq('location_id', loc.id)

    for (const res of resources ?? []) {
      const balance = res.production - res.consumption
      const isUrgent  = res.stock < STOCK_LOW_THRESHOLD
      const isSinking = balance < 0 && res.stock < 150
      if (!isUrgent && !isSinking) continue

      const { data: existing } = await supabase
        .from('trade_orders')
        .select('id')
        .eq('location_id', loc.id)
        .eq('resource', res.resource)
        .eq('status', 'open')
        .limit(1)
      if (existing && existing.length > 0) continue

      const { data: price } = await supabase
        .from('market_prices')
        .select('buy_price')
        .eq('location_id', loc.id)
        .eq('resource', res.resource)
        .single()
      if (!price) continue

      const amount = Math.floor(ORDER_MIN_AMOUNT + Math.random() * (ORDER_MAX_AMOUNT - ORDER_MIN_AMOUNT))
      const rewardMult = isUrgent ? ORDER_REWARD_MULT * 1.3 : ORDER_REWARD_MULT
      const reward = Math.round(price.buy_price * amount * rewardMult)
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + ORDER_EXPIRE_HOURS)

      await supabase.from('trade_orders').insert({
        location_id: loc.id, resource: res.resource, amount, reward,
        status: 'open', expires_at: expiresAt.toISOString(),
        // for_profile_id bleibt NULL → öffentlicher Auftrag
      })
      created.push({ location: loc.slug, resource: res.resource, amount, reward, urgent: isUrgent })
    }
  }

  return created
}

// ─────────────────────────────────────────────────────────────────────
// Ein vollständiger Tick (feste Reihenfolge!)
// ─────────────────────────────────────────────────────────────────────
export async function runTick(supabase: SB, tickNumber: number) {
  const population = await runPopulationTick(supabase)
  const prices     = await runPriceTick(supabase, tickNumber)
  const orders     = await runOrderTick(supabase)
  return { tickNumber, population, prices, orders }
}

// ─────────────────────────────────────────────────────────────────────
// Lazy-Evaluation: fällige Ticks atomar beanspruchen und nachrechnen.
// claim_due_ticks() serialisiert via Advisory Lock; nur der Gewinner
// führt die beanspruchten Ticks sequenziell aus.
// ─────────────────────────────────────────────────────────────────────
export async function runDueTicks(supabase: SB) {
  const { data, error } = await supabase.rpc('claim_due_ticks', {
    p_interval_seconds: TICK_INTERVAL_SECONDS,
    p_max: TICK_MAX_CATCHUP,
  })
  if (error) { console.error('claim_due_ticks error:', error); return { ran: 0 } }

  const row = Array.isArray(data) ? data[0] : data
  const claimed = row?.claimed ?? 0
  const latest  = Number(row?.latest_tick ?? 0)
  if (claimed < 1) return { ran: 0 }

  // Tick-Nummern: latest-claimed+1 .. latest, sequenziell ausführen
  for (let n = latest - claimed + 1; n <= latest; n++) {
    await runTick(supabase, n)
  }
  return { ran: claimed, latest }
}
