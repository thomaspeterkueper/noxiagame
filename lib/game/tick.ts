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
  ORDER_COVERAGE_TICKS,
} from './config'
import { BUILDING_SALE } from './buildingSale'
import { entscheideNpc } from './npcBrain'

// Produktion je Gebäudetyp (für die Einkommens-Ausschüttung, Punkt 3)
const PRODUCES: Record<string, { resource: 'metal' | 'energy' | 'water'; amount: number }> = {
  mine:           { resource: 'metal',  amount: 5 },
  solar:          { resource: 'energy', amount: 4 },
  ice_drill:      { resource: 'water',  amount: 4 },
  water_recycler: { resource: 'water',  amount: 2 },
}

// HINWEIS: Temporär auf 1 Woche gesetzt, um die Welt fürs Balancing-Testen
// einzufrieren (kein Tick bei jedem Dashboard-Load). VOR echtem Spielbetrieb
// zurück auf 3600 (1 Stunde) stellen!
export const TICK_INTERVAL_SECONDS = 3600    // 1 Stunde pro Tick
export const TICK_MAX_CATCHUP      = 48      // höchstens 48 Ticks (2 Tage) nachrechnen

// Fenster für den gleitenden Bewertungs-Schnitt (Punkt 4)
const AVG_WINDOW_TICKS = 7
// Retention: price_history-Rohdaten älter als dieses Fenster werden gelöscht.
// Großzügiger als AVG_WINDOW (Puffer für Charts/Archiv), aber gedeckelt,
// damit die Tabelle nicht unbegrenzt wächst (Skalierung bei vielen Orten).
const HISTORY_RETENTION_TICKS = 336   // ~14 Tage bei stündlichen Ticks

type SB = any  // Supabase Service-Client

