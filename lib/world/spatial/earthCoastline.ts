// lib/world/spatial/earthCoastline.ts
// Aktualisiert: 12.10.2026 — Meeresflächen aus OSM-Küstenlinien innerhalb eines Kartenausschnitts ableiten
// Version:      1.0.0

export type CoastPoint = { lat: number; lon: number }
export type CoastBounds = { south: number; west: number; north: number; east: number }

type Piece = { points: CoastPoint[]; sIn: number; sOut: number }

const EPS = 1e-9

function same(a: CoastPoint, b: CoastPoint) {
  return Math.abs(a.lat - b.lat) < EPS && Math.abs(a.lon - b.lon) < EPS
}

/** Joins coastline ways that share end nodes into continuous chains. */
function joinChains(ways: CoastPoint[][]) {
  const open = ways.filter(way => way.length >= 2).map(way => way.slice())
  const chains: CoastPoint[][] = []
  while (open.length) {
    let chain = open.pop()!
    let grown = true
    while (grown && !same(chain[0], chain[chain.length - 1])) {
      grown = false
      for (let i = 0; i < open.length; i++) {
        const way = open[i]
        if (same(chain[chain.length - 1], way[0])) chain = [...chain, ...way.slice(1)]
        else if (same(way[way.length - 1], chain[0])) chain = [...way, ...chain.slice(1)]
        else continue
        open.splice(i, 1)
        grown = true
        break
      }
    }
    chains.push(chain)
  }
  return chains
}

function inside(point: CoastPoint, b: CoastBounds) {
  return point.lat >= b.south && point.lat <= b.north && point.lon >= b.west && point.lon <= b.east
}

/** Liang–Barsky: the part of segment a→b inside the bounds as parameters t0..t1. */
function clipSegment(a: CoastPoint, b: CoastPoint, bounds: CoastBounds): [number, number] | null {
  let t0 = 0, t1 = 1
  const dx = b.lon - a.lon, dy = b.lat - a.lat
  const checks: Array<[number, number]> = [
    [-dx, a.lon - bounds.west], [dx, bounds.east - a.lon],
    [-dy, a.lat - bounds.south], [dy, bounds.north - a.lat],
  ]
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-15) { if (q < 0) return null; continue }
    const r = q / p
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r }
    else { if (r < t0) return null; if (r < t1) t1 = r }
  }
  return t1 - t0 > 1e-12 ? [t0, t1] : null
}

function lerp(a: CoastPoint, b: CoastPoint, t: number): CoastPoint {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t }
}

/** Clockwise position on the border, 0 at the north-west corner, 0..4. */
function borderPosition(point: CoastPoint, b: CoastBounds) {
  const w = b.east - b.west, h = b.north - b.south
  const dTop = Math.abs(point.lat - b.north) / h, dRight = Math.abs(point.lon - b.east) / w
  const dBottom = Math.abs(point.lat - b.south) / h, dLeft = Math.abs(point.lon - b.west) / w
  const nearest = Math.min(dTop, dRight, dBottom, dLeft)
  const clamp = (value: number) => Math.max(0, Math.min(1, value))
  if (nearest === dTop) return clamp((point.lon - b.west) / w)
  if (nearest === dRight) return 1 + clamp((b.north - point.lat) / h)
  if (nearest === dBottom) return 2 + clamp((b.east - point.lon) / w)
  return 3 + clamp((point.lat - b.south) / h)
}

function corner(index: number, b: CoastBounds): CoastPoint {
  switch (((index % 4) + 4) % 4) {
    case 0: return { lat: b.north, lon: b.west }
    case 1: return { lat: b.north, lon: b.east }
    case 2: return { lat: b.south, lon: b.east }
    default: return { lat: b.south, lon: b.west }
  }
}

function clipChain(chain: CoastPoint[], bounds: CoastBounds) {
  const pieces: CoastPoint[][] = []
  let current: CoastPoint[] | null = null
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], b = chain[i + 1]
    const clip = clipSegment(a, b, bounds)
    if (!clip) { if (current) { pieces.push(current); current = null } continue }
    const start = lerp(a, b, clip[0]), end = lerp(a, b, clip[1])
    if (!current) current = [start]
    else if (clip[0] > 1e-12) { pieces.push(current); current = [start] }
    current.push(end)
    if (clip[1] < 1 - 1e-12) { pieces.push(current); current = null }
  }
  if (current) pieces.push(current)
  return pieces.filter(piece => piece.length >= 2)
}

/**
 * Sea polygons inside `bounds`, derived from OSM `natural=coastline` ways.
 *
 * OSM draws coastlines with land on the left and water on the right. Each
 * coastline piece crossing the view is therefore closed clockwise along the
 * view border, which encloses exactly the water side. Coastline rings lying
 * completely inside the view are islands and are returned separately.
 */
export function seaPolygonsFromCoastlines(ways: CoastPoint[][], bounds: CoastBounds) {
  const sea: CoastPoint[][] = []
  const islands: CoastPoint[][] = []
  const pieces: Piece[] = []

  for (const chain of joinChains(ways)) {
    const closed = chain.length >= 4 && same(chain[0], chain[chain.length - 1])
    if (closed && chain.every(point => inside(point, bounds))) { islands.push(chain); continue }
    for (const points of clipChain(chain, bounds)) {
      const first = points[0], last = points[points.length - 1]
      // A coastline that simply ends inside the view (data gap) cannot be closed reliably.
      const touches = (point: CoastPoint) => Math.min(
        Math.abs(point.lat - bounds.north), Math.abs(point.lat - bounds.south),
      ) < 1e-7 || Math.min(Math.abs(point.lon - bounds.west), Math.abs(point.lon - bounds.east)) < 1e-7
      if (!touches(first) || !touches(last)) continue
      pieces.push({ points, sIn: borderPosition(first, bounds), sOut: borderPosition(last, bounds) })
    }
  }

  const used = new Set<Piece>()
  for (const start of pieces) {
    if (used.has(start)) continue
    const polygon: CoastPoint[] = []
    let piece = start
    for (let guard = 0; guard <= pieces.length; guard++) {
      used.add(piece)
      polygon.push(...piece.points)
      const from = piece.sOut
      let next = start, best = Infinity
      for (const candidate of pieces) {
        if (candidate !== start && used.has(candidate)) continue
        let gap = candidate.sIn - from
        if (gap < 0) gap += 4
        if (gap < best) { best = gap; next = candidate }
      }
      for (let c = Math.floor(from) + 1; c <= from + best; c++) polygon.push(corner(c, bounds))
      if (next === start) break
      piece = next
    }
    if (polygon.length >= 3) { polygon.push(polygon[0]); sea.push(polygon) }
  }
  return { sea, islands }
}
