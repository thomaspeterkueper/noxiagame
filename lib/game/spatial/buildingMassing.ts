// lib/game/spatial/buildingMassing.ts
// Aktualisiert: 12.10.2026 — Höhe, Dachform und Farbgebung realer Gebäude für die 2,5D-Darstellung
// Version:      1.0.0

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