// ─────────────────────────────────────────────────────────────────────
// 1) POPULATION – Verbrauch, Produktion (frisch aus Basis + tile_entities),
//    Bevölkerung, Kapazität, Überbelegung
// ─────────────────────────────────────────────────────────────────────
export async function runPopulationTick(supabase: SB, tickNumber: number) {
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
      .select('id, entity_id, profile_id')
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
      const mineBonus        = res === 'metal'  ? (counts['mine']           ?? 0) * 5 : 0
      const solarBonus       = res === 'energy' ? (counts['solar']          ?? 0) * 4 : 0
      const iceDrillBonus    = res === 'water'  ? (counts['ice_drill']      ?? 0) * 4 : 0
      const recyclerBonus    = res === 'water'  ? (counts['water_recycler'] ?? 0) * 2 : 0
      const totalProd  = (r.base_production ?? r.production) + mineBonus + solarBonus + iceDrillBonus + recyclerBonus
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

    // ─────────────────────────────────────────────────────────────────
    // EINKOMMENS-AUSSCHÜTTUNG (Punkt 3, schlank):
    // Die Kolonie kauft Produktion NUR bei Mangel und zahlt den lokalen
    // sell_price; Habitate zahlen Miete pro belegtem Platz. Abzüglich
    // Transaktionssteuer der Kolonie. Geld fließt aus dem colony_ledger
    // (geschlossener Kreislauf, kein Gelddruck). Überschuss-Produktion
    // bleibt vorerst ohne Ausschüttung (Eigentümer-Lager = späteres Feature).
    // ─────────────────────────────────────────────────────────────────
    if ((buildings ?? []).length > 0) {
      // Steuersatz der Kolonie (wie in trade/route.ts)
      const { data: settings } = await supabase
        .from('colony_settings')
        .select('tax_transaction')
        .eq('location_id', loc.id)
        .maybeSingle()
      const taxRate = Number(settings?.tax_transaction ?? 0)

      // Marktpreise (sell) der Kolonie einmal laden
      const { data: priceRows } = await supabase
        .from('market_prices')
        .select('resource, sell_price')
        .eq('location_id', loc.id)
      const sellPrice: Record<string, number> = {}
      for (const p of priceRows ?? []) sellPrice[p.resource] = p.sell_price

      // belegte Habitat-Plätze (Auslastung × 100, gedeckelt)
      const auslastung = popMax > 0 ? Math.min(1, Math.max(0, newPop / popMax)) : 0

      for (const b of buildings ?? []) {
        let gross = 0   // Brutto-Ausschüttung vor Steuer

        if (b.entity_id === 'habitat') {
          // Miete: belegte Plätze × Mietwert
          const belegt = Math.round(100 * auslastung)
          gross = belegt * BUILDING_SALE.MIETWERT_PRO_PLATZ
        } else if (PRODUCES[b.entity_id]) {
          // Mine/Solar: Kolonie kauft nur bei MANGEL der Ressource
          const { resource, amount } = PRODUCES[b.entity_id]
          const r = resMap[resource]
          if (r) {
            const balance = (r.production ?? 0) - (r.consumption ?? 0)
            const mangel  = (stock[resource] ?? 0) < STOCK_LOW_THRESHOLD
                          || (balance < 0 && (stock[resource] ?? 0) < 150)
            if (mangel) gross = amount * (sellPrice[resource] ?? 0)
          }
        }

        if (gross <= 0) continue

        const tax    = Math.round(taxRate * gross)
        const payout = gross - tax

        // Eigentümer gutschreiben
        const { data: prof } = await supabase
          .from('profiles').select('credits').eq('id', b.profile_id).single()
        if (prof) {
          await supabase.from('profiles')
            .update({ credits: prof.credits + payout })
            .eq('id', b.profile_id)
        }

        // Kolonie zahlt (negativer Eintrag) + Steuer (positiv) ins Ledger
        await supabase.from('colony_ledger').insert([
          {
            location_id: loc.id, tick: tickNumber, entry_type: 'building_payout',
            profile_id: b.profile_id, resource_type: null, amount: -payout,
            note: `Ausschüttung ${b.entity_id}`,
          },
          ...(tax > 0 ? [{
            location_id: loc.id, tick: tickNumber, entry_type: 'tax_payout',
            profile_id: b.profile_id, resource_type: null, amount: tax,
            note: `Steuer auf Ausschüttung ${b.entity_id}`,
          }] : []),
        ])
      }
    }

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

    // ── Punkt 4: gleitenden Schnitt fortschreiben (für getSaleQuote) ──────────
    // Letzte AVG_WINDOW_TICKS sell_price-Werte mitteln (inkl. des gerade
    // geschriebenen). avg_sell_7 wird an market_prices gepflegt → die Bewertung
    // liest O(1) einen vorberechneten Wert statt die History-Tabelle zu scannen.
    const { data: recent } = await supabase
      .from('price_history')
      .select('sell_price')
      .eq('location_id', loc.id)
      .eq('resource', price.resource)
      .order('tick_number', { ascending: false })
      .limit(AVG_WINDOW_TICKS)

    if (recent && recent.length > 0) {
      const avg = Math.round(
        recent.reduce((s: number, r: any) => s + r.sell_price, 0) / recent.length
      )
      await supabase.from('market_prices')
        .update({ avg_sell_7: avg })
        .eq('id', price.id)
    }

    results.push({ location: loc.slug, resource: price.resource, buy: newBuy, sell: safeSell })
  }

  // ── Retention: Rohdaten älter als das Fenster löschen (Skalierung) ──────────
  // avg_sell_7 ist bereits an market_prices gesichert; ältere price_history-
  // Zeilen werden nur noch für Charts/Archiv gebraucht und hier gedeckelt.
  const cutoff = tickNumber - HISTORY_RETENTION_TICKS
  if (cutoff > 0) {
    await supabase.from('price_history').delete().lt('tick_number', cutoff)
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

      // Punkt 5: Größe = tatsächliches Defizit × Deckungsfenster (kein Zufall).
      // balance ist hier negativ (Defizit), sonst wäre der Auftrag nicht ausgelöst.
      // Untergrenze ORDER_MIN_AMOUNT, damit kleine Defizite die Fahrt lohnen.
      // Kein Deckel nach oben — große Kolonien fordern große Lieferungen.
      const deficitPerTick = Math.max(0, -balance)
      const amount = Math.max(
        ORDER_MIN_AMOUNT,
        Math.round(deficitPerTick * ORDER_COVERAGE_TICKS)
      )
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
// ── NPC-Tick (Phase B v1) ─────────────────────────────────────────────────────
// Deterministischer Marktteilnehmer. Lädt NPC-Firmen + decision_weights, baut die
// Welt (Marktpreise + Stock), ruft den REINEN Brain (entscheideNpc) und verbucht
// die Käufe ins append-only npc_trades-Ledger. Bestand = Summe des Ledgers
// (Weltzustand = Summe des Event-Logs). Idempotent: ein Kauf je (actor, tick,
// resource) → ein doppelt laufender Tick ist ein No-op.
//
// Variante B: Nachfrage ist KAUSAL. Ein Kauf entnimmt dem Ort denselben Term wie
// Verbrauch (location_resources.stock -= menge); der Preis-Tick reagiert im
// SELBEN Tick, weil runNpcTick vor runPriceTick läuft. Die Stock-Senkung hängt
// am echten Insert (.select() liefert bei Re-Run leer) → idempotent. Der Brain
// deckelt menge bereits an markt.stock → Stock bleibt ≥ 0.
export async function runNpcTick(supabase: SB, tickNumber: number) {
  const { data: actors } = await supabase
    .from('actors')
    .select('id, decision_weights')
    .eq('kind', 'npc_firm')
  if (!actors?.length) return { actors: 0, trades: 0 }

  // Marktpreise (buy_price je Gut/Ort) + Stock → NpcWelt.
  const { data: priceRows } = await supabase
    .from('market_prices')
    .select('resource, buy_price, sell_price, location_id, locations(slug)')
  const { data: stockRows } = await supabase
    .from('location_resources')
    .select('location_id, resource, stock')

  const stockMap = new Map<string, number>()
  for (const s of (stockRows ?? []) as any[]) stockMap.set(`${s.location_id}|${s.resource}`, Number(s.stock ?? 0))

  const slugToId = new Map<string, string>()
  const preise = ((priceRows ?? []) as any[]).map((p) => {
    const slug = p.locations?.slug
    if (slug) slugToId.set(slug, p.location_id)
    return {
      resource:   p.resource,
      location:   slug,
      buy_price:  p.buy_price,
      sell_price: p.sell_price,
      stock:      stockMap.get(`${p.location_id}|${p.resource}`),
    }
  }).filter((p) => p.location)

  let trades = 0
  for (const actor of actors as any[]) {
    // Bestand frisch aus dem Ledger summieren — keine veränderliche Lagerspalte.
    const { data: led } = await supabase
      .from('npc_trades')
      .select('resource, amount')
      .eq('actor_id', actor.id)
    const bestand: Record<string, number> = {}
    for (const r of (led ?? []) as any[]) bestand[r.resource] = (bestand[r.resource] ?? 0) + Number(r.amount)

    // Stock je Markt aus der laufenden Karte auffrischen — so sieht ein zweiter
    // Akteur, was ein erster im selben Tick schon entnommen hat (Mehr-NPC-fest).
    for (const p of preise) p.stock = stockMap.get(`${slugToId.get(p.location)}|${p.resource}`)

    const aktionen = entscheideNpc(
      { actor: { id: actor.id, decision_weights: actor.decision_weights }, bestand },
      { tick: tickNumber, preise },
    )

    for (const a of aktionen) {
      if (a.typ !== 'buy') continue
      const locId = slugToId.get(a.location)
      if (!locId) continue

      // Idempotenter Kauf ins Ledger. .select() liefert die Zeile NUR bei echtem
      // Insert (bei Konflikt/Re-Run: leer) — daran hängt die Stock-Senkung.
      const { data: eingefuegt } = await supabase.from('npc_trades').upsert(
        {
          actor_id:    actor.id,
          tick:        tickNumber,
          resource:    a.resource,
          amount:      a.menge,
          unit_price:  a.maxPreis,
          location_id: locId,
        },
        { onConflict: 'actor_id,tick,resource', ignoreDuplicates: true },
      ).select('id')

      if (!eingefuegt?.length) continue   // Konflikt → Tick lief schon → No-op

      // Variante B: Nachfrage senkt den Stock (kausal). Menge ist im Brain durch
      // markt.stock gedeckelt → Stock ≥ 0. stockMap mitführen, damit weitere
      // Akteure im selben Tick den entnommenen Bestand sehen.
      const key = `${locId}|${a.resource}`
      const neuerStock = Math.max(0, (stockMap.get(key) ?? 0) - a.menge)
      await supabase.from('location_resources')
        .update({ stock: neuerStock })
        .eq('location_id', locId)
        .eq('resource', a.resource)
      stockMap.set(key, neuerStock)
      trades++
    }
  }
  return { actors: actors.length, trades }
}

export async function runTick(supabase: SB, tickNumber: number) {
  const population = await runPopulationTick(supabase, tickNumber)
  const npc        = await runNpcTick(supabase, tickNumber)    // Nachfrage VOR den Preisen: senkt Stock
  const prices     = await runPriceTick(supabase, tickNumber)  // reagiert auf den gesenkten Stock (gleicher Tick)
  const orders     = await runOrderTick(supabase)
  return { tickNumber, population, prices, npc, orders }
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
