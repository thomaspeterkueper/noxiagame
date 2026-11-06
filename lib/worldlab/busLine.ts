// lib/worldlab/busLine.ts
// Aktualisiert: 06.11.2026 — Buslinien mit Fahrplan für die Weltkarte (Thomas, 06.11.2026: „Bus aus Fahrplan“)
// Version:      1.0.0
//
// Eine Buslinie aus OpenStreetMap (relation route=bus) mit ihren Haltestellen.
// Der Fahrplan hängt wie beim Zug nur an der Uhrzeit, jeder Spieler sieht den
// Bus an derselben Stelle: Aufenthalt an der Endhaltestelle, Fahrt mit kurzem
// Halt an jeder Haltestelle, Aufenthalt am anderen Ende, zurück. Jede Linie hat
// einen eigenen Versatz, damit nicht alle Busse gleichzeitig abfahren.

import { metresBetween, pointAlong, type GeoPoint } from './railLine'

export type BusStop = { name: string; /** Meter ab Linienanfang */ atM: number }
export type BusLine = { id: string; name: string; points: GeoPoint[]; lengthM: number; stops: BusStop[] }

export const BUS_SPEED_MPS = 9          // rund 32 km/h im Ort
export const BUS_STOP_DWELL_S = 15      // Halt an jeder Haltestelle
export const BUS_END_DWELL_S = 180      // Aufenthalt an den Endhaltestellen

export interface BusState {
  distanceM: number
  /** +1 hin, −1 zurück, 0 steht */
  direction: 1 | -1 | 0
  /** Name der Haltestelle, an der der Bus gerade hält (sonst null) */
  atStop: string | null
}

/** Fester Versatz je Linie (Sekunden), aus der Kennung. */
export function lineOffsetS(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) % 1800
}

/** Zeitplan einer Richtung: Abschnitte (Fahrt oder Halt) mit Dauer. */
function legs(line: BusLine, forward: boolean) {
  const marks = [0, ...line.stops.map(stop => stop.atM).filter(m => m > 1 && m < line.lengthM - 1).sort((a, b) => a - b), line.lengthM]
  const ordered = forward ? marks : [...marks].reverse()
  const out: Array<{ from: number; to: number; seconds: number; stop: string | null }> = []
  for (let i = 1; i < ordered.length; i++) {
    const from = ordered[i - 1], to = ordered[i]
    out.push({ from, to, seconds: Math.max(1, Math.abs(to - from) / BUS_SPEED_MPS), stop: null })
    if (i < ordered.length - 1) {
      const stop = line.stops.find(s => Math.abs(s.atM - to) < 0.5)
      out.push({ from: to, to, seconds: BUS_STOP_DWELL_S, stop: stop?.name ?? 'Haltestelle' })
    }
  }
  return out
}

export function busCycle(line: BusLine) {
  const one = legs(line, true).reduce((s, leg) => s + leg.seconds, 0)
  return 2 * (one + BUS_END_DWELL_S)
}

/** Wo der Bus der Linie zur Zeit `nowMs` ist. */
export function busState(line: BusLine, nowMs: number): BusState {
  const plan = [
    { from: 0, to: 0, seconds: BUS_END_DWELL_S, stop: line.stops[0]?.name ?? 'Endhaltestelle', dir: 0 as const },
    ...legs(line, true).map(leg => ({ ...leg, dir: leg.stop ? 0 as const : 1 as const })),
    { from: line.lengthM, to: line.lengthM, seconds: BUS_END_DWELL_S, stop: line.stops[line.stops.length - 1]?.name ?? 'Endhaltestelle', dir: 0 as const },
    ...legs(line, false).map(leg => ({ ...leg, dir: leg.stop ? 0 as const : -1 as const })),
  ]
  const cycle = plan.reduce((s, leg) => s + leg.seconds, 0)
  let t = ((nowMs / 1000 + lineOffsetS(line.id)) % cycle + cycle) % cycle
  for (const leg of plan) {
    if (t <= leg.seconds) {
      const f = leg.seconds > 0 ? t / leg.seconds : 0
      return { distanceM: leg.from + (leg.to - leg.from) * f, direction: leg.dir, atStop: leg.stop }
    }
    t -= leg.seconds
  }
  return { distanceM: 0, direction: 0, atStop: null }
}

/** Haltestellen (Punkte) auf die Linie legen: Meter ab Anfang, nur nahe der Linie (≤ 40 m). */
export function placeStops(points: readonly GeoPoint[], stops: Array<{ name: string; at: GeoPoint }>, maxM = 40): BusStop[] {
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + metresBetween(points[i - 1], points[i]))
  const out: BusStop[] = []
  for (const stop of stops) {
    let best = Infinity, bestM = 0
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i]
      const ax = 0, ay = 0
      const bx = (b.lon - a.lon) * 111320 * Math.cos(a.lat * Math.PI / 180), by = (b.lat - a.lat) * 111320
      const px = (stop.at.lon - a.lon) * 111320 * Math.cos(a.lat * Math.PI / 180), py = (stop.at.lat - a.lat) * 111320
      const len2 = bx * bx + by * by
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len2)) : 0
      const d = Math.hypot(px - bx * t, py - by * t)
      if (d < best) { best = d; bestM = cum[i - 1] + Math.sqrt(len2) * t }
    }
    if (best <= maxM) out.push({ name: stop.name, atM: Math.round(bestM) })
  }
  // Doppelte (Hin- und Rücksteig derselben Haltestelle) zusammenlegen
  const merged: BusStop[] = []
  for (const stop of out.sort((a, b) => a.atM - b.atM)) {
    const last = merged[merged.length - 1]
    if (last && Math.abs(last.atM - stop.atM) < 60) continue
    merged.push(stop)
  }
  return merged
}

export { pointAlong }
