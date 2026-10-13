// lib/worldlab/simplify.ts
// Macht aus den importierten Kartendaten eine stark vereinfachte Kachel:
// drei Straßenklassen, vier Flächenarten, Gewässerlinien und Gebäude als
// Blöcke (Rechteck mit Lage, Größe, Drehung und Art). Reine Funktion.
//
// Koordinaten in der Kachel: Meter am Boden, x nach Osten, y nach Süden,
// gemessen ab der Nordwestecke der Kachel.

import { geoToMerc, mercPerGroundMetre, mercToGeo, tileOrigin, TILE_SIZE_MERC, type GeoPoint, type TileId } from './mercator'

export interface SourceFeature {
  id: string
  featureType: string
  geometry: { kind: 'point' | 'line' | 'polygon'; coordinates: GeoPoint | GeoPoint[] }
  properties?: Record<string, unknown> | null
}

export type RoadClass = 'main' | 'street' | 'path'
export type AreaKind = 'water' | 'forest' | 'field' | 'built' | 'garden' | 'grounds' | 'track' | 'pitch'
export type BlockKind = 'house' | 'row' | 'hall' | 'factory' | 'church' | 'shed'

export interface TileRoad { c: RoadClass; p: number[] }
export interface TileArea { k: AreaKind; p: number[] }
export interface TileBlock {
  x: number; y: number; w: number; d: number; a: number; k: BlockKind; l: number
  /** Echter Grundriss (Meter in der Kachel, x/y abwechselnd) – nur bei Hallen und Fabriken, deren Form kein Rechteck ist. */
  f?: number[]
}
export interface SimplifiedTile {
  z: number
  x: number
  y: number
  /** Kantenlänge der Kachel in Bodenmetern. */
  size: number
  roads: TileRoad[]
  rivers: number[][]
  /** Platzmarkierungen (weiße Linien, x/y abwechselnd) – nur in der Kachel, in der die Platzmitte liegt. */
  marks?: number[][]
  areas: TileArea[]
  blocks: TileBlock[]
}

const ROAD_CLASS: Record<string, RoadClass> = {
  motorway: 'main', trunk: 'main', primary: 'main', secondary: 'main',
  tertiary: 'street', residential: 'street', unclassified: 'street', living_street: 'street', service: 'street', pedestrian: 'street',
  footway: 'path', path: 'path', track: 'path', cycleway: 'path',
}
const AREA_KIND: Record<string, AreaKind> = {
  water: 'water', forest: 'forest', vegetation: 'forest', farmland: 'field', urban: 'built', industrial: 'built', sport: 'pitch',
}

/** Sportflächen: Anlage (Stadion, Sportzentrum), Laufbahn, Spielfeld. */
function areaKind(featureType: string, properties: Record<string, unknown>): AreaKind | undefined {
  const tag = String(properties.visual_class ?? properties.landuse ?? properties.leisure ?? properties.natural ?? '')
  // Gärten: Wohngebiete bestehen in Wirklichkeit großteils aus Gärten, OSM trägt
  // sie aber nicht einzeln ein. Gewerbe, Handel und Industrie bleiben „bebaut“.
  if (featureType === 'urban') return tag === 'commercial' || tag === 'retail' ? 'built' : 'garden'
  // Parks und Rasen sind Gärten, kein Wald; Gebüsch, Heide, Feuchtgebiet bleiben dunkel.
  if (featureType === 'vegetation' && /^(park|grass|grassland|village_green|recreation_ground)$/.test(tag)) return 'garden'
  if (featureType !== 'sport') return AREA_KIND[featureType]
  const leisure = String(properties.visual_class ?? properties.leisure ?? '')
  return leisure === 'track' ? 'track' : leisure === 'stadium' || leisure === 'sports_centre' ? 'grounds' : 'pitch'
}

type P = { x: number; y: number }
const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * Schneidet ein Vieleck auf das Quadrat [lo, hi]² zu (Sutherland–Hodgman).
 * Jede Kachel zeichnet so nur ihren eigenen Teil einer Fläche: Nachbarkacheln
 * überdecken sich nicht, und eine später geladene Kachel kann die Straßen der
 * früheren nicht mehr zudecken.
 */
