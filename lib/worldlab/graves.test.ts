import { describe, expect, it } from 'vitest'
import { graveSpots } from './graves'

const square = (n: number) => [{ x: 0, y: 0 }, { x: n, y: 0 }, { x: n, y: n }, { x: 0, y: n }]

describe('graveSpots', () => {
  it('füllt einen Friedhof mit Reihen und lässt Wege frei', () => {
    const spots = graveSpots(square(60), { x: 1000, y: 2000 }, [], true)
    // 3600 m² bei 2,8 × 1,6 m je Grab, minus Wege, Rand und Lücken
    expect(spots.length).toBeGreaterThan(400)
    expect(spots.length).toBeLessThan(800)
    // Eine Reihe liegt auf einer Tiefe
    const rows = new Set(spots.map(s => s.row.toFixed(3)))
    expect(rows.size).toBeLessThan(40)
    expect(spots.some(s => s.cross)).toBe(true)
    expect(spots.filter(s => s.cross).length).toBeLessThan(spots.length * 0.25)
  })

  it('hält Abstand zu Häusern und zum Rand', () => {
    const spots = graveSpots(square(40), { x: 0, y: 0 }, [{ x: 20, y: 20, r: 8 }], false)
    expect(spots.every(s => Math.hypot(s.x - 20, s.y - 20) >= 8)).toBe(true)
    expect(spots.every(s => s.x > 1.7 && s.y > 1.7 && s.x < 38.3 && s.y < 38.3)).toBe(true)
    expect(spots.some(s => s.cross)).toBe(false)
  })

  it('Nachbarkacheln passen zusammen: gleiches Raster in absoluten Metern', () => {
    const a = graveSpots(square(100), { x: 0, y: 0 }, [], false).filter(s => s.x > 50 && s.x < 90 && s.y > 10 && s.y < 90)
    const b = graveSpots(square(50), { x: 50, y: 0 }, [], false).map(s => ({ ...s, x: s.x + 50 })).filter(s => s.x > 55 && s.x < 90 && s.y > 10 && s.y < 45)
    const key = (s: { x: number; y: number }) => s.x.toFixed(2) + ',' + s.y.toFixed(2)
    const inA = new Set(a.map(key))
    expect(b.length).toBeGreaterThan(50)
    expect(b.every(s => inA.has(key(s)))).toBe(true)
  })

  it('leere Fläche ergibt nichts', () => {
    expect(graveSpots([], { x: 0, y: 0 }, [], true)).toEqual([])
  })
})
