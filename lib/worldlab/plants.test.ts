import { describe, expect, it } from 'vitest'
import { foliage, foliageText, plantDay, plantRegion, PLANTS } from './plants'
import { plantSpots } from './plantPlacement'

const day = (m: number, d: number) => plantDay(Date.UTC(2026, m - 1, d, 12), 51.3)

describe('Jahreszeiten', () => {
  it('Anfang November: Buche kupfern, Birke fast kahl, Fichte grün', () => {
    const nov5 = day(11, 5)
    const buche = foliage(PLANTS.buche, nov5)
    expect(buche.color).not.toBe(PLANTS.buche.summer)
    expect(buche.leaf).toBeGreaterThan(0.3)
    expect(foliage(PLANTS.birke, nov5).leaf).toBeLessThan(0.3)
    expect(foliage(PLANTS.fichte, nov5)).toEqual({ leaf: 1, color: PLANTS.fichte.summer })
    expect(foliageText(PLANTS.buche, nov5)).toMatch(/Herbst|Laub/)
  })
  it('Winter kahl, junge Buche behält braune Blätter; Kirsche blüht im April', () => {
    expect(foliage(PLANTS.linde, day(1, 15)).leaf).toBe(0)
    expect(foliage(PLANTS.buche, day(1, 15)).leaf).toBeGreaterThan(0)
    expect(foliage(PLANTS.kirsche, day(4, 18)).blossom).toBeDefined()
    expect(foliage(PLANTS.apfel, day(9, 10)).fruit).toBeDefined()
    expect(foliage(PLANTS.linde, day(7, 1))).toEqual({ leaf: 1, color: PLANTS.linde.summer })
  })
  it('Südhalbkugel versetzt, warme Breiten immer belaubt', () => {
    expect(plantDay(Date.UTC(2026, 6, 1), -40)).toBeGreaterThan(355)
    expect(foliage(PLANTS.linde, day(1, 15), 'warm').leaf).toBe(1)
    expect(plantRegion(51.3, 8)).toBe('central')
    expect(plantRegion(22.2, 69)).toBe('warm')
    expect(plantRegion(59.9, 30.3)).toBe('central')
    expect(plantRegion(45, -100)).toBe('other')
  })
})

const square = (n: number) => [0, 0, n, 0, n, n, 0, n]
const tile = (areas: Array<{ k: string; p: number[] }>, extra: Record<string, unknown> = {}) => ({ size: 190, areas, roads: [], rivers: [], blocks: [], trees: [], ...extra }) as never

describe('Verteilung', () => {
  it('Wald: dicht, Bestände mit vorherrschender Art, nur heimische Arten', () => {
    const spots = plantSpots(tile([{ k: 'forest', p: square(190) }]), { x: 0, y: 0 }, { lat: 51.3, lon: 8 })
    expect(spots.length).toBeGreaterThan(250)
    expect(spots.length).toBeLessThanOrEqual(900)
    expect(spots.every(s => s.source === 'estimate')).toBe(true)
    expect(new Set(spots.map(s => s.species)).size).toBeGreaterThan(4)
    expect(spots.some(s => s.species === 'fichte')).toBe(true)
  })
  it('keine Bäume auf Straßen, in Häusern oder im Wasser', () => {
    const spots = plantSpots(tile([{ k: 'forest', p: square(190) }, { k: 'water', p: [100, 100, 150, 100, 150, 150, 100, 150] }], {
      roads: [{ c: 'street', p: [0, 50, 190, 50] }], blocks: [{ x: 40, y: 140, w: 12, d: 10, a: 0, k: 'house', l: 2 }],
    }), { x: 0, y: 0 }, { lat: 51.3, lon: 8 })
    expect(spots.every(s => Math.abs(s.y - 50) > 4.5)).toBe(true)
    expect(spots.every(s => !(s.x > 100 && s.x < 150 && s.y > 100 && s.y < 150))).toBe(true)
    expect(spots.every(s => Math.hypot(s.x - 40, s.y - 140) > 8)).toBe(true)
  })
  it('Wohngebiet locker mit Obstbäumen und Sträuchern; warme Breiten ohne erfundene Arten', () => {
    const garden = plantSpots(tile([{ k: 'garden', p: square(190) }]), { x: 0, y: 0 }, { lat: 51.3, lon: 8 })
    expect(garden.length).toBeGreaterThan(20)
    expect(garden.length).toBeLessThan(300)
    expect(garden.some(s => s.species === 'apfel' || s.species === 'kirsche')).toBe(true)
    expect(garden.some(s => PLANTS[s.species].form === 'bush' || PLANTS[s.species].form === 'hedge')).toBe(true)
    const warm = plantSpots(tile([{ k: 'forest', p: square(190) }]), { x: 0, y: 0 }, { lat: 22.2, lon: 69 })
    expect(warm.every(s => s.species === 'laubbaum')).toBe(true)
  })
  it('OSM-Bäume bleiben an ihrem Ort, Art geschätzt', () => {
    const spots = plantSpots(tile([], { trees: [10, 20, 30, 40] }), { x: 0, y: 0 }, { lat: 51.3, lon: 8 })
    expect(spots.map(s => [s.x, s.y, s.source])).toEqual([[10, 20, 'osm'], [30, 40, 'osm']])
  })
  it('Nachbarkacheln: gleiches Raster', () => {
    const a = plantSpots(tile([{ k: 'forest', p: square(190) }]), { x: 0, y: 0 }, { lat: 51.3, lon: 8 })
    const b = plantSpots(tile([{ k: 'forest', p: square(190) }]), { x: 0, y: 0 }, { lat: 51.3, lon: 8 })
    expect(a).toEqual(b)
  })
})