export function clipToSquare(points: readonly P[], lo: number, hi: number): P[] {
  let ring = [...points]
  if (ring.length > 1 && ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y) ring.pop()
  const edges: Array<{ inside: (p: P) => boolean; cut: (a: P, b: P) => P }> = [
    { inside: p => p.x >= lo, cut: (a, b) => ({ x: lo, y: a.y + (b.y - a.y) * (lo - a.x) / (b.x - a.x) }) },
    { inside: p => p.x <= hi, cut: (a, b) => ({ x: hi, y: a.y + (b.y - a.y) * (hi - a.x) / (b.x - a.x) }) },
    { inside: p => p.y >= lo, cut: (a, b) => ({ x: a.x + (b.x - a.x) * (lo - a.y) / (b.y - a.y), y: lo }) },
    { inside: p => p.y <= hi, cut: (a, b) => ({ x: a.x + (b.x - a.x) * (hi - a.y) / (b.y - a.y), y: hi }) },
  ]
  for (const edge of edges) {
    if (!ring.length) break
    const out: P[] = []
    for (let i = 0; i < ring.length; i++) {
      const current = ring[i], previous = ring[(i + ring.length - 1) % ring.length]
      const inNow = edge.inside(current), inBefore = edge.inside(previous)
      if (inNow) { if (!inBefore) out.push(edge.cut(previous, current)); out.push(current) }
      else if (inBefore) out.push(edge.cut(previous, current))
    }
    ring = out
  }
  if (ring.length < 3) return []
  return [...ring, ring[0]]
}

/** Douglas–Peucker: lässt Punkte weg, die weniger als `tolerance` Meter ausmachen. */
export function simplifyLine(points: readonly P[], tolerance: number): P[] {
  if (points.length <= 2) return [...points]
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = keep[points.length - 1] = true
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length) {
    const [from, to] = stack.pop() as [number, number]
    const a = points[from], b = points[to]
    const dx = b.x - a.x, dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    let worst = 0, index = -1
    for (let i = from + 1; i < to; i++) {
      const p = points[i]
      const distance = length > 0 ? Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / length : Math.hypot(p.x - a.x, p.y - a.y)
      if (distance > worst) { worst = distance; index = i }
    }
    if (index >= 0 && worst > tolerance) { keep[index] = true; stack.push([from, index], [index, to]) }
  }
  return points.filter((_, i) => keep[i])
}

/** Kleinstes umschließendes Rechteck entlang einer der Kanten – so steht ein Haus, wie es gebaut ist. */
export function orientedBox(points: readonly P[]): { x: number; y: number; w: number; d: number; a: number } | null {
  if (points.length < 3) return null
  let best: { x: number; y: number; w: number; d: number; a: number; area: number } | null = null
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length]
    const edge = Math.hypot(q.x - p.x, q.y - p.y)
    if (edge < 0.5) continue
    const angle = Math.atan2(q.y - p.y, q.x - p.x)
    const cos = Math.cos(-angle), sin = Math.sin(-angle)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const point of points) {
      const rx = point.x * cos - point.y * sin, ry = point.x * sin + point.y * cos
      if (rx < minX) minX = rx
      if (rx > maxX) maxX = rx
      if (ry < minY) minY = ry
      if (ry > maxY) maxY = ry
    }
    const area = (maxX - minX) * (maxY - minY)
    if (!best || area < best.area) {
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
      const back = Math.cos(angle), backSin = Math.sin(angle)
      best = { x: cx * back - cy * backSin, y: cx * backSin + cy * back, w: maxX - minX, d: maxY - minY, a: angle, area }
    }
  }
  if (!best) return null
  // Die lange Seite ist die Breite; der Winkel liegt zwischen -90° und 90°.
  let { w, d, a } = best
  if (d > w) { [w, d] = [d, w]; a += Math.PI / 2 }
  while (a > Math.PI / 2) a -= Math.PI
  while (a <= -Math.PI / 2) a += Math.PI
  return { x: best.x, y: best.y, w, d, a }
}

/** Blockart eines Gebäudes aus seinen Kartentags und Grundmaßen (Meter). */
export function blockKind(properties: Record<string, unknown>, w: number, d: number): BlockKind {
  const tag = String(properties.visual_class ?? properties.building ?? '').toLowerCase()
  const area = w * d
  if (/church|chapel|cathedral|mosque|synagogue|temple/.test(tag) || properties.amenity === 'place_of_worship') return 'church'
  if (/industrial|warehouse|commercial|retail|supermarket|hangar|factory|manufacture/.test(tag) || area > 700) return 'hall'
  if (/garage|shed|hut|carport|roof|barn/.test(tag) || area < 45) return 'shed'
  if (/apartments|terrace|dormitory|school|hospital|office|public|civic|hotel/.test(tag) || w > 26) return 'row'
  return 'house'
}

