import { describe, expect, it } from 'vitest'
import { STATION_LAYOUTS, STATION_SLUGS, stationCorridors } from './stationLayouts'

type Rect = { x0: number; x1: number; y0: number; y1: number }
const rect = (m: { xM: number; yM: number; widthM: number; depthM: number }): Rect => ({ x0: m.xM - m.widthM / 2, x1: m.xM + m.widthM / 2, y0: m.yM - m.depthM / 2, y1: m.yM + m.depthM / 2 })
const gap = (a: Rect, b: Rect) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1))
const inside = (r: Rect, p: { xM: number; yM: number }, tol = 0.01) => p.xM >= r.x0 - tol && p.xM <= r.x1 + tol && p.yM >= r.y0 - tol && p.yM <= r.y1 + tol

describe('Stationslagepläne', () => {
  for (const slug of STATION_SLUGS) {
    const { modules, passages } = STATION_LAYOUTS[slug]
    it(`${slug}: Module halten mindestens 8 m Abstand`, () => {
      for (let i = 0; i < modules.length; i++) for (let j = i + 1; j < modules.length; j++) {
        expect(gap(rect(modules[i]), rect(modules[j])), `${modules[i].key} ↔ ${modules[j].key}`).toBeGreaterThanOrEqual(8)
      }
    })
    it(`${slug}: Ids und Schlüssel sind eindeutig`, () => {
      expect(new Set(modules.map(m => m.id)).size).toBe(modules.length)
      expect(new Set(modules.map(m => m.key)).size).toBe(modules.length)
    })
    it(`${slug}: jedes Modul liegt an einem Gang`, () => {
      for (const m of modules) {
        const r = rect(m)
        const touched = passages.some(p => p.points.some(pt => inside(r, pt)))
        expect(touched, m.key).toBe(true)
      }
    })
    it(`${slug}: Druckmodule sind über Druckgänge mit dem Zentralmodul verbunden`, () => {
      const open = /solar|scanner/
      const pressurized = passages.filter(p => p.pressurized)
      const key = (pt: { xM: number; yM: number }) => `${pt.xM},${pt.yM}`
      // Knoten: Gangenden und Kreuzungen; hier genügt die Verbindung über gemeinsame Endpunkte oder Modulflächen.
      const parent = new Map<string, string>()
      const find = (k: string): string => { if (!parent.has(k)) parent.set(k, k); const p = parent.get(k)!; if (p === k) return k; const r = find(p); parent.set(k, r); return r }
      const union = (a: string, b: string) => parent.set(find(a), find(b))
      for (const p of pressurized) for (let i = 1; i < p.points.length; i++) union(key(p.points[0]), key(p.points[i]))
      // Gänge, die sich an Endpunkten oder auf einem anderen Gang treffen, verbinden
      for (const a of pressurized) for (const b of pressurized) {
        if (a === b) continue
        for (const pt of a.points) {
          for (let i = 1; i < b.points.length; i++) {
            const [p, q] = [b.points[i - 1], b.points[i]]
            const dx = q.xM - p.xM, dy = q.yM - p.yM
            const t = Math.max(0, Math.min(1, ((pt.xM - p.xM) * dx + (pt.yM - p.yM) * dy) / (dx * dx + dy * dy || 1)))
            if (Math.hypot(p.xM + dx * t - pt.xM, p.yM + dy * t - pt.yM) < 0.01) union(key(pt), key(b.points[0]))
          }
        }
      }
      const first = modules[0]
      const hub = pressurized.find(p => p.points.some(pt => inside(rect(first), pt)))!
      for (const m of modules.filter(x => !open.test(x.entityId))) {
        const g = pressurized.find(p => p.points.some(pt => inside(rect(m), pt)))
        expect(g, m.key).toBeTruthy()
        expect(find(key(g!.points[0])), m.key).toBe(find(key(hub.points[0])))
      }
    })
    it(`${slug}: Gänge liefern Szenenformat`, () => {
      const corridors = stationCorridors(slug)
      expect(corridors.length).toBe(passages.length)
      expect(corridors.every(c => c.points.length >= 2)).toBe(true)
    })
  }
})
