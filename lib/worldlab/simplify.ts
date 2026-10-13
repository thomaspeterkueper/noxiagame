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
export type AreaKind = 'water' | 'forest' | 'field' | 'built' | 'grounds' | 'track' | 'pitch'
export type BlockKind = 'house' | 'row' | 'hall' | 'church' | 'shed'

export interface TileRoad { c: RoadClass; p: number[] }
export interface TileArea { k: AreaKind; p: number[] }
export interface TileBlock { x: number; y: number; w: number; d: number; a: number; k: BlockKind; l: number }
export interface SimplifiedTile {
  z: number
  x: number
  y: number
  /** Kantenlänge der Kachel in Bodenmetern. */
  size: number
  roads: TileRoad[]
  rivers: number[][]
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
  if (featureType !== 'sport') return AREA_KIND[featureType]
  const leisure = String(properties.visual_class ?? properties.leisure ?? '')
  return leisure === 'track' ? 'track' : leisure === 'stadium' || leisure === 'sports_centre' ? 'grounds' : 'pitch'
}

type P = { x: number; y: number }
const round1 = (value: number) => Math.round(value * 10) / 10

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

function blockKind(properties: Record<string, unknown>, w: number, d: number): BlockKind {
  const tag = String(properties.visual_class ?? properties.building ?? '').toLowerCase()
  const area = w * d
  if (/church|chapel|cathedral|mosque|synagogue|temple/.test(tag) || properties.amenity === 'place_of_worship') return 'church'
  if (/industrial|warehouse|commercial|retail|supermarket|hangar|factory|manufacture/.test(tag) || area > 700) return 'hall'
  if (/garage|shed|hut|carport|roof|barn/.test(tag) || area < 45) return 'shed'
  if (/apartments|terrace|dormitory|school|hospital|office|public|civic|hotel/.test(tag) || w > 26) return 'row'
  return 'house'
}

function levels(properties: Record<string, unknown>, kind: BlockKind): number {
  const tagged = Number(properties['building:levels'])
  if (Number.isFinite(tagged) && tagged >= 1) return Math.min(8, Math.round(tagged))
  return kind === 'shed' ? 1 : kind === 'hall' ? 2 : kind === 'row' ? 3 : kind === 'church' ? 4 : 2
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
      const kind = blockKind(properties, box.w, box.d)
      out.blocks.push({ x: round1(box.x), y: round1(box.y), w: round1(box.w), d: round1(box.d), a: Math.round(box.a * 1000) / 1000, k: kind, l: levels(properties, kind) })
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
      if (simplified.length >= 3) out.areas.push({ k: areaKind(feature.featureType, properties) as AreaKind, p: flat(simplified) })
    }
  }
  // Feste Reihenfolge: Felder unten, dann bebaute Fläche, Wald, Sportanlage,
  // Laufbahn, Spielfeld, Wasser zuoberst.
  const order: Record<AreaKind, number> = { field: 0, built: 1, forest: 2, grounds: 3, track: 4, pitch: 5, water: 6 }
  out.areas.sort((a, b) => order[a.k] - order[b.k])
  const roadOrder: Record<RoadClass, number> = { path: 0, street: 1, main: 2 }
  out.roads.sort((a, b) => roadOrder[a.c] - roadOrder[b.c])
  return out
}
