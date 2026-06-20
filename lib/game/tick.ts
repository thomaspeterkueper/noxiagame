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
  // simulate_tick = false → passiver Ort (Erde, Prometheus): kein Bevölkerungs-
  // oder Verbrauchs-Tick. Marktpreise laufen separat (runPriceTick filtert nicht).
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('simulate_tick', true)

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

  // Nur simulierte Kolonien erhalten Aufträge — Erde/Prometheus nicht.
  const { data: locations } = await supabase
    .from('locations')
    .select('id, slug, population, is_supplied')
    .eq('simulate_tick', true)

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
// ── NPC-Tick (Phase C) ───────────────────────────────────────────────────────
//
// Aktionsreihenfolge: produce → sell → build → buy
//
// produce:  Gebäude-Output wird in den Marktstock eingespeist UND im
//           npc_ledger verbucht (goods_delta + credit_delta = Erlös).
//           Immer, unabhängig vom Preis. Idempotent über uniq_npc_ledger_event.
//
// sell:     Überschuss über reserve wird verkauft, wenn sell_price ≥ sell_floor.
//           Erhöht den Marktstock (günstiger als bei Spielerlieferung — NPCs
//           stören keine Aufträge, sie ergänzen den Hintergrundmarkt).
//           Idempotent über uniq_npc_ledger_event (kind='sell', resource, tick).
//
// build:    Wenn Treasury ≥ treasury_min: Insert in tile_entities.
//           Kein Bauzeit-Tick (NPCs bauen sofort). Kosten ins Ledger.
//           Idempotent über uniq_npc_ledger_event (kind='build', ref=location).
//           Hier kein Tile-Conflict-Check — NPCs landen auf Eck-Kacheln, die
//           der Seed-Reset schon reserviert hat. Kollisionen löst notfalls das
//           DB-Unique-Constraint (tile_entities hat keinen NPC-Guard).
//
// buy:      Phase B v1-Logik unverändert (schreibt weiter in npc_trades).
//           npc_trades bleibt das Kaufledger; npc_ledger ist das Produktions-/
//           Verkaufs-/Bau-Ledger. Beide summiert = Gesamtbestand.
//
// Bestandsberechnung: Σ npc_trades.amount (Käufe) + Σ npc_ledger.goods_delta
// (Produktion − Verkäufe) = echter Netto-Bestand. Das erlaubt, die bestehende
// npc_trades-Tabelle unangetastet zu lassen und trotzdem den vollen Bestand
// zu kennen.
//
// ACHTUNG: produce MUSS vor sell laufen, damit der produce-Ledger-Eintrag
// beim Bestandssummieren in sell schon zählt. Die Summe passiert einmal pro
// Akteur (oben), DANACH werden Aktionen abgearbeitet — der Brain sieht den
// Stand von BEGINN des Ticks (kein Mid-Tick-Drift). Das ist deterministisch.
export async function runNpcTick(supabase: SB, tickNumber: number) {
  const { data: actors } = await supabase
    .from('actors')
    .select('id, decision_weights')
    .eq('kind', 'npc_firm')
  if (!actors?.length) return { actors: 0, trades: 0, produces: 0, sells: 0, builds: 0 }

  // ── Marktpreise + Stock einmal für alle Akteure laden ────────────────────
  const { data: priceRows } = await supabase
    .from('market_prices')
    .select('resource, buy_price, sell_price, location_id, locations(slug)')
  const { data: stockRows } = await supabase
    .from('location_resources')
    .select('location_id, resource, stock')

  const stockMap = new Map<string, number>()
  for (const s of (stockRows ?? []) as any[]) {
    stockMap.set(`${s.location_id}|${s.resource}`, Number(s.stock ?? 0))
  }
  // sell_price je Ort/Gut (für Erlösberechnung bei produce/sell)
  const sellPriceMap = new Map<string, number>()
  const slugToId     = new Map<string, string>()

  const preise = ((priceRows ?? []) as any[]).map((p) => {
    const slug = p.locations?.slug
    if (slug) {
      slugToId.set(slug, p.location_id)
      sellPriceMap.set(`${p.location_id}|${p.resource}`, Number(p.sell_price ?? 0))
    }
    return {
      resource:   p.resource,
      location:   slug,
      buy_price:  p.buy_price,
      sell_price: p.sell_price,
      stock:      stockMap.get(`${p.location_id}|${p.resource}`),
    }
  }).filter((p) => p.location)

  let trades = 0, produces = 0, sells = 0, builds = 0

  for (const actor of actors as any[]) {
    // ── Bestand: Σ npc_trades (Käufe) + Σ npc_ledger.goods_delta (Prod−Verkauf) ──
    const { data: buyLed } = await supabase
      .from('npc_trades')
      .select('resource, amount')
      .eq('actor_id', actor.id)
    const bestand: Record<string, number> = {}
    for (const r of (buyLed ?? []) as any[]) {
      bestand[r.resource] = (bestand[r.resource] ?? 0) + Number(r.amount)
    }

    const { data: prodLed } = await supabase
      .from('npc_ledger')
      .select('resource, goods_delta')
      .eq('actor_id', actor.id)
      .not('resource', 'is', null)
    for (const r of (prodLed ?? []) as any[]) {
      if (r.resource) bestand[r.resource] = (bestand[r.resource] ?? 0) + Number(r.goods_delta ?? 0)
    }

    // ── Treasury: Σ npc_ledger.credit_delta ──────────────────────────────────
    const { data: ledSum } = await supabase
      .from('npc_ledger')
      .select('credit_delta')
      .eq('actor_id', actor.id)
    const treasury = (ledSum ?? []).reduce((s: number, r: any) => s + Number(r.credit_delta ?? 0), 0)

    // ── Eigene Gebäude laden (für produce) ───────────────────────────────────
    const { data: gebRows } = await supabase
      .from('tile_entities')
      .select('entity_id, location_id, tile_col, locations(slug)')
      .eq('actor_id', actor.id)
      .eq('entity_type', 'building')
    const gebaeude = ((gebRows ?? []) as any[])
      .map(g => ({
        entity_id:   g.entity_id,
        location_id: g.location_id,
        location:    g.locations?.slug ?? '',
        tile_col:    Number(g.tile_col ?? 0),
      }))
      .filter(g => g.location)

    // ── Stock je Markt auffrischen (Mehr-NPC-fest) ───────────────────────────
    for (const p of preise) p.stock = stockMap.get(`${slugToId.get(p.location)}|${p.resource}`)

    // ── Brain ─────────────────────────────────────────────────────────────────
    const aktionen = entscheideNpc(
      { actor: { id: actor.id, decision_weights: actor.decision_weights }, bestand, treasury, gebaeude },
      { tick: tickNumber, preise },
    )

    // ── Aktionen ausführen ────────────────────────────────────────────────────
    for (const a of aktionen) {

      // ── PRODUCE ─────────────────────────────────────────────────────────────
      if (a.typ === 'produce') {
        const locId = slugToId.get(a.location)
        if (!locId) continue

        const erloes = a.menge * (sellPriceMap.get(`${locId}|${a.resource}`) ?? 0)

        // Idempotenter Ledger-Eintrag. ref = "slug:tile_col" → eindeutig je Gebäude,
        // damit zwei Minen desselben NPCs am gleichen Ort beide ihren Eintrag bekommen.
        const { data: ins } = await supabase.from('npc_ledger').upsert(
          {
            actor_id:    actor.id,
            tick:        tickNumber,
            kind:        'produce',
            resource:    a.resource,
            goods_delta: a.menge,
            credit_delta: erloes,
            location_id: locId,
            ref:         a.ref,    // z.B. "moon:11", "moon:10"
          },
          { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true },
        ).select('id')

        if (!ins?.length) continue   // bereits gelaufen → No-op

        // Stock der Kolonie erhöhen (NPC speist ein)
        const key = `${locId}|${a.resource}`
        const neuerStock = (stockMap.get(key) ?? 0) + a.menge
        await supabase.from('location_resources')
          .update({ stock: neuerStock })
          .eq('location_id', locId)
          .eq('resource', a.resource)
        stockMap.set(key, neuerStock)
        produces++
      }

      // ── SELL ────────────────────────────────────────────────────────────────
      else if (a.typ === 'sell') {
        const locId = slugToId.get(a.location)
        if (!locId) continue

        const aktuellerSellPrice = sellPriceMap.get(`${locId}|${a.resource}`) ?? 0
        if (aktuellerSellPrice < a.minPreis) continue  // Markt unter sell_floor gefallen

        const erloes = a.menge * aktuellerSellPrice

        const { data: ins } = await supabase.from('npc_ledger').upsert(
          {
            actor_id:     actor.id,
            tick:         tickNumber,
            kind:         'sell',
            resource:     a.resource,
            goods_delta:  -a.menge,  // negativ: Gut verlässt NPC-Lager
            credit_delta:  erloes,
            location_id:  locId,
          },
          { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true },
        ).select('id')

        if (!ins?.length) continue

        // Stock erhöhen (NPC verkauft an Kolonielager)
        const key = `${locId}|${a.resource}`
        const neuerStock = (stockMap.get(key) ?? 0) + a.menge
        await supabase.from('location_resources')
          .update({ stock: neuerStock })
          .eq('location_id', locId)
          .eq('resource', a.resource)
        stockMap.set(key, neuerStock)
        sells++
      }

      // ── BUILD ────────────────────────────────────────────────────────────────
      else if (a.typ === 'build') {
        const locId = slugToId.get(a.location)
        if (!locId) continue

        // Idempotenz: ref = location-Slug, damit pro Ort+Tick genau ein Bau-Event
        const { data: ins } = await supabase.from('npc_ledger').upsert(
          {
            actor_id:     actor.id,
            tick:         tickNumber,
            kind:         'build',
            resource:     null,
            goods_delta:  0,
            credit_delta: -a.cost,  // Kosten abziehen
            location_id:  locId,
            ref:          a.location,
          },
          { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true },
        ).select('id')

        if (!ins?.length) continue   // bereits gebaut diesen Tick

        // Gebäude in tile_entities einfügen — nächste freie Eck-Kachel (row 7)
        // NPCs bauen immer oben rechts und rücken col nach links (6, 5, 4 …).
        // Einfacher Heuristic: count bestehender NPC-Gebäude dieses Typs am Ort
        const { data: vorhandene } = await supabase
          .from('tile_entities')
          .select('tile_col')
          .eq('actor_id', actor.id)
          .eq('location_id', locId)
          .eq('entity_id', a.building)
          .order('tile_col', { ascending: false })

        const naechsteCol = vorhandene?.length
          ? Math.max(0, (vorhandene[0].tile_col ?? 11) - 1)
          : 11

        await supabase.from('tile_entities').insert({
          actor_id:    actor.id,
          location_id: locId,
          tile_level:  0,
          tile_row:    7,
          tile_col:    naechsteCol,
          entity_type: 'building',
          entity_id:   a.building,
        })
        builds++
      }

      // ── BUY (Phase B, unverändert → npc_trades) ─────────────────────────────
      else if (a.typ === 'buy') {
        const locId = slugToId.get(a.location)
        if (!locId) continue

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

        if (!eingefuegt?.length) continue

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
  }

  return { actors: actors.length, trades, produces, sells, builds }
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
