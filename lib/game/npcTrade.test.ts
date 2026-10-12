import { describe, expect, it } from 'vitest'
import { handelsStand, planeLieferung, planeVerkaeufe, HANDEL_STANDARD, type HandelsMarkt } from './npcTrade'

const markt = (location: string, buy: number, sell: number, stock: number, capacity = 1000, consumption = 0): HandelsMarkt =>
  ({ resource: 'water', location, buy_price: buy, sell_price: sell, stock, capacity, consumption })
const route = () => ({ energy: 6, ticks: 2.2 })
const lage = { treasury: 10000, tick: 100, offen: {} }

describe('planeLieferung', () => {
  it('liefert vom billigen zum teuren Ort, mit Fracht und Dauer', () => {
    const l = planeLieferung(lage, [markt('phobos', 59, 44, 200), markt('prometheus', 130, 100, 100)], route)!
    expect(l).toMatchObject({ from: 'phobos', to: 'prometheus', menge: 50, fracht: 150, ankunftTick: 103 })
    expect(l.stueckkosten).toBe(62)
    expect(l.gewinnErwartet).toBe(50 * 100 - 50 * 59 - 150)
  })
  it('liefert nicht ohne ausreichende Marge', () => {
    expect(planeLieferung(lage, [markt('phobos', 59, 44, 200), markt('mars', 79, 62, 100)], route)).toBeNull()
  })
  it('liefert nicht in ein volles Lager und nur, was hineinpasst', () => {
    expect(planeLieferung(lage, [markt('phobos', 59, 44, 200), markt('prometheus', 130, 100, 300, 300)], route)).toBeNull()
    expect(planeLieferung(lage, [markt('phobos', 59, 44, 200), markt('prometheus', 130, 100, 280, 300)], route)!.menge).toBe(20)
  })
  it('lässt dem Quellort seine Versorgung', () => {
    expect(planeLieferung(lage, [markt('phobos', 59, 44, 200, 1000, 4), markt('prometheus', 130, 100, 0)], route)!.menge).toBe(8)
    expect(planeLieferung(lage, [markt('phobos', 59, 44, 200, 1000, 5), markt('prometheus', 130, 100, 0)], route)).toBeNull()
  })
  it('kauft nicht an gesperrten Quellen und nicht über die Kasse hinaus', () => {
    expect(planeLieferung(lage, [markt('earth', 22, 12, 999999), markt('prometheus', 130, 100, 0)], route)).toBeNull()
    expect(planeLieferung({ ...lage, treasury: 740 }, [markt('phobos', 59, 44, 200), markt('prometheus', 130, 100, 0)], route)!.menge).toBe(10)
  })
  it('hält je Zielort und Gut nur eine offene Position', () => {
    expect(planeLieferung({ ...lage, offen: { 'prometheus|water': 50 } }, [markt('phobos', 59, 44, 200), markt('prometheus', 130, 100, 0)], route)).toBeNull()
  })
})

describe('handelsStand und planeVerkaeufe', () => {
  const sendungen = [
    { resource: 'water', amount: 50, from: 'phobos', to: 'prometheus', arrive_tick: 103, unit_cost: 62 },
    { resource: 'water', amount: 50, from: 'phobos', to: 'moon', arrive_tick: 110, unit_cost: 70 },
  ]
  it('Ware unterwegs liegt in keinem Lager, bindet aber die Position', () => {
    const s = handelsStand(sendungen, {}, 102)
    expect(s.posten).toEqual([])
    expect(s.offen).toEqual({ 'prometheus|water': 50, 'moon|water': 50 })
  })
  it('angekommene Ware wird verkauft, abzüglich bereits Verkauftem', () => {
    const s = handelsStand(sendungen, { 'prometheus|water': 20 }, 104)
    expect(s.posten).toEqual([{ location: 'prometheus', resource: 'water', menge: 30, stueckkosten: 62 }])
    const v = planeVerkaeufe(s.posten, [markt('prometheus', 130, 100, 100)])
    expect(v).toMatchObject([{ location: 'prometheus', menge: HANDEL_STANDARD.verkaufProTick, minPreis: 62 }])
  })
  it('verkauft nicht unter Einstand und nicht über die Lagergrenze', () => {
    const posten = [{ location: 'prometheus', resource: 'water', menge: 30, stueckkosten: 62 }]
    expect(planeVerkaeufe(posten, [markt('prometheus', 80, 60, 100)])).toEqual([])
    expect(planeVerkaeufe(posten, [markt('prometheus', 130, 100, 295, 300)])[0].menge).toBe(5)
  })
})
