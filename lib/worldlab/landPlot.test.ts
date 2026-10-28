import { describe, expect, it } from 'vitest'
import { looksLikeStreetParcel, landRateForArea, landSizeValid, lineTouchesPolygon, polygonAreaM2, polygonsOverlap, rectRing, toLocal } from './landPlot'

const square = (x: number, y: number, s: number) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }]

describe('Land abstecken', () => {
  it('Rechteck hat die gewünschte Fläche, auch gedreht', () => {
    const at = { lat: 51.0, lon: 8.0 }
    for (const rotation of [0, 30, 75]) {
      const ring = rectRing(at, 30, 20, rotation).map(p => toLocal(at, p))
      expect(polygonAreaM2(ring)).toBeGreaterThan(599)
      expect(polygonAreaM2(ring)).toBeLessThan(601)
    }
  })
  it('Überschneidung: ineinander, kreuzend, nur berührend, getrennt', () => {
    expect(polygonsOverlap(square(0, 0, 10), square(2, 2, 3))).toBe(true)
    expect(polygonsOverlap(square(0, 0, 10), square(5, 5, 10))).toBe(true)
    expect(polygonsOverlap(square(0, 0, 10), square(10, 0, 10))).toBe(false)
    expect(polygonsOverlap(square(0, 0, 10), square(30, 30, 5))).toBe(false)
  })
  it('Straße am Rand: halbe Breite zählt', () => {
    const plot = square(0, 0, 20)
    const road = [{ x: -10, y: 23 }, { x: 30, y: 23 }]
    expect(lineTouchesPolygon(road, plot, 2.5)).toBe(false)
    expect(lineTouchesPolygon(road, plot, 3.5)).toBe(true)
    expect(lineTouchesPolygon([{ x: -5, y: 10 }, { x: 25, y: 10 }], plot, 1)).toBe(true)
  })
  it('Preis je m² nach Fläche, Größen begrenzt', () => {
    expect(landRateForArea('built')).toBeGreaterThan(landRateForArea('field'))
    expect(landRateForArea('field')).toBeGreaterThan(landRateForArea('forest'))
    expect(landSizeValid(30, 30)).toBe(true)
    expect(landSizeValid(5, 30)).toBe(false)
    expect(landSizeValid(30, 200)).toBe(false)
  })
})

describe('Straßen-Flurstück ohne Nutzungsart', () => {
  const road = [{ x: -50, y: 5 }, { x: 250, y: 5 }]
  it('schmaler Streifen mit Straße darin', () => {
    expect(looksLikeStreetParcel([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 10 }, { x: 0, y: 10 }], [road])).toBe(true)
  })
  it('Hausgrundstück, an dessen Rand die Linie ein Stück hineinragt', () => {
    expect(looksLikeStreetParcel([{ x: 0, y: 4 }, { x: 25, y: 4 }, { x: 25, y: 40 }, { x: 0, y: 40 }], [road])).toBe(false)
  })
})
