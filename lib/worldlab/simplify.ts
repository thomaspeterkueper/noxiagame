// lib/worldlab/simplify.ts
// Macht aus den importierten Kartendaten eine stark vereinfachte Kachel:
// drei Straßenklassen, vier Flächenarten, Gewässerlinien und Gebäude als
// Blöcke (Rechteck mit Lage, Größe, Drehung und Art). Reine Funktion.
//
// Koordinaten in der Kachel: Meter am Boden, x nach Osten, y nach Süden,
// gemessen ab der Nordwestecke der Kachel.

import { geoToMerc, mercPerGroundMetre, mercToGeo, tileOrigin, TILE_SIZE_MERC, type GeoPoint, type TileId } from './mercator'
import { buildingUseCode } from './buildingUse'

export interface SourceFeature {
  id: string
  featureType: string
  geometry: { kind: 'point' | 'line' | 'polygon'; coordinates: GeoPoint | GeoPoint[] }
  properties?: Record<string, unknown> | null
}

/** service: Zufahrt, Parkplatzgasse, Fußgängerzone – schmal, ohne Bordstein und Gehweg */
export type RoadClass = 'main' | 'street' | 'service' | 'path'
export type AreaKind =
  | 'water' | 'forest' | 'field' | 'built' | 'garden'
  // Orte des Alltags
  | 'park' | 'playground' | 'cemetery' | 'allotments' | 'parking' | 'pool'
  // Sport: Anlage, Laufbahn, Rasenplatz, Sand (Reiten, Beach), Hartplatz (Skaten, Basketball), Asche (Tennis)
  | 'grounds' | 'track' | 'pitch' | 'sand' | 'hardcourt' | 'clay'
  // Gepflasterter Platz (Fußgängerzone als Fläche)
  | 'plaza'
export type BlockKind = 'house' | 'row' | 'hall' | 'factory' | 'church' | 'shed'

export interface TilePlace { x: number; y: number; n: string; k: string; t?: Record<string, string>; /** 1: Laden oder Lokal (kein Wahrzeichen) */ p?: 1 }
/** OSM-Angaben, die ein Wahrzeichen beschreiben (Tafel, Innenraum). */
const PLACE_TAGS = ['religion', 'denomination', 'addr:street', 'addr:housenumber', 'opening_hours', 'start_date', 'operator', 'description', 'wikipedia', 'shop', 'cuisine', 'amenity', 'craft', 'office', 'tourism']

export interface TileRoad { c: RoadClass; p: number[]; /** Straßenname, wenn bekannt. */ n?: string; /** 1: Kreisverkehr */ r?: 1; /** 1: Brücke */ b?: 1 }
export interface TileArea { k: AreaKind; p: number[] }
export interface TileBlock {
  x: number; y: number; w: number; d: number; a: number; k: BlockKind; l: number
  /** Echter Grundriss (Meter in der Kachel, x/y abwechselnd) – nur bei Hallen und Fabriken, deren Form kein Rechteck ist. */
  f?: number[]
  /** Anschrift aus OSM (`addr:street` + `addr:housenumber`), z. B. „Bogenstraße 15“. */
  h?: string
  /** Name des Gebäudes aus OSM, z. B. „Metallwerk Sundern (MESU)“. */
  nm?: string
  /** Kennung der Quelle, z. B. „osm:way:123“ – für Kauf und Eigentum. */
  i?: string
  /** Heutige Nutzung aus OSM als kurze Kennung, z. B. „a:bar“, „s:bakery“, „b:apartments“ (`lib/worldlab/buildingUse.ts`). */
  u?: string
}
export interface SimplifiedTile {
  z: number
  x: number
  y: number
  /** Kantenlänge der Kachel in Bodenmetern. */
  size: number
  roads: TileRoad[]
  rivers: number[][]
  /** Breite je Gewässerlinie in Metern (gleicher Index wie rivers); fehlt: 5 m */
  rw?: number[]
  /** Mittelinseln von Kreisverkehren (Vieleck, Meter der Kachel) */
  islands?: number[][]
  /** Platzmarkierungen (weiße Linien, x/y abwechselnd) – nur in der Kachel, in der die Platzmitte liegt. */
  marks?: number[][]
  areas: TileArea[]
  blocks: TileBlock[]
  /** Laufbahnen, die OSM als Linie führt (x/y abwechselnd). */
  tracks?: number[][]
  /** Einzelbäume und Bäume aus Alleen: Standorte x/y abwechselnd, nur die in dieser Kachel. */
  trees?: number[]
  /** Wahrzeichen (Kirche, Bibliothek, Museum …): Lage, Name, Art und ausgewählte OSM-Angaben. */
  places?: TilePlace[]
  /** Flurstücke (Kataster): Kennung und Grenze in Metern der Kachel */
  parcels?: Array<{ i: string; p: number[] }>
  /** Gleise: Punkte (x/y abwechselnd); s = 1 für Abstell- und Anschlussgleise */
  rails?: Array<{ p: number[]; s?: 1 }>
}

