import { describe, expect, it } from 'vitest'
import { areaM2, mergeRings, splitRing } from './parcelGeometry'

// Rechteck rund 40 m (Ost) × 20 m (Nord) bei Sundern
const lat = 51.3255, lon = 8.0045
const dLat = 20 / 111_320, dLon = 40 / (111_320 * Math.cos(lat * Math.PI / 180))
const rect = [
  { lat, lon }, { lat, lon: lon + dLon }, { lat: lat + dLat, lon: lon + dLon }, { lat: lat + dLat, lon },
]

describe('parcel geometry', () => {
  it('measures area', () => {
    expect(areaM2(rect)).toBeCloseTo(800, -1)
  })

  it('splits across the main axis', () => {
    const parts = splitRing(rect, { lat: lat + dLat / 2, lon: lon + dLon / 4 }, 'across')
    expect(parts).not.toBeNull()
    const [a, b] = parts!
    const areas = [areaM2(a), areaM2(b)].sort((x, y) => x - y)
    expect(areas[0]).toBeCloseTo(200, -1)
    expect(areas[1]).toBeCloseTo(600, -1)
  })

  it('splits along the main axis', () => {
    const parts = splitRing(rect, { lat: lat + dLat / 2, lon: lon + dLon / 2 }, 'along')
    const [a, b] = parts!
    expect(areaM2(a)).toBeCloseTo(400, -1)
    expect(areaM2(b)).toBeCloseTo(400, -1)
  })

  it('returns null when the line misses the parcel', () => {
    expect(splitRing(rect, { lat: lat + dLat * 5, lon: lon + dLon / 2 }, 'along')).toBeNull()
  })

  it('merges split halves back', () => {
    const [a, b] = splitRing(rect, { lat: lat + dLat / 2, lon: lon + dLon / 3 }, 'across')!
    const merged = mergeRings(a, b)
    expect(merged).not.toBeNull()
    expect(areaM2(merged!)).toBeCloseTo(800, -1)
    expect(merged!.length).toBe(6)
  })

  it('merges neighbours sharing an edge (any orientation)', () => {
    const right = [
      { lat, lon: lon + dLon }, { lat, lon: lon + 2 * dLon }, { lat: lat + dLat, lon: lon + 2 * dLon }, { lat: lat + dLat, lon: lon + dLon },
    ].reverse()
    const merged = mergeRings(rect, right)
    expect(areaM2(merged!)).toBeCloseTo(1600, -1)
    expect(merged!.length).toBe(6)
  })

  it('refuses parcels without a shared edge', () => {
    const far = rect.map(p => ({ lat: p.lat + dLat * 3, lon: p.lon }))
    expect(mergeRings(rect, far)).toBeNull()
    // nur ein gemeinsamer Eckpunkt
    const corner = rect.map(p => ({ lat: p.lat + dLat, lon: p.lon + dLon }))
    expect(mergeRings(rect, corner)).toBeNull()
  })
})
