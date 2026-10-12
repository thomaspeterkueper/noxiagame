// lib/game/spatial/buildingMassing.ts
// Aktualisiert: 12.10.2026 — Walmdach für rechteckige Grundrisse und Fensterreihen; Höhe, Dachform und Farbgebung realer Gebäude für die 2,5D-Darstellung
// Version:      1.1.0

export type BuildingRoofForm = 'pitched' | 'flat'
export type BuildingMassingStyle = {
  heightM: number
  roofForm: BuildingRoofForm
  roof: string
  roofEdge: string
  wallLight: string
  wallDark: string
}

type Tags = Record<string, unknown> | undefined

const LOW = /^(garage|garages|carport|shed|hut|roof|kiosk|greenhouse|cabin|bungalow|static_caravan|toilets|service)$/
const HALL = /^(industrial|warehouse|retail|commercial|supermarket|hangar|manufacture|barn|farm_auxiliary|stable|cowshed|sty|office|parking|sports_hall|train_station|transportation)$/
const SACRED = /^(church|cathedral|chapel|mosque|synagogue|temple|shrine|monastery)$/
const TALL_HOUSING = /^(apartments|dormitory|hotel|residential|terrace)$/

function number(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Eaves height in metres: mapped height, else levels, else a typical value for the building class. */
export function buildingHeightM(tags: Tags): number {
  const mapped = number(tags?.height)
  if (mapped) return Math.min(120, mapped)
  const levels = number(tags?.['building:levels'])
  if (levels) return Math.min(120, levels * 3 + 1)
  const cls = String(tags?.building ?? 'yes')
  if (LOW.test(cls)) return 3
  if (SACRED.test(cls)) return 14
  if (HALL.test(cls)) return 8
  if (TALL_HOUSING.test(cls)) return 11
  return 6.5
}

const TILE_ROOFS = ['#a8553d', '#9c4a36', '#b06347', '#8a4a3a', '#6f5a52']
const FLAT_ROOFS = ['#9aa3a6', '#8d9699', '#a6aba6']
const PLASTER: Array<[string, string]> = [['#efe7d6', '#cfc5b1'], ['#e9dfc9', '#c6bba4'], ['#f1ece2', '#d2cbbd'], ['#e6d6c0', '#c2b199']]

/** Deterministic look of one building: same id, same house – on every visit. */
export function buildingMassingStyle(id: string, tags: Tags): BuildingMassingStyle {
  const cls = String(tags?.building ?? 'yes')
  const h = hash(id)
  const heightM = buildingHeightM(tags)
  const flat = HALL.test(cls) || LOW.test(cls) || String(tags?.['roof:shape'] ?? '') === 'flat' || heightM > 16
  if (SACRED.test(cls)) return { heightM, roofForm: 'pitched', roof: '#5d6a70', roofEdge: '#3f4a4f', wallLight: '#ece6d8', wallDark: '#c9c1b0' }
  const [wallLight, wallDark] = flat && HALL.test(cls) ? ['#d9dcda', '#b5bab8'] : PLASTER[h % PLASTER.length]
  if (flat) return { heightM, roofForm: 'flat', roof: FLAT_ROOFS[(h >>> 4) % FLAT_ROOFS.length], roofEdge: '#6c7578', wallLight, wallDark }
  return { heightM, roofForm: 'pitched', roof: TILE_ROOFS[(h >>> 4) % TILE_ROOFS.length], roofEdge: '#5e3226', wallLight, wallDark }
}

export type ScreenPoint = { x: number; y: number }

/**
 * Extrudes a footprint given in screen coordinates (y grows downwards).
 * Returns only the walls that face the viewer, each marked as lit or shaded,
 * plus the lifted roof outline and a ridge line along the longest side.
 */
export function extrudeFootprint(base: ScreenPoint[], heightPx: number) {
  let area = 0
  for (let i = 0; i < base.length; i++) { const p = base[i], q = base[(i + 1) % base.length]; area += p.x * q.y - q.x * p.y }
  const sign = area >= 0 ? 1 : -1
  const lift = (point: ScreenPoint) => ({ x: point.x, y: point.y - heightPx })
  const walls: Array<{ points: ScreenPoint[]; lit: boolean }> = []
  let longest = 0, ridgeDir = { x: 1, y: 0 }
  for (let i = 0; i < base.length; i++) {
    const p = base[i], q = base[(i + 1) % base.length]
    const dx = q.x - p.x, dy = q.y - p.y
    const length = Math.hypot(dx, dy)
    if (length > longest) { longest = length; ridgeDir = { x: dx / (length || 1), y: dy / (length || 1) } }
    const outward = { x: dy * sign, y: -dx * sign }
    if (outward.y <= 0) continue
    walls.push({ points: [p, q, lift(q), lift(p)], lit: outward.x < 0 })
  }
  const roof = base.map(lift)
  const cx = roof.reduce((sum, point) => sum + point.x, 0) / roof.length
  const cy = roof.reduce((sum, point) => sum + point.y, 0) / roof.length
  const half = longest * .3
  const ridge: [ScreenPoint, ScreenPoint] = [
    { x: cx - ridgeDir.x * half, y: cy - ridgeDir.y * half },
    { x: cx + ridgeDir.x * half, y: cy + ridgeDir.y * half },
  ]
  return { walls, roof, ridge }
}

export type GroundPoint = { xM: number; yM: number }

/**
 * Hipped roof for a four-cornered footprint (ground metres): the ridge runs
 * along the long axis and is pulled in by half the short side at both ends.
 * Returns the two ridge ends and, per footprint edge, which ridge ends its
 * roof face touches. Other footprints get no hip roof (null).
 */
export function hipRoof(footprint: GroundPoint[]) {
  if (footprint.length !== 4) return null
  const side = (i: number) => Math.hypot(footprint[(i + 1) % 4].xM - footprint[i].xM, footprint[(i + 1) % 4].yM - footprint[i].yM)
  const a = (side(0) + side(2)) / 2, b = (side(1) + side(3)) / 2
  const shortM = Math.min(a, b), longM = Math.max(a, b)
  if (shortM < 2.5 || longM / shortM > 6) return null
  // Short edges are 1 and 3 when edge 0 is long, otherwise 0 and 2.
  const firstShort = a >= b ? 1 : 0
  const mid = (i: number) => ({ xM: (footprint[i].xM + footprint[(i + 1) % 4].xM) / 2, yM: (footprint[i].yM + footprint[(i + 1) % 4].yM) / 2 })
  const m1 = mid(firstShort), m2 = mid(firstShort + 2)
  const inset = Math.min(.5, (shortM / 2) / (longM || 1))
  const ridgeA = { xM: m1.xM + (m2.xM - m1.xM) * inset, yM: m1.yM + (m2.yM - m1.yM) * inset }
  const ridgeB = { xM: m2.xM + (m1.xM - m2.xM) * inset, yM: m2.yM + (m1.yM - m2.yM) * inset }
  // Face per edge i: short edge → triangle to its ridge end, long edge → trapezoid to both.
  const faces = [0, 1, 2, 3].map(i => {
    if (i === firstShort) return { edge: i, ridge: ['a'] as Array<'a' | 'b'> }
    if (i === firstShort + 2) return { edge: i, ridge: ['b'] as Array<'a' | 'b'> }
    // The long edge following the first short edge runs from the A side to the B side.
    return { edge: i, ridge: (i === (firstShort + 1) % 4 ? ['b', 'a'] : ['a', 'b']) as Array<'a' | 'b'> }
  })
  return { ridgeA, ridgeB, faces, riseM: Math.min(4.5, shortM * .32) }
}

/**
 * Window rows on the viewer-facing walls as one SVG path. Each wall is the quad
 * [base p, base q, lifted q, lifted p]; windows are spaced along the edge.
 */
export function windowPath(walls: Array<{ points: ScreenPoint[] }>, heightM: number, heightPx: number, spacingPx = 3.4) {
  const floors = Math.max(1, Math.min(8, Math.round((heightM - .5) / 3)))
  const floorPx = heightPx / floors
  if (floorPx < 1.6) return ''
  let d = ''
  for (const wall of walls) {
    const [p, q] = wall.points
    const length = Math.hypot(q.x - p.x, q.y - p.y)
    const count = Math.floor((length - 1.2) / spacingPx)
    if (count < 1) continue
    const margin = (length - count * spacingPx) / 2
    for (let floor = 0; floor < floors; floor++) {
      const bottom = floor * floorPx + floorPx * .28, top = floor * floorPx + floorPx * .78
      for (let i = 0; i < count; i++) {
        const t0 = (margin + i * spacingPx + spacingPx * .22) / length, t1 = (margin + i * spacingPx + spacingPx * .78) / length
        const x0 = p.x + (q.x - p.x) * t0, y0 = p.y + (q.y - p.y) * t0
        const x1 = p.x + (q.x - p.x) * t1, y1 = p.y + (q.y - p.y) * t1
        d += `M${x0.toFixed(1)} ${(y0 - bottom).toFixed(1)}L${x1.toFixed(1)} ${(y1 - bottom).toFixed(1)}L${x1.toFixed(1)} ${(y1 - top).toFixed(1)}L${x0.toFixed(1)} ${(y0 - top).toFixed(1)}Z`
      }
    }
  }
  return d
}