const ROAD_CLASS: Record<string, RoadClass> = {
  motorway: 'main', trunk: 'main', primary: 'main', secondary: 'main',
  tertiary: 'street', residential: 'street', unclassified: 'street', living_street: 'street', service: 'service', pedestrian: 'service',
  footway: 'path', path: 'path', track: 'path', cycleway: 'path',
}
const AREA_KIND: Record<string, AreaKind> = {
  water: 'water', forest: 'forest', vegetation: 'forest', farmland: 'field', urban: 'built', industrial: 'built', sport: 'pitch',
}

/** Sportflächen: Anlage (Stadion, Sportzentrum), Laufbahn, Spielfeld. */
const PLACE_AREA: Record<string, AreaKind> = {
  playground: 'playground', garden: 'park', dog_park: 'park', grass: 'park', recreation_ground: 'park', village_green: 'park',
  swimming_pool: 'pool', cemetery: 'cemetery', allotments: 'allotments', parking: 'parking',
}

/** Fläche eines Sportplatzes nach Sportart. */
function sportKind(properties: Record<string, unknown>): AreaKind {
  const leisure = String(properties.visual_class ?? properties.leisure ?? '')
  const sport = String(properties.sport ?? '').split(';')[0]
  if (leisure === 'track') return 'track'
  if (leisure === 'stadium' || leisure === 'sports_centre') return 'grounds'
  if (/^(equestrian|beachvolleyball|horse_racing)$/.test(sport)) return 'sand'
  if (/^(skateboard|basketball|roller_skating|multi|handball|volleyball)$/.test(sport)) return 'hardcourt'
  if (sport === 'tennis') return 'clay'
  if (sport === 'shooting') return 'grounds'
  return 'pitch'
}

function areaKind(featureType: string, properties: Record<string, unknown>): AreaKind | undefined {
  const tag = String(properties.visual_class ?? properties.landuse ?? properties.leisure ?? properties.natural ?? '')
  if (featureType === 'place_area') return PLACE_AREA[tag]
  // Naturschutzgebiete sind Gebietsgrenzen über allem anderen, keine sichtbare Fläche.
  if (featureType === 'vegetation' && tag === 'nature_reserve') return undefined
  // Gärten: Wohngebiete bestehen in Wirklichkeit großteils aus Gärten, OSM trägt
  // sie aber nicht einzeln ein. Gewerbe, Handel und Industrie bleiben „bebaut“.
  if (featureType === 'urban') return tag === 'commercial' || tag === 'retail' ? 'built' : 'garden'
  // Parks und Rasen sind Gärten, kein Wald; Gebüsch, Heide, Feuchtgebiet bleiben dunkel.
  if (featureType === 'vegetation' && /^(park|village_green|recreation_ground)$/.test(tag)) return 'park'
  if (featureType === 'vegetation' && /^(grass|grassland|meadow)$/.test(tag)) return 'field'
  if (featureType !== 'sport') return AREA_KIND[featureType]
  return sportKind(properties)
}

type P = { x: number; y: number }
const round1 = (value: number) => Math.round(value * 10) / 10

/** Halbe Fahrbahnbreite je Klasse (wie ROAD_STYLES in blocks.ts) */
const ROAD_HALF_WIDTH: Record<RoadClass, number> = { main: 4.5, street: 3, service: 1.8, path: 1.1 }

/** Breite einer Gewässerlinie nach Art (Meter). */
export function waterwayWidth(properties: Record<string, unknown>) {
  const width = Number(String(properties.width ?? '').replace(',', '.'))
  if (Number.isFinite(width) && width > 0.3 && width < 60) return Math.round(width * 10) / 10
  const kind = String(properties.waterway ?? properties.visual_class ?? '')
  if (kind === 'river') return 10
  if (kind === 'canal') return 7
  if (kind === 'stream') return 2.4
  if (kind === 'ditch' || kind === 'drain') return 1.2
  return 3
}

