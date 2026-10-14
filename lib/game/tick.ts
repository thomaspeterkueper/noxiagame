// lib/game/tick.ts
// Erstellt:     01.06.2026
// Aktualisiert: 12.10.2026 — Fracht geht an die Spedition (role 'carrier'); Frachtdauer aus der
//               Entfernung; davor am selben Tag: Handelsfirma (lib/game/npcTrade.ts, Tabelle npc_shipments): kaufen,
//               verschiffen, verkaufen; Firmenkäufe werden bezahlt
// Zuvor am selben Tag: Bugfix Firmenbuchungen: Ware von Firmenanlagen entsteht nur noch im
//               Firmen-Tick (vorher zusätzlich im Kolonie-Tick und im Anlagenlager); produzierte Ware
//               zählt nicht mehr als Firmenbestand (wurde ein zweites Mal verkauft); Bau wird nur
//               gebucht, wenn das Gebäude auf einer freien Kachel wirklich entsteht
// Vorher:       09.10.2026 — Lagergrenzen (lib/game/storageCapacity.ts)
// Version:      3.8.0

import {
  CONSUMPTION_PER_100,
  GROWTH_RATE,
  DECLINE_RATE,
  STOCK_LOW_THRESHOLD,
  ORDER_MIN_AMOUNT,
  ORDER_REWARD_MULT,
  ORDER_EXPIRE_HOURS,
  ORDER_COVERAGE_TICKS,
} from './config'
import { BUILDING_SALE } from './buildingSale'
import { nextPopulation } from './populationGrowth'
import { nextMarketPrice } from './priceModel'
import { acceptedInflow, capacityFor, loadStorageCapacities, type StorageCapacity, type StorageResource } from './storageCapacity'
import { entscheideNpc } from './npcBrain'
import { frachtTicks, handelsStand, planeLieferung, planeVerkaeufe, type SendungZeile } from './npcTrade'
import { transferQuote } from './transfer'
import { distance } from './orbits'
import { runPopulationTick as runPersonPopulationTick } from './population/engine'
import { runPersonTick } from './personBrain'
import { persistPopulationEncounters } from './population/encounterRuntime'
import { runSocialLifeTick } from './population/socialLife'
import { runHousingShadowTick } from './population/housingShadowRuntime'
import { projectSurfacePresence } from './population/surfacePresence'
import { runNpcConsumptionTick, runNpcPayrollTick, runNpcPropertyMarketTick, runNpcSelfBuildTick } from './npcEconomy'

/** Nur für einen bewussten Rückfall: NOXIA_LEGACY_BUILDING_PAYOUT=true. Standard: aus. */
const LEGACY_BUILDING_PAYOUT_ENABLED = process.env.NOXIA_LEGACY_BUILDING_PAYOUT === 'true'

export const TICK_INTERVAL_SECONDS = 3600
export const TICK_MAX_CATCHUP      = 48

// ── Bank-Zinssätze (müssen identisch zu bank/route.ts sein) ─────────────────
const BANK_DEPOSIT_RATE = 0.005   // +0.5%/Tick auf Einlagen
const BANK_LOAN_RATE    = 0.020   // −2.0%/Tick auf Kredite (Zinseszins)

const AVG_WINDOW_TICKS      = 7
const HISTORY_RETENTION_TICKS = 336
const TICK_RESOURCES = ['water', 'energy', 'metal', 'components'] as const

type SB = any

interface DBBuildingDef {
  key:              string
  tier:             number
  cost_credits:     number
  population_bonus: number
  production:       { resource: string; amount: number }[]
  consumption:      { resource: string; amount: number }[]
}

