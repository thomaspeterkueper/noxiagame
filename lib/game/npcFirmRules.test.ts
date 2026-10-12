import { describe, expect, it } from 'vitest'
import { ausbauLohnt, entscheideNpc, type NpcDecisionWeights, type NpcWelt } from './npcBrain'

const boann: NpcDecisionWeights = {
  role: 'producer', sells: ['water'], reserve: 30, sell_floor: 40, sell_per_tick: 20,
  expand: { cost: 2500, building: 'ice_drill', location: 'moon', treasury_min: 9000 },
}
const welt = (over: Partial<NpcWelt['preise'][number]>[] = []): NpcWelt => ({
  tick: 1,
  preise: [
    { resource: 'water', location: 'mars', buy_price: 80, sell_price: 60, stock: 650, capacity: 1300 },
    { resource: 'water', location: 'prometheus', buy_price: 130, sell_price: 100, stock: 316 },
    { resource: 'water', location: 'moon', buy_price: 98, sell_price: 73, stock: 290, capacity: 1300 },
    ...over as NpcWelt['preise'],
  ],
})
const kontext = (lager: Record<string, Record<string, number>>, treasury = 0) => ({
  actor: { id: 'boann', decision_weights: boann },
  bestand: Object.values(lager).reduce((acc, l) => { for (const [k, v] of Object.entries(l)) acc[k] = (acc[k] ?? 0) + v; return acc }, {} as Record<string, number>),
  lager, treasury,
  gebaeude: [{ entity_id: 'water_recycler', location_id: 'm', location: 'mars', tile_col: 9 }],
})

describe('Firmenverkauf', () => {
  it('verkauft produzierte Ware nicht ein zweites Mal: ohne eigenen Bestand kein Verkauf', () => {
    const aktionen = entscheideNpc(kontext({}), welt())
    expect(aktionen.filter(a => a.typ === 'produce')).toHaveLength(1)
    expect(aktionen.filter(a => a.typ === 'sell')).toHaveLength(0)
  })
  it('verkauft nur dort, wo die Ware liegt – nicht am teuersten Ort ohne Transport', () => {
    const sell = entscheideNpc(kontext({ mars: { water: 80 } }), welt()).find(a => a.typ === 'sell')
    expect(sell).toMatchObject({ location: 'mars', menge: 20 })
  })
  it('lässt die Reserve liegen und verkauft nicht unter dem Mindestpreis', () => {
    expect(entscheideNpc(kontext({ mars: { water: 30 } }), welt()).some(a => a.typ === 'sell')).toBe(false)
    const billig: NpcWelt = { tick: 1, preise: [{ resource: 'water', location: 'mars', buy_price: 40, sell_price: 30, stock: 650 }] }
    expect(entscheideNpc(kontext({ mars: { water: 80 } }), billig).some(a => a.typ === 'sell')).toBe(false)
  })
})

describe('Firmenausbau', () => {
  it('baut, wenn Absatz möglich ist', () => {
    expect(ausbauLohnt(boann, welt())).toBe(true)
    expect(entscheideNpc(kontext({}, 9500), welt()).some(a => a.typ === 'build')).toBe(true)
  })
  it('baut nicht bei vollem Lager oder Preis unter dem Mindestpreis', () => {
    const voll: NpcWelt = { tick: 1, preise: [{ resource: 'water', location: 'moon', buy_price: 98, sell_price: 73, stock: 1300, capacity: 1300 }] }
    const billig: NpcWelt = { tick: 1, preise: [{ resource: 'water', location: 'moon', buy_price: 40, sell_price: 30, stock: 100, capacity: 1300 }] }
    expect(ausbauLohnt(boann, voll)).toBe(false)
    expect(ausbauLohnt(boann, billig)).toBe(false)
    expect(entscheideNpc(kontext({}, 9500), voll).some(a => a.typ === 'build')).toBe(false)
  })
  it('baut nicht unter der Kassenschwelle', () => {
    expect(entscheideNpc(kontext({}, 8999), welt()).some(a => a.typ === 'build')).toBe(false)
  })
})