/** Ring gleichmäßig nach innen versetzen (um die Mitte skaliert); null, wenn zu klein. */
export function insetRing(ring: readonly P[], by: number): P[] | null {
  if (ring.length < 3) return null
  const cx = ring.reduce((sum, p) => sum + p.x, 0) / ring.length, cy = ring.reduce((sum, p) => sum + p.y, 0) / ring.length
  const radius = ring.reduce((sum, p) => sum + Math.hypot(p.x - cx, p.y - cy), 0) / ring.length
  if (radius - by < 1.5) return null
  const k = (radius - by) / radius
  return ring.map(p => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k }))
}

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

/**
 * Markierungen eines Tennisplatzes (Doppelfeld 23,77 × 10,97 m mittig im
 * Platz): Außenlinien, Einzel-Seitenlinien, Aufschlaglinien, Mittellinie, Netz.
 * Größere Flächen mit mehreren Plätzen bekommen einen Platz je 36 × 18 m.
 */
export function tennisMarkings(box: { x: number; y: number; w: number; d: number; a: number }): P[][] {
  const cos = Math.cos(box.a), sin = Math.sin(box.a)
  const lines: P[][] = []
  const courts = Math.max(1, Math.min(6, Math.round(box.d / 18)))
  const along = Math.max(1, Math.min(3, Math.round(box.w / 36)))
  const cw = Math.min(23.77, box.w / along * 0.72), cd = Math.min(10.97, box.d / courts * 0.68)
  const scale = cw / 23.77
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < courts; j++) {
      const ox = -box.w / 2 + (i + 0.5) * box.w / along, oy = -box.d / 2 + (j + 0.5) * box.d / courts
      const at = (lx: number, ly: number): P => ({ x: box.x + (ox + lx) * cos - (oy + ly) * sin, y: box.y + (ox + lx) * sin + (oy + ly) * cos })
      const hw = cw / 2, hd = cd / 2, single = hd * 8.23 / 10.97, service = 6.4 * scale
      lines.push([at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd), at(-hw, -hd)])
      lines.push([at(-hw, -single), at(hw, -single)], [at(-hw, single), at(hw, single)])
      lines.push([at(-service, -single), at(-service, single)], [at(service, -single), at(service, single)])
      lines.push([at(-service, 0), at(service, 0)], [at(0, -hd - 0.5), at(0, hd + 0.5)])
    }
  }
  return lines
}

/** Punkte im Abstand `step` Meter entlang einer Linie (Anfang eingeschlossen). */
export function samplesAlong(points: readonly P[], step: number): P[] {
  const out: P[] = []
  let carry = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    let t = carry
    while (t <= length + 1e-6) { out.push({ x: a.x + (b.x - a.x) * t / length, y: a.y + (b.y - a.y) * t / length }); t += step }
    carry = t - length
  }
  return out
}

/** Fläche eines Vielecks (Shoelace, Betrag). */
export function polygonArea(points: readonly P[]): number {
  let sum = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) sum += (points[j].x + points[i].x) * (points[j].y - points[i].y)
  return Math.abs(sum) / 2
}