async function loadBuildingDefs(supabase: SB): Promise<Map<string, DBBuildingDef>> {
  const { data, error } = await supabase
    .from('building_definitions')
    .select('key, tier, cost_credits, population_bonus, production, consumption')
    .eq('is_active', true)

  if (error) {
    console.error('loadBuildingDefs error:', error)
    return new Map()
  }

  const map = new Map<string, DBBuildingDef>()
  for (const row of data ?? []) {
    map.set(row.key, {
      key:              row.key,
      tier:             row.tier ?? 1,
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
  storageCapacities?: Map<string, StorageCapacity>,
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

    // A physical building switches away from aggregate location stock as soon as
    // Core has provisioned one native facility inventory for that tile entity.
    // Historical location_resources stock is deliberately left where it is.
    const nativeFacilityIds = new Set<string>()
    const { data: facilityInventories, error: facilityInventoryError } = await supabase
      .from('logistics_inventories')
      .select('subject_id')
      .eq('location_id', loc.id)
      .eq('inventory_kind', 'facility')
      .eq('storage_kind', 'native')
      .eq('subject_type', 'tile_entity')
      .eq('active', true)

    if (facilityInventoryError) {
      // Compatibility fallback: if the logistics schema itself cannot be read,
      // preserve the legacy aggregate simulation instead of stopping all ticks.
      console.error(`runPopulationTick: facility inventory lookup failed for ${loc.slug}:`, facilityInventoryError)
    } else {
      for (const inventory of facilityInventories ?? []) {
        if (inventory.subject_id) nativeFacilityIds.add(inventory.subject_id)
      }
    }

    // Credit newly produced goods to native facility buffers exactly once per
    // tick/building/resource. Fail closed: once a building is physicalized, an
    // output-credit failure must never fall back to location stock, or a retry
    // could duplicate the same goods in two stores.
    let nativeFacilityCredits = 0
    const facilityOutputErrors: string[] = []
    if (!facilityInventoryError) {
      for (const b of buildings ?? []) {
        if (!nativeFacilityIds.has(b.id)) continue
        // Anlagen von NPC-Firmen liefern ausschließlich im Firmen-Tick (runNpcTick):
        // dort wird die Ware an den Markt geliefert, bezahlt und an der Lagergrenze
        // gekappt. Eine zweite Gutschrift ins Anlagenlager wäre dieselbe Ware doppelt.
        if (b.actor_id) continue
        const def = defs.get(b.entity_id)
        if (!def) continue

        for (const prod of def.production) {
          if (!(TICK_RESOURCES as readonly string[]).includes(prod.resource) || prod.amount <= 0) continue
          const { error } = await supabase.rpc('noxia_credit_facility_output', {
            p_tick_number: tickNumber,
            p_tile_entity_id: b.id,
            p_resource: prod.resource,
            p_amount: prod.amount,
          })
          if (error) {
            console.error(`runPopulationTick: facility output credit failed for ${b.id}/${prod.resource}:`, error)
            facilityOutputErrors.push(`${b.id}:${prod.resource}`)
          } else {
            nativeFacilityCredits += 1
          }
        }
      }
    }

    const pop = loc.population

    let popBonus = 0
    for (const [entityId, count] of Object.entries(counts)) {
      const def = defs.get(entityId)
      if (def && def.population_bonus > 0) popBonus += def.population_bonus * count
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

      let legacyBuildingProduction = 0
      let nativeBuildingProduction = 0
      let totalBuildingConsumption = 0

      for (const b of buildings ?? []) {
        const def = defs.get(b.entity_id)
        if (!def) continue

        for (const prod of def.production) {
          if (prod.resource !== res) continue
          // Firmenanlagen (actor_id) zählen hier nicht: ihre Ware kommt über den
          // Firmen-Tick in den Bestand. Vorher lief sie auf beiden Wegen ein.
          if (b.actor_id) continue
          if (!facilityInventoryError && nativeFacilityIds.has(b.id)) nativeBuildingProduction += prod.amount
          else legacyBuildingProduction += prod.amount
        }
        for (const cons of def.consumption) {
          if (cons.resource === res) totalBuildingConsumption += cons.amount
        }
      }

      const baseProduction = Number(r.base_production ?? 0)
      const possibleInflow = baseProduction + legacyBuildingProduction
      const totalCons = (consumed[res] ?? 0) + totalBuildingConsumption
      // Lagergrenze: produziert wird nur, was ins Lager passt. Ohne geladene
      // Kapazitäten (Lookup fehlgeschlagen) gilt das bisherige Verhalten.
      const aggregateInflow = storageCapacities
        ? acceptedInflow({ stock: r.stock, inflow: possibleInflow, consumption: totalCons, capacity: capacityFor(storageCapacities, loc.id)[res as StorageResource] })
        : possibleInflow
      // production zeigt, was tatsächlich erzeugt wurde – bei vollem Lager also weniger.
      const totalProd = aggregateInflow + nativeBuildingProduction
      const newStock  = Math.max(0, r.stock + aggregateInflow - totalCons)

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
      newPop = nextPopulation({
        population: pop, populationMax: popMax, supplied: isSupplied,
        growthRate: GROWTH_RATE, declineRate: DECLINE_RATE, tickNumber,
      })
    }

    await supabase.from('locations')
      .update({ population: newPop, population_max: popMax, is_supplied: isSupplied })
      .eq('id', loc.id)

    // NOXIA-FIN-0001: Die automatische Gebäudeausschüttung schrieb Spielern einen
    // berechneten Betrag gut, den niemand bezahlt hat – eine versteckte Emission.
    // Sie ist abgeschaltet. Erlöse entstehen nur noch aus echten Zahlungen (Miete,
    // Verkauf, öffentliches Budget). Die Produktion der Gebäude bleibt unberührt.
    if (LEGACY_BUILDING_PAYOUT_ENABLED && (buildings ?? []).length > 0) {
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

    results.push({
      location: loc.slug,
      population: { before: pop, after: newPop, max: popMax },
      isSupplied,
      overcrowded,
      logistics: {
        nativeFacilities: nativeFacilityIds.size,
        facilityCredits: nativeFacilityCredits,
        facilityOutputErrors,
      },
    })
  }

  return results
}

export async function runPriceTick(supabase: SB, tickNumber: number, locationSnapshot?: any[]) {
  const results: Record<string, unknown>[] = []
  const priceLocRows = locationSnapshot ?? (await supabase.from('locations').select('id, slug, population, population_max, is_supplied, simulate_tick')).data
  const priceLocMap = new Map<string, any>()
  for (const l of (priceLocRows ?? []) as any[]) priceLocMap.set(l.id, l)
  const { data: prices } = await supabase.from('market_prices').select('*')

  for (const price of prices ?? []) {
    const loc = priceLocMap.get(price.location_id)
    if (!loc) continue
    const { data: res } = await supabase.from('location_resources').select('stock, consumption, production').eq('location_id', loc.id).eq('resource', price.resource).single()
    if (!res) continue
    // Nur simulierte Orte haben einen echten Verbrauch. Referenzorte (Erde,
    // Stationen ohne Tick) behalten ihre gesetzten Preise; die Historie läuft
    // trotzdem weiter, damit Kursverläufe lückenlos bleiben.
    const next = loc.simulate_tick === false
      ? { buy: price.buy_price, sell: price.sell_price }
      : nextMarketPrice({ resource: price.resource, buyPrice: price.buy_price, sellPrice: price.sell_price, stock: res.stock ?? 0, consumption: res.consumption ?? 0 })
    const newBuy = next.buy
    const safeSell = next.sell
    if (!(newBuy === price.buy_price && safeSell === price.sell_price)) await supabase.from('market_prices').update({ buy_price: newBuy, sell_price: safeSell }).eq('id', price.id)
    await supabase.from('price_history').insert({ location_id: loc.id, resource: price.resource, tick_number: tickNumber, buy_price: newBuy, sell_price: safeSell })
    const { data: recent } = await supabase.from('price_history').select('sell_price').eq('location_id', loc.id).eq('resource', price.resource).order('tick_number', { ascending: false }).limit(AVG_WINDOW_TICKS)
    if (recent && recent.length > 0) {
      const avg = Math.round(recent.reduce((s: number, r: any) => s + r.sell_price, 0) / recent.length)
      await supabase.from('market_prices').update({ avg_sell_7: avg }).eq('id', price.id)
    }
    results.push({ location: loc.slug, resource: price.resource, buy: newBuy, sell: safeSell })
  }
  const cutoff = tickNumber - HISTORY_RETENTION_TICKS
  if (cutoff > 0) await supabase.from('price_history').delete().lt('tick_number', cutoff)
  return results
}

export async function runOrderTick(supabase: SB, locationSnapshot?: any[]) {
  const created: Record<string, unknown>[] = []
  await supabase.from('trade_orders').update({ status: 'expired' }).eq('status', 'open').lt('expires_at', new Date().toISOString())
  const locations = locationSnapshot
    ? locationSnapshot.filter((loc: any) => loc.simulate_tick === true)
    : ((await supabase.from('locations').select('id, slug, population, is_supplied, simulate_tick').eq('simulate_tick', true)).data ?? [])
  for (const loc of locations ?? []) {
    const { data: resources } = await supabase.from('location_resources').select('resource, stock, consumption, production').eq('location_id', loc.id)
    for (const res of resources ?? []) {
      const balance = res.production - res.consumption
      const isUrgent = res.stock < STOCK_LOW_THRESHOLD
      const isSinking = balance < 0 && res.stock < 150
      if (!isUrgent && !isSinking) continue
      const { data: existing } = await supabase.from('trade_orders').select('id').eq('location_id', loc.id).eq('resource', res.resource).eq('status', 'open').limit(1)
      if (existing && existing.length > 0) continue
      const { data: price } = await supabase.from('market_prices').select('buy_price').eq('location_id', loc.id).eq('resource', res.resource).single()
      if (!price) continue
      const deficitPerTick = Math.max(0, -balance)
      const amount = Math.max(ORDER_MIN_AMOUNT, Math.round(deficitPerTick * ORDER_COVERAGE_TICKS))
      const rewardMult = isUrgent ? ORDER_REWARD_MULT * 1.3 : ORDER_REWARD_MULT
      const reward = Math.round(price.buy_price * amount * rewardMult)
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + ORDER_EXPIRE_HOURS)
      await supabase.from('trade_orders').insert({ location_id: loc.id, resource: res.resource, amount, reward, status: 'open', expires_at: expiresAt.toISOString() })
      created.push({ location: loc.slug, resource: res.resource, amount, reward, urgent: isUrgent })
    }
  }
  return created
}

const NPC_BAU_ZEILEN = [7, 6, 5] as const
const NPC_BAU_SPALTEN = 12

/** Erste freie Kachel für ein NPC-Gebäude: Zeile 7, dann 6, dann 5 – jeweils von Spalte 11 abwärts. */
export function naechsteFreieKachel(belegt: { tile_row: number | null; tile_col: number | null }[]): { row: number; col: number } | null {
  const besetzt = new Set(belegt.map(b => `${b.tile_row}|${b.tile_col}`))
  for (const row of NPC_BAU_ZEILEN) {
    for (let col = NPC_BAU_SPALTEN - 1; col >= 0; col--) {
      if (!besetzt.has(`${row}|${col}`)) return { row, col }
    }
  }
  return null
}

export async function runNpcTick(supabase: SB, tickNumber: number, locationSnapshot?: any[], storageCapacities?: Map<string, StorageCapacity>) {
  const { data: actors } = await supabase.from('actors').select('id, decision_weights').eq('kind', 'npc_firm')
  if (!actors?.length) return { actors: 0, trades: 0, produces: 0, sells: 0, builds: 0 }
  const locRows = locationSnapshot ?? (await supabase.from('locations').select('id, slug')).data
  const locIdToSlug = new Map<string, string>()
  for (const l of (locRows ?? []) as any[]) locIdToSlug.set(l.id, l.slug)
  const { data: priceRows } = await supabase.from('market_prices').select('resource, buy_price, sell_price, location_id')
  const { data: stockRows } = await supabase.from('location_resources').select('location_id, resource, stock, production, consumption')
  const stockMap = new Map<string, number>()
  const productionMap = new Map<string, number>()
  const consumptionMap = new Map<string, number>()
  for (const s of (stockRows ?? []) as any[]) {
    consumptionMap.set(`${s.location_id}|${s.resource}`, Number(s.consumption ?? 0))
    stockMap.set(`${s.location_id}|${s.resource}`, Number(s.stock ?? 0))
    productionMap.set(`${s.location_id}|${s.resource}`, Number(s.production ?? 0))
  }
  const sellPriceMap = new Map<string, number>()
  const slugToId = new Map<string, string>()
  const preise = ((priceRows ?? []) as any[]).map((p) => {
    const slug = locIdToSlug.get(p.location_id) ?? ''
    if (slug) { slugToId.set(slug, p.location_id); sellPriceMap.set(`${p.location_id}|${p.resource}`, Number(p.sell_price ?? 0)) }
    return {
      resource: p.resource, location: slug, buy_price: p.buy_price, sell_price: p.sell_price,
      stock: stockMap.get(`${p.location_id}|${p.resource}`),
      capacity: storageCapacities ? capacityFor(storageCapacities, p.location_id)[p.resource as StorageResource] : undefined,
    }
  }).filter((p) => p.location)
  let trades = 0, produces = 0, sells = 0, builds = 0, shipments = 0
  for (const actor of actors as any[]) {
    // Eigener Warenbestand der Firma = Käufe − Verkäufe, je Standort. Produzierte
    // Ware zählt nicht dazu: sie wird im selben Tick an den Markt des Standorts
    // geliefert und bezahlt. Vorher zählte sie zusätzlich als Bestand und wurde
    // ein zweites Mal verkauft – an einem anderen Ort, ohne Transport.
    const { data: buyLed } = await supabase.from('npc_trades').select('resource, amount, location_id').eq('actor_id', actor.id)
    const { data: sellLed } = await supabase.from('npc_ledger').select('resource, goods_delta, location_id').eq('actor_id', actor.id).eq('kind', 'sell')
    const bestand: Record<string, number> = {}
    const lager: Record<string, Record<string, number>> = {}
    const buche = (locationId: string | null, resource: string | null, menge: number) => {
      if (!resource) return
      bestand[resource] = (bestand[resource] ?? 0) + menge
      const slug = locationId ? locIdToSlug.get(locationId) : undefined
      if (!slug) return
      lager[slug] = lager[slug] ?? {}
      lager[slug][resource] = (lager[slug][resource] ?? 0) + menge
    }
    for (const r of (buyLed ?? []) as any[]) buche(r.location_id, r.resource, Number(r.amount ?? 0))
    for (const r of (sellLed ?? []) as any[]) buche(r.location_id, r.resource, Number(r.goods_delta ?? 0))
    const { data: ledSum } = await supabase.from('npc_ledger').select('credit_delta').eq('actor_id', actor.id)
    const treasury = (ledSum ?? []).reduce((s: number, r: any) => s + Number(r.credit_delta ?? 0), 0)
    const { data: gebRows } = await supabase.from('tile_entities').select('entity_id, location_id, tile_col').eq('actor_id', actor.id).eq('entity_type', 'building')
    const gebaeude = ((gebRows ?? []) as any[]).map(g => ({ entity_id: g.entity_id, location_id: g.location_id, location: locIdToSlug.get(g.location_id) ?? '', tile_col: Number(g.tile_col ?? 0) })).filter(g => g.location)
    for (const p of preise) p.stock = stockMap.get(`${slugToId.get(p.location)}|${p.resource}`)
    const aktionen = entscheideNpc({ actor: { id: actor.id, decision_weights: actor.decision_weights }, bestand, lager, treasury, gebaeude }, { tick: tickNumber, preise })
    let kasse = treasury
    for (const a of aktionen) {
      if (a.typ === 'produce') {
        const locId = slugToId.get(a.location)
        if (!locId) continue
        // Lagergrenze: Eine Firma produziert nur, was das Lager des Orts noch aufnimmt.
        // Bei vollem Lager ruht die Anlage – keine Ware, kein Erlös.
        const key0 = `${locId}|${a.resource}`
        const menge = storageCapacities
          ? acceptedInflow({ stock: stockMap.get(key0) ?? 0, inflow: a.menge, consumption: 0, capacity: capacityFor(storageCapacities, locId)[a.resource as StorageResource] ?? 0 })
          : a.menge
        if (menge <= 0) continue
        a.menge = menge
        const erloes = a.menge * (sellPriceMap.get(`${locId}|${a.resource}`) ?? 0)
        const { data: ins } = await supabase.from('npc_ledger').upsert({ actor_id: actor.id, tick: tickNumber, kind: 'produce', resource: a.resource, goods_delta: a.menge, credit_delta: erloes, location_id: locId, ref: a.ref }, { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true }).select('id')
        if (!ins?.length) continue
        const key = `${locId}|${a.resource}`
        const neuerStock = (stockMap.get(key) ?? 0) + a.menge
        // production zeigt die tatsächliche Erzeugung am Ort; der Kolonie-Tick hat
        // den Wert in diesem Tick ohne Firmenanlagen gesetzt, hier kommen sie dazu.
        const neueProduktion = (productionMap.get(key) ?? 0) + a.menge
        await supabase.from('location_resources').update({ stock: neuerStock, production: neueProduktion }).eq('location_id', locId).eq('resource', a.resource)
        stockMap.set(key, neuerStock)
        productionMap.set(key, neueProduktion)
        produces++
      } else if (a.typ === 'sell') {
        const locId = slugToId.get(a.location)
        if (!locId) continue
        const aktuellerSellPrice = sellPriceMap.get(`${locId}|${a.resource}`) ?? 0
        if (aktuellerSellPrice < a.minPreis) continue
        const erloes = a.menge * aktuellerSellPrice
        const { data: ins } = await supabase.from('npc_ledger').upsert({ actor_id: actor.id, tick: tickNumber, kind: 'sell', resource: a.resource, goods_delta: -a.menge, credit_delta: erloes, location_id: locId }, { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true }).select('id')
        if (!ins?.length) continue
        const key = `${locId}|${a.resource}`
        const neuerStock = (stockMap.get(key) ?? 0) + a.menge
        await supabase.from('location_resources').update({ stock: neuerStock }).eq('location_id', locId).eq('resource', a.resource)
        stockMap.set(key, neuerStock)
        sells++
      } else if (a.typ === 'build') {
        const locId = slugToId.get(a.location)
        if (!locId) continue
        // Erst eine freie Kachel suchen, dann buchen, dann bauen. Vorher wurde die
        // Spalte nur aus den eigenen Gebäuden abgeleitet; stand dort ein fremdes
        // Gebäude, scheiterte das Anlegen stillschweigend – das Geld war trotzdem weg.
        const { data: belegt } = await supabase.from('tile_entities').select('tile_row, tile_col').eq('location_id', locId).eq('tile_level', 0).eq('entity_type', 'building').not('tile_row', 'is', null)
        const frei = naechsteFreieKachel((belegt ?? []) as { tile_row: number | null; tile_col: number | null }[])
        if (!frei) continue
        const { data: ins } = await supabase.from('npc_ledger').upsert({ actor_id: actor.id, tick: tickNumber, kind: 'build', resource: null, goods_delta: 0, credit_delta: -a.cost, location_id: locId, ref: a.location, note: `${a.building} @ ${a.location} [${frei.row}/${frei.col}]` }, { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true }).select('id')
        if (!ins?.length) continue
        const { error: bauFehler } = await supabase.from('tile_entities').insert({ actor_id: actor.id, location_id: locId, tile_level: 0, tile_row: frei.row, tile_col: frei.col, entity_type: 'building', entity_id: a.building })
        if (bauFehler) {
          // Kein Gebäude, keine Zahlung. Das Journal bleibt anfügend: die Buchung wird
          // nicht gelöscht, sondern durch eine Stornobuchung im selben Tick ausgeglichen.
          console.error(`runNpcTick: build ${a.building} @ ${a.location} failed, booking reversed:`, bauFehler)
          await supabase.from('npc_ledger').upsert({ actor_id: actor.id, tick: tickNumber, kind: 'build', resource: null, goods_delta: 0, credit_delta: a.cost, location_id: locId, ref: `${a.location}:storno`, note: `Storno: ${a.building} @ ${a.location} konnte nicht errichtet werden` }, { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true })
          continue
        }
        builds++
      } else if (a.typ === 'buy') {
        const locId = slugToId.get(a.location)
        if (!locId) continue
        // Ein Kauf wird bezahlt. Vorher wurde nur die Ware gebucht, die Kasse blieb unberührt.
        const kosten = a.menge * a.maxPreis
        if (kasse < kosten) continue
        const { data: eingefuegt } = await supabase.from('npc_trades').upsert({ actor_id: actor.id, tick: tickNumber, resource: a.resource, amount: a.menge, unit_price: a.maxPreis, location_id: locId }, { onConflict: 'actor_id,tick,resource', ignoreDuplicates: true }).select('id')
        if (!eingefuegt?.length) continue
        await supabase.from('npc_ledger').upsert({ actor_id: actor.id, tick: tickNumber, kind: 'buy', resource: a.resource, goods_delta: a.menge, credit_delta: -kosten, location_id: locId, ref: a.location }, { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true })
        kasse -= kosten
        const key = `${locId}|${a.resource}`
        const neuerStock = Math.max(0, (stockMap.get(key) ?? 0) - a.menge
        )
        await supabase.from('location_resources').update({ stock: neuerStock }).eq('location_id', locId).eq('resource', a.resource)
        stockMap.set(key, neuerStock)
        trades++
      }
    }
    if (actor.decision_weights?.role === 'trader') {
      const spediteur = (actors as any[]).find(x => x.decision_weights?.role === 'carrier')?.id ?? null
      shipments += await runHandel(supabase, actor.id, tickNumber, kasse, spediteur, { preise, stockMap, consumptionMap, sellPriceMap, slugToId, locIdToSlug })
    }
  }
  return { actors: actors.length, trades, produces, sells, builds, shipments }
}

// ── Handelsfirma ──────────────────────────────────────────────────────────────
// Kauft, wo es billig ist, verschifft und verkauft, wo es teuer ist. Der Stand
// wird aus den Sendungen und der Zeit abgeleitet: Eine Sendung ist angekommen,
// sobald ihr Ankunfts-Tick erreicht ist – dafür wird nichts geschrieben.
// Je Firma und Tick höchstens eine neue Sendung.
async function runHandel(supabase: SB, actorId: string, tick: number, kasse: number, spediteurId: string | null, w: {
  preise: any[]; stockMap: Map<string, number>; consumptionMap: Map<string, number>; sellPriceMap: Map<string, number>
  slugToId: Map<string, string>; locIdToSlug: Map<string, string>
}): Promise<number> {
  const { data: sendRows, error } = await supabase.from('npc_shipments').select('resource, amount, from_location_id, to_location_id, arrive_tick, unit_cost').eq('actor_id', actorId)
  if (error) { console.error('runHandel: npc_shipments not readable', error); return 0 }
  const sendungen: SendungZeile[] = ((sendRows ?? []) as any[]).map(r => ({
    resource: r.resource, amount: Number(r.amount), from: w.locIdToSlug.get(r.from_location_id) ?? '', to: w.locIdToSlug.get(r.to_location_id) ?? '',
    arrive_tick: Number(r.arrive_tick), unit_cost: Number(r.unit_cost),
  }))
  const { data: vk } = await supabase.from('npc_ledger').select('resource, goods_delta, location_id').eq('actor_id', actorId).eq('kind', 'sell').like('ref', 'handel:%')
  const verkauft: Record<string, number> = {}
  for (const r of (vk ?? []) as any[]) {
    const k = `${w.locIdToSlug.get(r.location_id)}|${r.resource}`
    verkauft[k] = (verkauft[k] ?? 0) - Number(r.goods_delta ?? 0)
  }
  const maerkte = w.preise.map(p => {
    const id = w.slugToId.get(p.location)
    return { ...p, buy_price: Number(p.buy_price), sell_price: Number(p.sell_price), stock: w.stockMap.get(`${id}|${p.resource}`), consumption: w.consumptionMap.get(`${id}|${p.resource}`) ?? 0 }
  })
  const { posten, offen } = handelsStand(sendungen, verkauft, tick)

  for (const v of planeVerkaeufe(posten, maerkte)) {
    const locId = w.slugToId.get(v.location)
    if (!locId) continue
    const key = `${locId}|${v.resource}`
    const erloes = v.menge * (w.sellPriceMap.get(key) ?? 0)
    const { data: ins } = await supabase.from('npc_ledger').upsert({ actor_id: actorId, tick, kind: 'sell', resource: v.resource, goods_delta: -v.menge, credit_delta: erloes, location_id: locId, ref: `handel:${v.location}`, note: v.grund }, { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true }).select('id')
    if (!ins?.length) continue
    const neu = (w.stockMap.get(key) ?? 0) + v.menge
    await supabase.from('location_resources').update({ stock: neu }).eq('location_id', locId).eq('resource', v.resource)
    w.stockMap.set(key, neu)
    kasse += erloes
  }

  const l = planeLieferung({ treasury: kasse, tick, offen }, maerkte, (from, to) => {
    const q = transferQuote(from, to, tick)
    return q ? { energy: q.energy, ticks: frachtTicks(distance(from, to, tick)) } : null
  })
  if (!l) return 0
  const fromId = w.slugToId.get(l.from), toId = w.slugToId.get(l.to)
  if (!fromId || !toId) return 0
  // Die Sendung ist der Beleg: erst sie, dann Zahlung und Lagerabgang. Die
  // Eindeutigkeit (Firma, Tick, Gut) verhindert doppelte Ausführung.
  const { data: ins } = await supabase.from('npc_shipments').upsert({ actor_id: actorId, resource: l.resource, amount: l.menge, from_location_id: fromId, to_location_id: toId, depart_tick: tick, arrive_tick: l.ankunftTick, unit_cost: l.stueckkosten, freight_cost: l.fracht }, { onConflict: 'actor_id,depart_tick,resource', ignoreDuplicates: true }).select('id')
  if (!ins?.length) return 0
  await supabase.from('npc_ledger').upsert([
    { actor_id: actorId, tick, kind: 'buy', resource: l.resource, goods_delta: l.menge, credit_delta: -l.menge * l.kaufpreis, location_id: fromId, ref: `handel:${l.from}`, note: l.grund },
    { actor_id: actorId, tick, kind: 'expense', resource: l.resource, goods_delta: 0, credit_delta: -l.fracht, location_id: fromId, ref: `fracht:${l.from}>${l.to}`, note: `Fracht ${l.menge} t ${l.resource} ${l.from}→${l.to}` },
  ], { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true })
  // Die Fracht hat einen Empfänger: die Spedition (Firma mit role 'carrier').
  // Gibt es keine, bleibt die Fracht eine Ausgabe ohne Gegenbuchung – das wird gemeldet.
  if (spediteurId) {
    await supabase.from('npc_ledger').upsert({ actor_id: spediteurId, tick, kind: 'income', resource: l.resource, goods_delta: 0, credit_delta: l.fracht, location_id: fromId, ref: `fracht:${actorId}:${l.from}>${l.to}`, note: `Frachterlös ${l.menge} t ${l.resource} ${l.from}→${l.to}` }, { onConflict: 'actor_id,tick,kind,resource,ref', ignoreDuplicates: true })
  } else {
    console.warn(`runHandel: no carrier firm, freight ${l.fracht} Cr has no recipient`)
  }
  const key = `${fromId}|${l.resource}`
  const neu = Math.max(0, (w.stockMap.get(key) ?? 0) - l.menge)
  await supabase.from('location_resources').update({ stock: neu }).eq('location_id', fromId).eq('resource', l.resource)
  w.stockMap.set(key, neu)
  return 1
}

// ── Bank-Zinsen ───────────────────────────────────────────────────────────────
// Läuft einmal pro Tick für alle Konten mit Einlage oder Kredit.
// Zinsen werden als Ledger-Einträge gebucht — append-only, vollständig auditierbar.

export async function runBankInterestTick(supabase: SB, tickNumber: number) {
  const { data: accounts, error } = await supabase
    .from('bank_accounts')
    .select('id, profile_id, location_id, deposit, loan')
    .or('deposit.gt.0,loan.gt.0')

  if (error) {
    console.error('runBankInterestTick: load error', error)
    return { processed: 0 }
  }

  let processed = 0

  for (const acc of accounts ?? []) {
    const deposit = Number(acc.deposit ?? 0)
    const loan    = Number(acc.loan    ?? 0)
    const ledgerEntries: { profile_id: string; location_id: string; entry_type: string; amount: number; balance_after: number; note: string; tick: number }[] = []
    const updates: Record<string, number> = {}

    // Zinsgutschrift auf Einlage
    if (deposit > 0) {
      const interest = Math.floor(deposit * BANK_DEPOSIT_RATE)
      if (interest > 0) {
        updates.deposit = deposit + interest
        ledgerEntries.push({
          profile_id:    acc.profile_id,
          location_id:   acc.location_id,
          entry_type:    'interest_deposit',
          amount:        interest,
          balance_after: updates.deposit,
          note:          `Zinsgutschrift +${(BANK_DEPOSIT_RATE * 100).toFixed(1)}% (Tick ${tickNumber})`,
          tick:          tickNumber,
        })
      }
    }

    // Zinslast auf Kredit (Zinseszins)
    if (loan > 0) {
      const interest = Math.ceil(loan * BANK_LOAN_RATE)
      updates.loan = loan + interest
      ledgerEntries.push({
        profile_id:    acc.profile_id,
        location_id:   acc.location_id,
        entry_type:    'interest_loan',
        amount:        interest,
        balance_after: updates.loan,
        note:          `Kreditzinsen −${(BANK_LOAN_RATE * 100).toFixed(1)}% Zinseszins (Tick ${tickNumber})`,
        tick:          tickNumber,
      })
    }

    // Sequenzieller Update + Ledger-Einträge; nicht transaktional
    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from('bank_accounts')
        .update(updates)
        .eq('id', acc.id)

      if (!updateErr && ledgerEntries.length > 0) {
        const { error: ledgerErr } = await supabase.from('bank_ledger').insert(ledgerEntries)
        if (ledgerErr) console.error('runBankInterestTick: ledger error', ledgerErr)
      }

      if (!updateErr) processed++
    }
  }

  return { processed }
}


// ── Bodenwert-Berechnung (F2: Henry George Landwertsteuer) ───────────────────
// Berechnet land_value je Kachel aus:
//   Basiswert (immer 10)
//   + Bevölkerungsdruck der Kolonie (× 0.02 pro Einwohner, max 200)
//   + Gebäudeaktivität auf der Kachel (× 50 wenn bebaut)
//   + Nähe zum Zentrum (Distanz 0 = +100, Distanz 10+ = 0)
// Wird einmal pro Tick aufgerufen — nicht geschäftskritisch bei Fehler.

export async function runLandValueTick(supabase: SB, _locationSnapshot?: any[]) {
  // The database computes the same population + center-distance formula for all
  // buildings in one statement and writes only rows whose value changed.
  const { data, error } = await supabase.rpc('refresh_changed_land_values')
  if (error) {
    console.error('refresh_changed_land_values failed', { code: error.code, message: error.message })
    return { updated: 0, error: error.code ?? 'land_value_refresh_failed' }
  }
  return { updated: Number(data ?? 0) }
}


async function runSurfacePresenceProjection(supabase: SB, tickNumber: number) {
  const { data: people, error: peopleError } = await supabase
    .from('people')
    .select('id, display_name, birth_year, current_location_id, simulation_tier, activity_state, last_action, last_decision_factors, last_tick')
    .eq('simulation_tier', 'active')

  if (peopleError) {
    console.error('runSurfacePresenceProjection: people load failed', peopleError)
    return { projected: 0, updated: 0, cleared: 0, error: peopleError.code ?? 'people_load_failed' }
  }

  const personIds = (people ?? []).map((person: any) => person.id)
  const { data: assignments, error: assignmentsError } = personIds.length
    ? await supabase
        .from('person_assignments')
        .select('id, person_id, assignment_type, location_id, tile_entity_id, region_feature_id, employer_actor_id, role_code, starts_tick, ends_tick, is_active')
        .in('person_id', personIds)
        .eq('is_active', true)
    : { data: [], error: null }

  if (assignmentsError) {
    console.error('runSurfacePresenceProjection: assignments load failed', assignmentsError)
    return { projected: 0, updated: 0, cleared: 0, error: assignmentsError.code ?? 'assignments_load_failed' }
  }

  try {
    return { ...(await projectSurfacePresence(supabase, tickNumber, people ?? [], assignments ?? [])), error: null }
  } catch (error: any) {
    console.error('runSurfacePresenceProjection failed', { tick: tickNumber, message: error?.message ?? String(error) })
    return { projected: 0, updated: 0, cleared: 0, error: error?.message ?? 'surface_presence_failed' }
  }
}

export async function runTick(supabase: SB, tickNumber: number) {
  const defs = await loadBuildingDefs(supabase)
  // Eine Abfrage für alle Orte; geteilt von Orts- und Firmenproduktion. Schlägt
  // sie fehl, läuft der Tick ohne Lagergrenze weiter statt gar nicht.
  let storageCapacities: Map<string, StorageCapacity> | undefined
  try {
    storageCapacities = await loadStorageCapacities(supabase, (entityId) => defs.get(entityId)?.tier ?? 1)
  } catch (err) {
    console.error('runTick: storage capacities unavailable, tick runs uncapped:', err)
  }
  const population = await runPopulationTick(supabase, tickNumber, defs, storageCapacities)
  // Living Population runs after aggregate colony state so decisions observe the
  // current tick. Unnamed people use the population engine; named actors use personBrain.
  const livingPopulation = await runPersonPopulationTick(supabase, tickNumber)
  const namedPeople = await runPersonTick(supabase, tickNumber)
  const surfacePresence = await runSurfacePresenceProjection(supabase, tickNumber)
  const encounters = await persistPopulationEncounters(supabase, tickNumber)
  const socialLife = await runSocialLifeTick(supabase, tickNumber)

  // Aggregate population may update location population/capacity. Load one
  // fresh post-population snapshot and share it across the remaining readers.
  const { data: locationSnapshot } = await supabase
    .from('locations')
    .select('id, slug, population, population_max, is_supplied, simulate_tick')

  const npc = await runNpcTick(supabase, tickNumber, locationSnapshot ?? [], storageCapacities)
  const payroll = await runNpcPayrollTick(supabase, tickNumber)
  const consumption = await runNpcConsumptionTick(supabase, tickNumber)
  const propertyMarket = await runNpcPropertyMarketTick(supabase, tickNumber)
  // Shadow mode only: logs what people would decide, executes nothing. Off by default.
  const housingShadow = await runHousingShadowTick(supabase, tickNumber)
  const npcBuilding = await runNpcSelfBuildTick(supabase, tickNumber)
  const prices = await runPriceTick(supabase, tickNumber, locationSnapshot ?? [])
  const orders  = await runOrderTick(supabase, locationSnapshot ?? [])
  const bank      = await runBankInterestTick(supabase, tickNumber)
  const landValues = await runLandValueTick(supabase, locationSnapshot ?? [])
  return { tickNumber, population, livingPopulation, namedPeople, surfacePresence, encounters, socialLife, prices, npc, payroll, consumption, propertyMarket, housingShadow, npcBuilding, orders, bank, landValues }
}

export async function runDueTicks(supabase: SB) {
  const { data, error } = await supabase.rpc('claim_due_ticks', { p_interval_seconds: TICK_INTERVAL_SECONDS, p_max: TICK_MAX_CATCHUP })
  if (error) { console.error('claim_due_ticks error:', error); return { ran: 0 } }
  const row = Array.isArray(data) ? data[0] : data
  const claimed = row?.claimed ?? 0
  const latest = Number(row?.latest_tick ?? 0)
  if (claimed < 1) return { ran: 0 }
  for (let n = latest - claimed + 1; n <= latest; n++) await runTick(supabase, n)
  return { ran: claimed, latest }
}
