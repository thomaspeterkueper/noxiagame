// lib/game/tick.ts
// Erstellt:     01.06.2026
// Aktualisiert: 27.06.2026 — components/Bauteile im Produktionsloop
// Version:      3.1.0

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
  ORDER_REWARD_MULT,
  ORDER_EXPIRE_HOURS,
  ORDER_COVERAGE_TICKS,
} from './config'
import { BUILDING_SALE } from './buildingSale'
import { entscheideNpc } from './npcBrain'

export const TICK_INTERVAL_SECONDS = 3600
export const TICK_MAX_CATCHUP      = 48

const AVG_WINDOW_TICKS      = 7
const HISTORY_RETENTION_TICKS = 336
const TICK_RESOURCES = ['water', 'energy', 'metal', 'components'] as const

type SB = any

interface DBBuildingDef {
  key:              string
  cost_credits:     number
  population_bonus: number
  production:       { resource: string; amount: number }[]
  consumption:      { resource: string; amount: number }[]
}

async function loadBuildingDefs(supabase: SB): Promise<Map<string, DBBuildingDef>> {
  const { data, error } = await supabase
    .from('building_definitions')
    .select('key, cost_credits, population_bonus, production, consumption')
    .eq('is_active', true)

  if (error) {
    console.error('loadBuildingDefs error:', error)
    return new Map()
  }

  const map = new Map<string, DBBuildingDef>()
  for (const row of data ?? []) {
    map.set(row.key, {
      key:              row.key,
      cost_credits:     row.cost_credits ?? 0,
      population_bonus: row.population_bonus ?? 0,
      production:       Array.isArray(row.production) ? row.production : [],
      consumption:      Array.isArray(row.consumption) ? row.consumption : [],
    })
  }
  return map
}

export async function runPopulationTick(
  supabase: SB,
  tickNumber: number,
  defs: Map<string, DBBuildingDef>,
) {
  const results: Record<string, unknown>[] = []

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
    for (const r of resources ?? []) {
      stock[r.resource] = r.stock
      resMap[r.resource] = r
    }

    const { data: buildings } = await supabase
      .from('tile_entities')
      .select('id, entity_id, profile_id, actor_id')
      .eq('location_id', loc.id)
      .eq('entity_type', 'building')

    const counts: Record<string, number> = {}
    for (const b of buildings ?? []) {
      counts[b.entity_id] = (counts[b.entity_id] ?? 0) + 1
    }

    const pop = loc.population

    let popBonus = 0
    for (const [entityId, count] of Object.entries(counts)) {
      const def = defs.get(entityId)
      if (def && def.population_bonus > 0) {
        popBonus += def.population_bonus * count
      }
    }
    const popMax = (loc.base_population_max ?? loc.population_max) + popBonus

    const consumed: Record<string, number> = {
      water:  Math.ceil((pop / 100) * CONSUMPTION_PER_100.water),
      energy: Math.ceil((pop / 100) * CONSUMPTION_PER_100.energy),
      metal:  Math.ceil((pop / 100) * CONSUMPTION_PER_100.metal),
      components: 0,
    }

    const isSupplied =
      (stock['water']  ?? 0) >= consumed.water &&
      (stock['energy'] ?? 0) >= consumed.energy &&
      (stock['metal']  ?? 0) >= consumed.metal

    for (const res of TICK_RESOURCES) {
      const r = resMap[res]
      if (!r) continue

      let totalBuildingProduction = 0
      let totalBuildingConsumption = 0

      for (const [entityId, count] of Object.entries(counts)) {
        const def = defs.get(entityId)
        if (!def) continue

        for (const prod of def.production) {
          if (prod.resource === res) totalBuildingProduction += prod.amount * count
        }
        for (const cons of def.consumption) {
          if (cons.resource === res) totalBuildingConsumption += cons.amount * count
        }
      }

      const totalProd = (r.base_production ?? r.production ?? 0) + totalBuildingProduction
      const totalCons = (consumed[res] ?? 0) + totalBuildingConsumption
      const newStock  = Math.max(0, r.stock + totalProd - totalCons)

      await supabase.from('location_resources')
        .update({ stock: newStock, production: totalProd, consumption: totalCons })
        .eq('id', r.id)
      stock[res] = newStock
    }

    let newPop: number
    let overcrowded = false
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

    if ((buildings ?? []).length > 0) {
      const { data: settings } = await supabase
        .from('colony_settings')
        .select('tax_transaction')
        .eq('location_id', loc.id)
        .maybeSingle()
      const taxRate = Number(settings?.tax_transaction ?? 0)

      const { data: priceRows } = await supabase
        .from('market_prices')
        .select('resource, sell_price')
        .eq('location_id', loc.id)
      const sellPrice: Record<string, number> = {}
      for (const p of priceRows ?? []) sellPrice[p.resource] = p.sell_price

      const auslastung = popMax > 0 ? Math.min(1, Math.max(0, newPop / popMax)) : 0

      for (const b of buildings ?? []) {
        if (!b.profile_id) continue
        const def = defs.get(b.entity_id)
        if (!def) continue
        let gross = 0

        if (def.population_bonus > 0) {
          const belegt = Math.round(def.population_bonus * auslastung)
          gross = belegt * BUILDING_SALE.MIETWERT_PRO_PLATZ
        } else if (def.production.length > 0) {
          const hauptprod = def.production[0]
          const r = resMap[hauptprod.resource]
          if (r) {
            const balance = (r.production ?? 0) - (r.consumption ?? 0)
            const mangel  = (stock[hauptprod.resource] ?? 0) < STOCK_LOW_THRESHOLD
                          || (balance < 0 && (stock[hauptprod.resource] ?? 0) < 150)
            if (mangel) gross = hauptprod.amount * (sellPrice[hauptprod.resource] ?? 0)
          }
        }

        if (gross <= 0) continue
        const tax    = Math.round(taxRate * gross)
        const payout = gross - tax
        const { data: prof } = await supabase
          .from('profiles').select('credits').eq('id', b.profile_id).single()
        if (prof) {
          await supabase.from('profiles')
            .update({ credits: prof.credits + payout })
            .eq('id', b.profile_id)
        }

        await supabase.from('colony_ledger').insert([
          { location_id: loc.id, tick: tickNumber, entry_type: 'building_payout', profile_id: b.profile_id, resource_type: null, amount: -payout, note: `Ausschüttung ${b.entity_id}` },
          ...(tax > 0 ? [{ location_id: loc.id, tick: tickNumber, entry_type: 'tax_payout', profile_id: b.profile_id, resource_type: null, amount: tax, note: `Steuer auf Ausschüttung ${b.entity_id}` }] : []),
        ])
      }
    }

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

// Rest der Tick-Datei bleibt unverändert ab Price/NPC/Orders.