/**
 * Blockart in der Weltkarte: wie `blockKind`, aber Industriebauten werden zur
 * Fabrik (Sheddach, Wellblech). `blockKind` selbst bleibt unverändert, weil die
 * begehbare Erdszene es ebenfalls nutzt.
 */
export function worldBlockKind(properties: Record<string, unknown>, w: number, d: number): BlockKind {
  const kind = blockKind(properties, w, d)
  const tag = String(properties.visual_class ?? properties.building ?? '').toLowerCase()
  return kind === 'hall' && /industrial|factory|manufacture|works/.test(tag) ? 'factory' : kind
}

/**
 * Markierungen eines Fußballplatzes: Mittellinie, Anstoßkreis, Straf- und
 * Torräume an beiden Enden. Maße nach Regelwerk, bei kleinen Plätzen
 * verhältnisgleich verkleinert. Rückgabe in denselben Koordinaten wie `box`.
 */
export function pitchMarkings(box: { x: number; y: number; w: number; d: number; a: number }): P[][] {
  const cos = Math.cos(box.a), sin = Math.sin(box.a)
  const at = (lx: number, ly: number): P => ({ x: box.x + lx * cos - ly * sin, y: box.y + lx * sin + ly * cos })
  const hw = box.w / 2, hd = box.d / 2
  const scale = Math.min(1, box.d / 68)               // Regelbreite 68 m
  const lines: P[][] = [[at(0, -hd), at(0, hd)]]       // Mittellinie quer zur Längsachse
  const r = 9.15 * scale
  lines.push(Array.from({ length: 25 }, (_, i) => { const t = i / 24 * Math.PI * 2; return at(Math.cos(t) * r, Math.sin(t) * r) }))
  for (const end of [-1, 1]) {
    for (const [depth, width] of [[16.5, 40.3], [5.5, 18.3]]) {
      const dx = Math.min(depth * scale, hw * 0.4), hy = Math.min(width * scale, box.d * 0.9) / 2
      lines.push([at(end * hw, -hy), at(end * (hw - dx), -hy), at(end * (hw - dx), hy), at(end * hw, hy)])
    }
  }
  return lines
}

/** Fläche eines Vielecks (Shoelace, Betrag). */
function polygonArea(points: readonly P[]): number {
  let sum = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) sum += (points[j].x + points[i].x) * (points[j].y - points[i].y)
  return Math.abs(sum) / 2
}

function levels(properties: Record<string, unknown>, kind: BlockKind): number {
  const tagged = Number(properties['building:levels'])
  if (Number.isFinite(tagged) && tagged >= 1) return Math.min(8, Math.round(tagged))
  // Gesamthöhe in Metern (OSM height), abzüglich Dach, durch Geschosshöhe – grob wie blocks.ts.
  const height = Number.parseFloat(String(properties.height ?? ''))
  if (Number.isFinite(height) && height > 2) {
    const storey = kind === 'factory' ? 5 : kind === 'hall' ? 4 : kind === 'church' ? 3.5 : kind === 'shed' ? 2.5 : 3
    const roof = kind === 'church' ? 5 : kind === 'house' ? 2.4 : kind === 'row' ? 2 : kind === 'factory' ? 1.2 : 0.7
    return Math.max(1, Math.min(8, Math.round((height - roof) / storey)))
  }
  return kind === 'shed' ? 1 : kind === 'hall' || kind === 'factory' ? 2 : kind === 'row' ? 3 : kind === 'church' ? 4 : 2
}

/**
 * Baut die Kachel `tile` aus den Kartenobjekten. Dieselbe Quelle darf mehrfach
 * vorkommen (Orte überlappen sich im Import) – gezählt wird jedes Objekt einmal.
 */
