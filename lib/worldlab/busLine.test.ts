// lib/worldlab/busLine.test.ts
// Aktualisiert: 06.11.2026 — Fahrplan der Buslinien
// Version:      1.0.0
import { describe, expect, it } from 'vitest'
import { busRoutesFromOverpass } from './busLines.server'
import { busCycle, busState, lineOffsetS, placeStops, BUS_END_DWELL_S, BUS_STOP_DWELL_S, type BusLine } from './busLine'

const line: BusLine = {
  id: 'osm:relation:1', name: 'Linie 1',
  points: [{ lat: 51.3, lon: 8.0 }, { lat: 51.3, lon: 8.0144 }], // ≈ 1 000 m nach Osten
  lengthM: 1000,
  stops: [{ name: 'Markt', atM: 0 }, { name: 'Schule', atM: 500 }, { name: 'Bahnhof', atM: 1000 }],
}
const start = -lineOffsetS(line.id) * 1000

describe('busState', () => {
  it('steht zu Beginn an der Endhaltestelle', () => {
    expect(busState(line, start)).toMatchObject({ distanceM: 0, direction: 0, atStop: 'Markt' })
  })
  it('fährt nach dem Aufenthalt los und hält an der Schule', () => {
    const moving = busState(line, start + (BUS_END_DWELL_S + 10) * 1000)
    expect(moving.direction).toBe(1)
    expect(moving.distanceM).toBeCloseTo(90, 0)
    const atSchool = busState(line, start + (BUS_END_DWELL_S + 500 / 9 + 5) * 1000)
    expect(atSchool).toMatchObject({ distanceM: 500, direction: 0, atStop: 'Schule' })
  })
  it('kommt zurück und der Umlauf schließt sich', () => {
    const cycle = busCycle(line)
    expect(cycle).toBeCloseTo(2 * (1000 / 9 + BUS_STOP_DWELL_S + BUS_END_DWELL_S), 3)
    const back = busState(line, start + (BUS_END_DWELL_S * 2 + 1000 / 9 + BUS_STOP_DWELL_S + 10) * 1000)
    expect(back.direction).toBe(-1)
    expect(busState(line, start + cycle * 1000)).toMatchObject({ distanceM: 0, direction: 0 })
  })
})

describe('placeStops', () => {
  it('legt Haltestellen auf die Linie und fasst Hin- und Rücksteig zusammen', () => {
    const stops = placeStops(line.points, [
      { name: 'Schule', at: { lat: 51.3001, lon: 8.0072 } },
      { name: 'Schule', at: { lat: 51.2999, lon: 8.0073 } },
      { name: 'Weit weg', at: { lat: 51.31, lon: 8.0072 } },
    ])
    expect(stops).toHaveLength(1)
    expect(stops[0].name).toBe('Schule')
    expect(stops[0].atM).toBeGreaterThan(450)
    expect(stops[0].atM).toBeLessThan(550)
  })
})

describe('busRoutesFromOverpass', () => {
  it('verbindet die Wege einer Relation und legt die Haltestellen darauf', () => {
    const lines = busRoutesFromOverpass([
      { type: 'node', id: 7, tags: { name: 'Rathaus' }, lat: 51.3, lon: 8.0072 },
      { type: 'relation', id: 42, tags: { ref: '3', name: 'Bus 3' }, members: [
        { type: 'way', ref: 1, geometry: [{ lat: 51.3, lon: 8.0 }, { lat: 51.3, lon: 8.0072 }] },
        { type: 'way', ref: 2, geometry: [{ lat: 51.3, lon: 8.0072 }, { lat: 51.3, lon: 8.0144 }] },
        { type: 'node', ref: 7, role: 'stop', lat: 51.3, lon: 8.0072 },
        { type: 'way', ref: 3, role: 'platform', geometry: [{ lat: 51.3001, lon: 8.0072 }, { lat: 51.3001, lon: 8.0073 }] },
      ] },
      { type: 'relation', id: 43, tags: { ref: '9' }, members: [{ type: 'way', ref: 4, geometry: [{ lat: 51.3, lon: 8.0 }, { lat: 51.3, lon: 8.001 }] }] },
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ id: 'osm:relation:42', name: 'Linie 3' })
    expect(lines[0].lengthM).toBeGreaterThan(950)
    expect(lines[0].stops).toEqual([{ name: 'Rathaus', atM: expect.any(Number) }])
  })
})