export function blockLevels(properties: Record<string, unknown>, kind: BlockKind): number {
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
  // Dieselbe Linie aus mehreren Importen (Region grob auf ~13 m, Ortsdetail, genaue
  // Hauptstraßen und Gleise): die mit den meisten Punkten zählt.
  const finest = new Map<string, SourceFeature>()
  for (const feature of features) {
    if (feature.geometry?.kind !== 'line' || !Array.isArray(feature.geometry.coordinates)) continue
    const key = String((feature.properties as Record<string, unknown> | null)?.noxia_source_id ?? feature.id)
    const best = finest.get(key)
    if (!best || (feature.geometry.coordinates as GeoPoint[]).length > (best.geometry.coordinates as GeoPoint[]).length) finest.set(key, feature)
  }
  for (const feature of features) {
    const properties = (feature.properties ?? {}) as Record<string, unknown>
    const key = String(properties.noxia_source_id ?? feature.id)
    if (seen.has(key)) continue
    if (feature.geometry?.kind === 'line' && finest.has(key) && finest.get(key) !== feature) continue
    const coordinates = feature.geometry?.coordinates
    // Wahrzeichen: Punkt mit Namen; gehört der Kachel, in der es liegt.
    if ((feature.featureType === 'landmark' || feature.featureType === 'poi') && feature.geometry.kind === 'point' && typeof properties.name === 'string') {
      const at = local(feature.geometry.coordinates as GeoPoint)
      if (at.x < 0 || at.x >= size || at.y < 0 || at.y >= size) continue
      seen.add(key)
      const tags: Record<string, string> = {}
      for (const tag of PLACE_TAGS) if (typeof properties[tag] === 'string' && properties[tag]) tags[tag] = String(properties[tag]).slice(0, 200)
      ;(out.places ??= []).push({ x: round1(at.x), y: round1(at.y), n: properties.name.slice(0, 80), k: String(properties.visual_class ?? 'landmark'), ...(Object.keys(tags).length ? { t: tags } : {}), ...(feature.featureType === 'poi' ? { p: 1 as const } : {}) })
      continue
    }
    // Einzelbaum: gehört der Kachel, in der er steht.
    if (feature.featureType === 'tree' && feature.geometry.kind === 'point') {
      const at = local(feature.geometry.coordinates as GeoPoint)
      if (at.x < 0 || at.x >= size || at.y < 0 || at.y >= size) continue
      seen.add(key)
      ;(out.trees ??= []).push(round1(at.x), round1(at.y))
      continue
    }
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue
    const points = coordinates.map(local)

    if (feature.featureType === 'building' && feature.geometry.kind === 'polygon') {
      const box = orientedBox(points)
      // Ein Gebäude gehört in genau eine Kachel: in die, in der seine Mitte liegt.
      if (!box || box.x < 0 || box.x >= size || box.y < 0 || box.y >= size) continue
      seen.add(key)
      if (box.w * box.d < 18) continue
      const kind = worldBlockKind(properties, box.w, box.d)
      const block: TileBlock = { x: round1(box.x), y: round1(box.y), w: round1(box.w), d: round1(box.d), a: Math.round(box.a * 1000) / 1000, k: kind, l: blockLevels(properties, kind) }
      // Große Bauten mit verwinkeltem Grundriss nicht zum Rechteck aufblähen:
      // Das Rechteck um ein L-förmiges Werk deckt sonst Nachbarflächen zu.
      if ((kind === 'hall' || kind === 'factory') && points.length > 5) {
        const ring = simplifyLine(points, 1)
        if (ring.length >= 4 && polygonArea(ring) < 0.9 * box.w * box.d) block.f = flat(ring)
      }
      const street = typeof properties['addr:street'] === 'string' ? properties['addr:street'].trim() : ''
      const number = typeof properties['addr:housenumber'] === 'string' ? properties['addr:housenumber'].trim() : ''
      if (street && number) block.h = `${street} ${number}`.slice(0, 80)
      else if (number) block.h = number.slice(0, 20)
      if (typeof properties.name === 'string' && properties.name.trim()) block.nm = properties.name.trim().slice(0, 80)
      if (typeof properties.noxia_source_id === 'string' && properties.noxia_source_id.startsWith('osm:')) block.i = properties.noxia_source_id.slice(0, 40)
      const use = buildingUseCode(properties)
      if (use) block.u = use
      out.blocks.push(block)
      continue
    }
    if (!touches(points, 12)) continue
    seen.add(key)

    // Allee: alle 8 m ein Baum entlang der Linie, jeder in der Kachel, in der er steht.
    if (feature.featureType === 'tree_row' && feature.geometry.kind === 'line') {
      for (const at of samplesAlong(points, 8)) {
        if (at.x < 0 || at.x >= size || at.y < 0 || at.y >= size) continue
        ;(out.trees ??= []).push(round1(at.x), round1(at.y))
      }
      continue
    }
    // Laufbahn als Linie (offener oder als Mittellinie geführter Ring).
    if (feature.featureType === 'sport' && feature.geometry.kind === 'line' && String(properties.visual_class ?? properties.leisure) === 'track') {
      ;(out.tracks ??= []).push(flat(simplifyLine(points, 0.5)))
      continue
    }
    if (feature.featureType === 'road' && (feature.geometry.kind === 'line' || feature.geometry.kind === 'polygon')) {
      const roadClass = ROAD_CLASS[String(properties.highway ?? '')]
      if (!roadClass || (properties.tunnel && properties.tunnel !== 'no')) continue
      const closed = points.length >= 4 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 0.5
      // Fußgängerzone als Fläche (area=yes): gepflasterter Platz statt einer Linie rundherum
      if ((properties.area === 'yes' || feature.geometry.kind === 'polygon') && closed) {
        if (properties.highway === 'pedestrian' || properties.highway === 'footway') {
          const clipped = clipToSquare(simplifyLine(points, 1), -0.2, size + 0.2)
          if (clipped.length >= 4) out.areas.push({ k: 'plaza', p: flat(clipped) })
        }
        continue
      }
      if (feature.geometry.kind !== 'line') continue
      const roundabout = /^(roundabout|circular)$/.test(String(properties.junction ?? ''))
      const road: TileRoad = { c: roadClass, p: flat(simplifyLine(points, roadClass === 'path' ? 2.5 : roundabout ? 0.6 : 1.5)) }
      if (roundabout) road.r = 1
      if (properties.bridge && properties.bridge !== 'no') road.b = 1
      if (typeof properties.name === 'string' && properties.name.trim() && roadClass !== 'path' && properties.service !== 'parking_aisle' && properties.service !== 'driveway') road.n = properties.name.trim().slice(0, 60)
      out.roads.push(road)
      // Geschlossener Kreisverkehr: Mittelinsel (Ring um die halbe Fahrbahn plus Rand nach innen versetzt)
      if (roundabout && closed) {
        const island = insetRing(points.slice(0, -1), ROAD_HALF_WIDTH[roadClass] + 0.8)
        if (island) (out.islands ??= []).push(flat(island))
      }
    } else if (feature.featureType === 'rail' && feature.geometry.kind === 'line') {
      if (properties.tunnel === 'yes') continue
      ;(out.rails ??= []).push({ p: flat(simplifyLine(points, 1.5)), ...(properties.service ? { s: 1 as const } : {}) })
    } else if (feature.featureType === 'waterway' && feature.geometry.kind === 'line') {
      // Verrohrte Bäche (tunnel=culvert) liegen unter der Erde
      if (properties.tunnel && properties.tunnel !== 'no') continue
      out.rivers.push(flat(simplifyLine(points, 2)))
      ;(out.rw ??= []).push(waterwayWidth(properties))
    } else if (areaKind(feature.featureType, properties) && feature.geometry.kind === 'polygon' && points.length >= 3) {
      // Sportflächen sind klein und rechteckig – feiner vereinfachen, damit das Feld eckig bleibt.
      const simplified = simplifyLine(points, feature.featureType === 'sport' || feature.featureType === 'place_area' ? 1 : 4)
      // Ein Hauch Überlappung (0,2 m), damit an der Kachelgrenze keine Haarfuge bleibt.
      const clipped = simplified.length >= 3 ? clipToSquare(simplified, -0.2, size + 0.2) : []
      // Fußballplatz (oder Platz ohne Sportart): Markierungen, gezeichnet von der Kachel mit der Platzmitte.
      const kindHere = areaKind(feature.featureType, properties)
      if (feature.featureType === 'sport' && (kindHere === 'pitch' || kindHere === 'clay')) {
        const box = orientedBox(points)
        const rectangular = box && polygonArea(points) > 0.85 * box.w * box.d
        if (box && rectangular && box.x >= 0 && box.x < size && box.y >= 0 && box.y < size) {
          if (kindHere === 'pitch' && (properties.sport === undefined || properties.sport === 'soccer') && box.w >= 30 && box.d >= 20) {
            out.marks = [...(out.marks ?? []), ...pitchMarkings(box).map(flat)]
          } else if (kindHere === 'clay' && box.w >= 18 && box.d >= 9) {
            out.marks = [...(out.marks ?? []), ...tennisMarkings(box).map(flat)]
          }
        }
      }
      if (clipped.length >= 4) out.areas.push({ k: kindHere as AreaKind, p: flat(clipped) })
    }
  }
  // Feste Reihenfolge: Felder unten, dann Gärten und bebaute Fläche, Wald, Sportanlage,
  // Laufbahn, Spielfeld, Wasser zuoberst.
  const order: Record<AreaKind, number> = {
    field: 0, garden: 1, built: 1, park: 2, cemetery: 2, allotments: 2, parking: 2, forest: 3,
    plaza: 2, grounds: 4, playground: 5, track: 5, sand: 6, hardcourt: 6, clay: 6, pitch: 6, pool: 7, water: 8,
  }
  out.areas.sort((a, b) => order[a.k] - order[b.k])
  const roadOrder: Record<RoadClass, number> = { path: 0, service: 1, street: 2, main: 3 }
  out.roads.sort((a, b) => roadOrder[a.c] - roadOrder[b.c])
  if (out.rw && out.rw.length !== out.rivers.length) delete out.rw
  return out
}