export function buildTile(features: readonly SourceFeature[], tile: TileId, z: number): SimplifiedTile {
  const origin = tileOrigin(tile)
  const lat = mercToGeo({ x: origin.x + TILE_SIZE_MERC / 2, y: origin.y - TILE_SIZE_MERC / 2 }).lat
  const k = mercPerGroundMetre(lat)
  const size = TILE_SIZE_MERC / k
  const local = (point: GeoPoint): P => {
    const merc = geoToMerc(point)
    return { x: (merc.x - origin.x) / k, y: (origin.y - merc.y) / k }
  }
  const touches = (points: readonly P[], margin: number) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of points) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y }
    return maxX >= -margin && minX <= size + margin && maxY >= -margin && minY <= size + margin
  }
  const flat = (points: readonly P[]) => points.flatMap(p => [round1(p.x), round1(p.y)])

  const out: SimplifiedTile = { z, x: tile.x, y: tile.y, size: round1(size), roads: [], rivers: [], areas: [], blocks: [] }
  const seen = new Set<string>()
  for (const feature of features) {
    const properties = (feature.properties ?? {}) as Record<string, unknown>
    const key = String(properties.noxia_source_id ?? feature.id)
    if (seen.has(key)) continue
    const coordinates = feature.geometry?.coordinates
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue
    const points = coordinates.map(local)

    if (feature.featureType === 'building' && feature.geometry.kind === 'polygon') {
      const box = orientedBox(points)
      // Ein Gebäude gehört in genau eine Kachel: in die, in der seine Mitte liegt.
      if (!box || box.x < 0 || box.x >= size || box.y < 0 || box.y >= size) continue
      seen.add(key)
      if (box.w * box.d < 18) continue
      const kind = worldBlockKind(properties, box.w, box.d)
      const block: TileBlock = { x: round1(box.x), y: round1(box.y), w: round1(box.w), d: round1(box.d), a: Math.round(box.a * 1000) / 1000, k: kind, l: levels(properties, kind) }
      // Große Bauten mit verwinkeltem Grundriss nicht zum Rechteck aufblähen:
      // Das Rechteck um ein L-förmiges Werk deckt sonst Nachbarflächen zu.
      if ((kind === 'hall' || kind === 'factory') && points.length > 5) {
        const ring = simplifyLine(points, 1)
        if (ring.length >= 4 && polygonArea(ring) < 0.9 * box.w * box.d) block.f = flat(ring)
      }
      out.blocks.push(block)
      continue
    }
    if (!touches(points, 12)) continue
    seen.add(key)

    if (feature.featureType === 'road' && feature.geometry.kind === 'line') {
      const roadClass = ROAD_CLASS[String(properties.highway ?? '')]
      if (!roadClass || properties.tunnel === 'yes') continue
      out.roads.push({ c: roadClass, p: flat(simplifyLine(points, roadClass === 'path' ? 2.5 : 1.5)) })
    } else if (feature.featureType === 'waterway' && feature.geometry.kind === 'line') {
      out.rivers.push(flat(simplifyLine(points, 2)))
    } else if (areaKind(feature.featureType, properties) && feature.geometry.kind === 'polygon' && points.length >= 3) {
      // Sportflächen sind klein und rechteckig – feiner vereinfachen, damit das Feld eckig bleibt.
      const simplified = simplifyLine(points, feature.featureType === 'sport' ? 1 : 4)
      // Ein Hauch Überlappung (0,2 m), damit an der Kachelgrenze keine Haarfuge bleibt.
      const clipped = simplified.length >= 3 ? clipToSquare(simplified, -0.2, size + 0.2) : []
      // Fußballplatz (oder Platz ohne Sportart): Markierungen, gezeichnet von der Kachel mit der Platzmitte.
      if (feature.featureType === 'sport' && areaKind(feature.featureType, properties) === 'pitch' && (properties.sport === undefined || properties.sport === 'soccer')) {
        const box = orientedBox(points)
        if (box && box.x >= 0 && box.x < size && box.y >= 0 && box.y < size && box.w >= 30 && box.d >= 20 && polygonArea(points) > 0.85 * box.w * box.d) {
          out.marks = [...(out.marks ?? []), ...pitchMarkings(box).map(flat)]
        }
      }
      if (clipped.length >= 4) out.areas.push({ k: areaKind(feature.featureType, properties) as AreaKind, p: flat(clipped) })
    }
  }
  // Feste Reihenfolge: Felder unten, dann Gärten und bebaute Fläche, Wald, Sportanlage,
  // Laufbahn, Spielfeld, Wasser zuoberst.
  const order: Record<AreaKind, number> = { field: 0, garden: 1, built: 1, forest: 2, grounds: 3, track: 4, pitch: 5, water: 6 }
  out.areas.sort((a, b) => order[a.k] - order[b.k])
  const roadOrder: Record<RoadClass, number> = { path: 0, street: 1, main: 2 }
  out.roads.sort((a, b) => roadOrder[a.c] - roadOrder[b.c])
  return out
}
