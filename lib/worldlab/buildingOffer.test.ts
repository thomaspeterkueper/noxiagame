import { describe, expect, it } from 'vitest'
import { buildingFacts, buildingPrice, notForSaleReason } from './buildingOffer'

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
    expect(buildingPrice({ areaM2: 96, levels: 2, kind: 'house', rentPerInterval: 480 })).toBe(empty + 4800)
    expect(buildingPrice({ areaM2: 10, levels: 1, kind: 'shed', rentPerInterval: 0 })).toBe(800)
  })

  it('keeps public buildings off the market', () => {
    expect(notForSaleReason({ building: 'church' }, 'church')).toBeTruthy()
    expect(notForSaleReason({ building: 'yes', amenity: 'townhall' }, 'row')).toBeTruthy()
    expect(notForSaleReason({ building: 'house' }, 'house')).toBeNull()
  })
})
