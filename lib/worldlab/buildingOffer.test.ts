import { describe, expect, it } from 'vitest'
import { buildingFacts, buildingPrice, fitOutValue, locationFactor, notForSaleReason, plannedResidents } from './buildingOffer'

describe('buildingOffer', () => {
  // Rechteck 12 m (Ost) × 8 m (Nord) bei Sundern
  const lat = 51.34, lon = 8.0, k = Math.cos(lat * Math.PI / 180)
  const east = (m: number) => m / (111320 * k), north = (m: number) => m / 111320
  const ring = [{ lat, lon }, { lat, lon: lon + east(12) }, { lat: lat + north(8), lon: lon + east(12) }, { lat: lat + north(8), lon }]

  it('measures a footprint', () => {
    const facts = buildingFacts(ring, { building: 'house' })!
    expect(facts.areaM2).toBe(96)
    expect([facts.w, facts.d].sort()).toEqual([12, 8].sort())
    expect(facts.kind).toBe('house')
    expect(facts.centre.lat).toBeCloseTo(lat + north(4), 6)
    expect(facts.centre.lon).toBeCloseTo(lon + east(6), 6)
  })

  it('prices floor, land and rent', () => {
    const empty = buildingPrice({ areaM2: 96, levels: 2, kind: 'house', rentPerInterval: 0 })
    expect(empty).toBe(Math.round((96 * 2 * 12 + 96 * 2) / 50) * 50)
    expect(buildingPrice({ areaM2: 96, levels: 2, kind: 'house', rentPerInterval: 480 })).toBe(empty + 2900)
    expect(buildingPrice({ areaM2: 10, levels: 1, kind: 'shed', rentPerInterval: 0 })).toBe(800)
  })

  it('estimates residents of real houses', () => {
    expect(plannedResidents('house', 96, 2)).toBe(4)
    expect(plannedResidents('house', 30, 1)).toBe(1)
    expect(plannedResidents('row', 300, 3)).toBe(8)
    expect(plannedResidents('hall', 500, 2)).toBe(0)
  })

  it('keeps public buildings off the market', () => {
    expect(notForSaleReason({ building: 'church' }, 'church')).toBeTruthy()
    expect(notForSaleReason({ building: 'yes', amenity: 'townhall' }, 'row')).toBeTruthy()
    expect(notForSaleReason({ building: 'house' }, 'house')).toBeNull()
  })

  it('sells real venues, with the fit-out on top', () => {
    expect(notForSaleReason({ building: 'commercial', amenity: 'bar', name: 'Metropol' }, 'hall')).toBeNull()
    expect(fitOutValue({ amenity: 'bar' })).toBe(1800)
    expect(fitOutValue({ amenity: 'restaurant' })).toBe(2400)
    expect(fitOutValue({ building: 'commercial' })).toBe(0)
    const plain = buildingPrice({ areaM2: 150, levels: 2, kind: 'hall', rentPerInterval: 0 })
    expect(buildingPrice({ areaM2: 150, levels: 2, kind: 'hall', rentPerInterval: 0, fitOut: 1800 })).toBe(plain + 1800)
  })

  it('prices the town centre higher', () => {
    const sundern = [{ name: 'Sundern', place: 'town', lat: 51.329832, lon: 8.0072645 }]
    // Hauptstraße 72, etwa 510 m von der Ortsmitte
    const near = locationFactor({ lat: 51.32565445, lon: 8.00417605 }, sundern)
    expect(near.place).toBe('Sundern')
    expect(near.factor).toBeGreaterThan(1.3)
    expect(near.factor).toBeLessThan(1.4)
    expect(locationFactor({ lat: 51.329832, lon: 8.0072645 }, sundern).factor).toBe(1.6)
    expect(locationFactor({ lat: 51.36, lon: 8.0 }, sundern)).toEqual({ factor: 1, place: null, distanceM: null })
    const base = buildingPrice({ areaM2: 100, levels: 2, kind: 'house', rentPerInterval: 0 })
    expect(buildingPrice({ areaM2: 100, levels: 2, kind: 'house', rentPerInterval: 0, locationFactor: 1.5 })).toBe(Math.round(base * 1.5 / 50) * 50)
  })
})
