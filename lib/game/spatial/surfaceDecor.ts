// lib/game/spatial/surfaceDecor.ts
// Gelände um eine lokale Szene auf Phobos, Deimos oder dem Mond (Thomas,
// 27.10.2026: „Stickney sieht furchtbar aus“ – die Basis schwebte auf einer
// leeren braunen Fläche). Erzeugt festgelegte Krater, Felsbrocken und – auf
// Phobos – die typischen parallelen Rillen. Immer gleich für denselben Ort
// (Seed aus dem Ortsnamen), nie auf Gebäuden oder Wegen.

import type { LocalSurfacePoint } from './localSurfaceScene'

export interface SurfaceCrater { xM: number; yM: number; rM: number }
export interface SurfaceBoulder { xM: number; yM: number; rM: number; seed: number }
export interface SurfaceGroove { from: LocalSurfacePoint; to: LocalSurfacePoint }
/** Brandfleck unter einem Landeplatz: dunkler Hof, wo Triebwerke den Staub weggeblasen haben. */
export interface SurfaceScorch { xM: number; yM: number; rM: number }
/** Fahrspur eines Rovers im Staub (zwei Reifen, leicht geschwungen). */
export interface SurfaceTrail { points: LocalSurfacePoint[] }
export interface SurfaceDecor { craters: SurfaceCrater[]; boulders: SurfaceBoulder[]; grooves: SurfaceGroove[]; scorches: SurfaceScorch[]; trails: SurfaceTrail[] }

export interface SurfaceKeepOut {
  buildings: Array<{ center: LocalSurfacePoint; widthM: number; depthM: number }>
  paths: Array<{ points: LocalSurfacePoint[] }>
}

/** Kleiner, festgelegter Zufallsgenerator (mulberry32). */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedOf(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function distanceToSegment(p: LocalSurfacePoint, a: LocalSurfacePoint, b: LocalSurfacePoint) {
  const dx = b.xM - a.xM, dy = b.yM - a.yM
  const length2 = dx * dx + dy * dy
  const t = length2 > 0 ? Math.max(0, Math.min(1, ((p.xM - a.xM) * dx + (p.yM - a.yM) * dy) / length2)) : 0
  return Math.hypot(p.xM - (a.xM + dx * t), p.yM - (a.yM + dy * t))
}

/** Abstand eines Punktes zum nächsten Gebäude (Rand, grob als Kreis) oder Weg. */
export function clearanceM(point: LocalSurfacePoint, keepOut: SurfaceKeepOut) {
  let best = Infinity
  for (const building of keepOut.buildings) {
    const radius = Math.hypot(building.widthM, building.depthM) / 2
    best = Math.min(best, Math.hypot(point.xM - building.center.xM, point.yM - building.center.yM) - radius)
  }
  for (const path of keepOut.paths) {
    for (let i = 1; i < path.points.length; i++) best = Math.min(best, distanceToSegment(point, path.points[i - 1], path.points[i]))
  }
  return best
}

/**
 * Gelände in einem Quadrat von ±`extentM` um die Mitte.
 * Phobos: viele kleine Krater, Rillen in einer Richtung. Mond: mehr und
 * größere Krater, keine Rillen. Krater halten Abstand zu Gebäuden und Wegen.
 */
export function buildSurfaceDecor(input: {
  body: string; seedKey: string; extentM: number; keepOut: SurfaceKeepOut
  /** Spuren von Betrieb: Landeplätze (Brandfleck) und Fahrzeughöfe (Fahrspuren ins Gelände). */
  activity?: { pads?: Array<{ center: LocalSurfacePoint; widthM: number; depthM: number }>; yards?: Array<{ center: LocalSurfacePoint }> }
}): SurfaceDecor {
  const random = seededRandom(seedOf(input.body + ':' + input.seedKey))
  const extent = input.extentM
  const pick = () => ({ xM: (random() * 2 - 1) * extent, yM: (random() * 2 - 1) * extent })
  const moon = input.body === 'moon'
  const craters: SurfaceCrater[] = []
  const craterCount = moon ? 70 : 55
  for (let tries = 0; craters.length < craterCount && tries < craterCount * 12; tries++) {
    const at = pick()
    // Größenverteilung: viele kleine, wenige große (r von 3 bis 40 m)
    const rM = 3 + Math.pow(random(), 3) * (moon ? 42 : 34)
    if (clearanceM(at, input.keepOut) < rM + 6) continue
    if (craters.some(other => Math.hypot(other.xM - at.xM, other.yM - at.yM) < (other.rM + rM) * 0.9)) continue
    craters.push({ ...at, rM: Math.round(rM * 10) / 10 })
  }
  const boulders: SurfaceBoulder[] = []
  for (let tries = 0; boulders.length < 90 && tries < 900; tries++) {
    const at = pick()
    const rM = 0.6 + Math.pow(random(), 2) * 2.6
    if (clearanceM(at, input.keepOut) < rM + 3) continue
    boulders.push({ ...at, rM: Math.round(rM * 10) / 10, seed: Math.floor(random() * 1e6) })
  }
  const grooves: SurfaceGroove[] = []
  if (input.body === 'phobos') {
    // Rillen: lange, fast parallele Furchen (auf Phobos rund 100–200 m breit
    // gestaffelt, hier verdichtet), leicht schräg zur Szene.
    const angle = -0.42
    const dir = { x: Math.cos(angle), y: Math.sin(angle) }, normal = { x: -dir.y, y: dir.x }
    for (let offset = -extent; offset <= extent; offset += 38 + random() * 34) {
      const shift = (random() * 2 - 1) * extent * 0.4
      const half = extent * (0.6 + random() * 0.5)
      const centre = { x: normal.x * offset + dir.x * shift, y: normal.y * offset + dir.y * shift }
      grooves.push({ from: { xM: centre.x - dir.x * half, yM: centre.y - dir.y * half }, to: { xM: centre.x + dir.x * half, yM: centre.y + dir.y * half } })
    }
  }
  const scorches: SurfaceScorch[] = (input.activity?.pads ?? []).map(pad => ({ xM: pad.center.xM, yM: pad.center.yM, rM: Math.max(pad.widthM, pad.depthM) * 0.85 }))
  const trails: SurfaceTrail[] = []
  for (const yard of input.activity?.yards ?? []) {
    // Drei bis vier Fahrten ins Gelände: vom Hof weg, mit sanften Kurven, 120–260 m lang.
    const count = 3 + Math.floor(random() * 2)
    for (let i = 0; i < count; i++) {
      let heading = random() * Math.PI * 2
      let at = { xM: yard.center.xM, yM: yard.center.yM }
      const points = [at]
      const length = 120 + random() * 140
      for (let travelled = 0; travelled < length; travelled += 12) {
        heading += (random() - 0.5) * 0.5
        at = { xM: at.xM + Math.cos(heading) * 12, yM: at.yM + Math.sin(heading) * 12 }
        if (Math.abs(at.xM) > extent || Math.abs(at.yM) > extent) break
        points.push(at)
      }
      if (points.length > 2) trails.push({ points })
    }
  }
  return { craters, boulders, grooves, scorches, trails }
}
