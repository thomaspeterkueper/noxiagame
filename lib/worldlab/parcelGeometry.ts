// lib/worldlab/parcelGeometry.ts
// Flurstücke teilen und zusammenlegen (Thomas, 25.10.2026).
//
// Teilen: Schnitt durch einen Punkt, quer oder längs zur Hauptrichtung des Flurstücks.
// Zusammenlegen: Die gemeinsame Grenze fällt weg. Das klappt nur, wenn die beiden
// Flurstücke sich eine Kante mit denselben Eckpunkten teilen – im Kataster ist das
// so, bei geteilten Stücken auch (beide Hälften rechnen den Schnittpunkt gleich).

export type GeoPoint = { lat: number; lon: number }
type XY = { x: number; y: number }

const M_PER_DEG = 111_320
const round7 = (v: number) => Math.round(v * 1e7) / 1e7
const keyOf = (p: GeoPoint) => `${round7(p.lat)},${round7(p.lon)}`

function frame(ring: readonly GeoPoint[]) {
  const lat0 = ring[0].lat, lon0 = ring[0].lon, k = Math.cos(lat0 * Math.PI / 180) * M_PER_DEG
  return {
    toXY: (p: GeoPoint): XY => ({ x: (p.lon - lon0) * k, y: (p.lat - lat0) * M_PER_DEG }),
    toGeo: (p: XY): GeoPoint => ({ lat: round7(lat0 + p.y / M_PER_DEG), lon: round7(lon0 + p.x / k) }),
  }
}

function signedArea(points: readonly XY[]) {
  let sum = 0
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; sum += a.x * b.y - b.x * a.y }
  return sum / 2
}

export function areaM2(ring: readonly GeoPoint[]) {
  if (ring.length < 3) return 0
  return Math.abs(signedArea(ring.map(frame(ring).toXY)))
}

/** Hauptrichtung (Winkel in Bogenmaß) aus der Streuung der Eckpunkte. */
export function mainAxis(ring: readonly GeoPoint[]) {
  const pts = ring.map(frame(ring).toXY)
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length
  let sxx = 0, syy = 0, sxy = 0
  for (const p of pts) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my) }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy)
}

/** Ein Flurstück an einer Geraden durch `at` in zwei Teile schneiden. */
export function splitRing(ring: readonly GeoPoint[], at: GeoPoint, direction: 'across' | 'along'): [GeoPoint[], GeoPoint[]] | null {
  if (ring.length < 3) return null
  const f = frame(ring)
  const pts = ring.map(f.toXY), c = f.toXY(at)
  const axis = mainAxis(ring) + (direction === 'across' ? Math.PI / 2 : 0)
  // Normale der Schnittlinie
  const nx = -Math.sin(axis), ny = Math.cos(axis)
  const side = (p: XY) => (p.x - c.x) * nx + (p.y - c.y) * ny
  const clip = (keep: 1 | -1) => {
    const out: XY[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      const sa = side(a) * keep, sb = side(b) * keep
      if (sa >= 0) out.push(a)
      if ((sa >= 0) !== (sb >= 0)) {
        // Schnittpunkt immer von der Kante a→b in Laufrichtung – beide Hälften bekommen denselben Punkt
        const t = side(a) / (side(a) - side(b))
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      }
    }
    return out
  }
  const toRing = (points: XY[]) => {
    const geo = points.map(f.toGeo)
    return geo.filter((p, i) => keyOf(p) !== keyOf(geo[(i + 1) % geo.length]))
  }
  // Originale Eckpunkte unverändert übernehmen (keine Rundung hin und zurück)
  const keepOriginal = (points: XY[]) => toRing(points).map(p => ring.find(q => Math.abs(q.lat - p.lat) < 2e-7 && Math.abs(q.lon - p.lon) < 2e-7) ?? p)
  const a = keepOriginal(clip(1)), b = keepOriginal(clip(-1))
  if (a.length < 3 || b.length < 3) return null
  return [a, b]
}

/**
 * Zwei Flurstücke zu einem verschmelzen: Kanten, die beide (gegenläufig) haben, fallen weg,
 * der Rest wird zu einem Ring verkettet. null, wenn sie keine gemeinsame Kante haben
 * oder kein einfacher Ring herauskommt (z. B. ein Loch entstünde).
 */
export function mergeRings(first: readonly GeoPoint[], second: readonly GeoPoint[]): GeoPoint[] | null {
  if (first.length < 3 || second.length < 3) return null
  const orient = (ring: readonly GeoPoint[]) => {
    const pts = ring.map(frame(first).toXY)
    return signedArea(pts) < 0 ? [...ring].reverse() : [...ring]
  }
  const rings = [orient(first), orient(second)]
  const point = new Map<string, GeoPoint>()
  const edges: Array<[string, string]> = []
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = keyOf(ring[i]), b = keyOf(ring[(i + 1) % ring.length])
    if (a === b) continue
    point.set(a, ring[i])
    edges.push([a, b])
  }
  const count = new Map<string, number>()
  for (const [a, b] of edges) count.set(`${a}>${b}`, (count.get(`${a}>${b}`) ?? 0) + 1)
  let removed = 0
  const kept = edges.filter(([a, b]) => {
    if (count.get(`${b}>${a}`)) { removed++; return false }
    return true
  })
  if (!removed) return null
  const next = new Map<string, string>()
  for (const [a, b] of kept) {
    if (next.has(a)) return null // Berührung in einem Punkt – kein einfacher Ring
    next.set(a, b)
  }
  const start = kept[0][0]
  const out: GeoPoint[] = []
  let at = start
  for (let guard = 0; guard <= kept.length; guard++) {
    out.push(point.get(at)!)
    const to = next.get(at)
    if (!to) return null
    at = to
    if (at === start) break
  }
  if (at !== start || out.length !== kept.length) return null
  // Eckpunkte der alten Grenze bleiben: Nachbarn teilen sie womöglich, sonst ließe sich später nicht mehr verschmelzen.
  return out.length >= 3 ? out : null
}

export function centreOf(ring: readonly GeoPoint[]) {
  return { lat: ring.reduce((s, p) => s + p.lat, 0) / ring.length, lon: ring.reduce((s, p) => s + p.lon, 0) / ring.length }
}

export function boundsOf(ring: readonly GeoPoint[]) {
  const lats = ring.map(p => p.lat), lons = ring.map(p => p.lon)
  return { min_lat: Math.min(...lats), max_lat: Math.max(...lats), min_lon: Math.min(...lons), max_lon: Math.max(...lons) }
}
