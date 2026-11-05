// Sichtbares Gehen von Personen (Thomas, 28.10.2026: „wichtig, dass die NPCs auch
// normal durch die Stadt oder Station laufen“).
//
// Die Simulation entscheidet weiterhin nur, WO jemand ist (Wohnung, Arbeit,
// Besuchsort; person_surface_presence). Dieses Modul legt fest, was die Karte
// zwischen zwei solchen Orten zeigt: einen Weg entlang von Straßen oder Gängen
// statt eines Sprungs. NOXIA-VISUAL-0001 erlaubt diese Interpolation ausdrücklich.
// Es erzeugt keine Spielwahrheit: Begegnungen, Gespräche und Wirtschaft hängen
// nicht an der gezeichneten Position.

import { isAsleepAction } from './circadian'

/** Zeitgerafftes Gehtempo der Figuren (m/s). Halb so schnell wie die Spielfigur (16 m/s). */
// 31.10.2026 (Thomas: „über die Karte rennen“): 8 → 4 m/s, zügiges Gehen im Zeitraffer.
export const NPC_WALK_M_PER_S = 4

/** Weiter als das wird nicht sichtbar gegangen (Bus, Auto): unterwegs unsichtbar. */
export const VISIBLE_WALK_MAX_M = 500

/** Höchstens so viele stehen sichtbar vor einem Haus; die anderen sind drinnen. */
export const ANCHOR_VISIBLE_MAX = 3

/** Seitlicher Versatz (m) des Platzes `slot` von `slots` vor einem Haus – nebeneinander, 3,2 m Abstand. */
export function anchorSpread(slot: number, slots: number): number {
  const count = Math.max(1, slots)
  return (Math.min(slot, count - 1) - (count - 1) / 2) * 3.2
}

/** Dauer eines sichtbaren Wegs: aus der Weglänge, mit Unter- und Obergrenze. */
export function commuteSeconds(lengthM: number, metersPerSecond = NPC_WALK_M_PER_S, minS = 4, maxS = 150): number {
  if (!Number.isFinite(lengthM) || lengthM <= 0) return minS
  return Math.min(maxS, Math.max(minS, lengthM / Math.max(0.1, metersPerSecond)))
}

/** Ab dieser Verschiebung des Ziels (m) geht die Figur hin, statt nur nachzurücken. */
export const COMMUTE_THRESHOLD_M = 12

export function shouldCommute(previous: { x: number; y: number } | null, next: { x: number; y: number } | null): boolean {
  if (!previous || !next) return false
  return Math.hypot(next.x - previous.x, next.y - previous.y) > COMMUTE_THRESHOLD_M
}

export type VisibleTargetKind = 'work' | 'home' | 'asleep' | 'stroll'

export interface VisibleTarget {
  kind: VisibleTargetKind
  /** Gebäude, an dem die Figur steht; bei `stroll` der Ausgangspunkt des Spaziergangs (Wohnung), sonst null. */
  tileEntityId: string | null
}

/**
 * Wohin eine Figur auf der Karte gehört, wenn kein autoritativer Ort vorliegt
 * (Station ohne Geodaten, oder Erde ohne Präsenzzeile).
 * - arbeitet → an die Arbeit
 * - schläft → in die Wohnung, nicht sichtbar
 * - ruht → in die Wohnung
 * - sonst (frei, unterwegs, gesellig) → Spaziergang in der Nähe der Wohnung
 */
export function visibleTarget(
  activityState: string | null | undefined,
  lastAction: string | null | undefined,
  assignments: ReadonlyArray<{ type: string; tileEntityId: string | null }>,
): VisibleTarget {
  const home = assignments.find(item => item.type === 'home' && item.tileEntityId)?.tileEntityId ?? null
  const work = assignments.find(item => item.type === 'work' && item.tileEntityId)?.tileEntityId ?? null
  const state = String(activityState ?? '').toLowerCase()
  if (isAsleepAction(lastAction)) return { kind: 'asleep', tileEntityId: home }
  if (/work|inspect|produc|serv|operat/.test(state) && work) return { kind: 'work', tileEntityId: work }
  if (/rest|sleep/.test(state) && home) return { kind: 'home', tileEntityId: home }
  return { kind: 'stroll', tileEntityId: home }
}

/** Länge eines Linienzugs (m). */
export function pathLength(points: ReadonlyArray<{ x: number; y: number }>): number {
  let sum = 0
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return sum
}

/** Punkt in `distance` Metern entlang eines Linienzugs. */
export function pointAlong(points: ReadonlyArray<{ x: number; y: number }>, distance: number): { x: number; y: number } {
  if (!points.length) return { x: 0, y: 0 }
  let rest = Math.max(0, distance)
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y)
    if (rest <= length) return { x: a.x + (b.x - a.x) * rest / Math.max(length, 0.001), y: a.y + (b.y - a.y) * rest / Math.max(length, 0.001) }
    rest -= length
  }
  return points[points.length - 1]
}

/** Strecke entlang des Linienzugs bis zum Eckpunkt, der `point` am nächsten liegt – damit ein Spaziergang dort beginnt, wo die Figur gerade ist. */
export function distanceToNearestVertex(points: ReadonlyArray<{ x: number; y: number }>, point: { x: number; y: number }): number {
  let best = Infinity, bestAlong = 0, along = 0
  for (let i = 0; i < points.length; i++) {
    if (i > 0) along += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    const d = Math.hypot(points[i].x - point.x, points[i].y - point.y)
    if (d < best) { best = d; bestAlong = along }
  }
  return bestAlong
}
