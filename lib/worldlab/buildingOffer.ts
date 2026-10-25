// lib/worldlab/buildingOffer.ts
// Kauf realer Gebäude der Erdkarte (Thomas, 25.10.2026): Geld geht an die
// Gemeinde, Bewohner bleiben und zahlen Miete an den neuen Eigentümer,
// Mieteinnahmen erhöhen den Preis, abreißen nur selbst gekaufte Gebäude.
// Hier: Maße aus dem OSM-Grundriss, Preis und was nicht verkäuflich ist.
// Gebucht wird in der Datenbank (buy_earth_building), nicht hier.

import { blockLevels, orientedBox, polygonArea, worldBlockKind, type BlockKind } from './simplify'
import { realVenueKind, VENUE_USAGES } from './venueConversion'

export type GeoPoint = { lat: number; lon: number }

export interface BuildingFacts {
  centre: GeoPoint
  /** Breite und Tiefe des umschließenden Rechtecks (m), Drehung in Grad wie tile_entities.rotation_deg. */
  w: number; d: number; rotationDeg: number
  /** Echte Grundfläche (m²) */
  areaM2: number
  kind: BlockKind
  levels: number
}

const M_PER_DEG = 111320

/** Maße eines Gebäudes aus seinem Grundriss (WGS84-Ring). */
export function buildingFacts(ring: readonly GeoPoint[], properties: Record<string, unknown>): BuildingFacts | null {
  if (ring.length < 3) return null
  const lat0 = ring.reduce((sum, p) => sum + p.lat, 0) / ring.length
  const lon0 = ring.reduce((sum, p) => sum + p.lon, 0) / ring.length
  const k = Math.cos(lat0 * Math.PI / 180)
  // Wie in den Kacheln: x nach Osten, y nach Süden
  const local = ring.map(p => ({ x: (p.lon - lon0) * M_PER_DEG * k, y: (lat0 - p.lat) * M_PER_DEG }))
  const box = orientedBox(local)
  if (!box) return null
  const kind = worldBlockKind(properties, box.w, box.d)
  return {
    centre: { lat: lat0 - box.y / M_PER_DEG, lon: lon0 + box.x / (M_PER_DEG * k) },
    w: Math.round(box.w * 10) / 10, d: Math.round(box.d * 10) / 10,
    rotationDeg: Math.round(box.a * 180 / Math.PI * 10) / 10,
    areaM2: Math.round(polygonArea(local)),
    kind,
    levels: blockLevels(properties, kind),
  }
}

/** Credits je m² Geschossfläche, nach Art des Gebäudes. */
export const FLOOR_RATE: Record<BlockKind, number> = { house: 12, row: 10, hall: 5, factory: 4, shed: 6, church: 0 }
/** Credits je m² Grundstück (Grundfläche). */
export const LAND_RATE = 2
/** Mieteinnahmen erhöhen den Preis: so viele Abrechnungen Miete kommen dazu. */
export const RENT_PERIODS = 6
/** Miete je Bewohner und Abrechnung (720 Ticks) in einem gekauften Wohnhaus. */
export const RENT_PER_RESIDENT = 200
/** Geschossfläche je Bewohner (m²). */
export const M2_PER_RESIDENT = 40

/**
 * Wie viele Menschen in einem echten Wohnhaus leben (Thomas, 25.10.2026: sie
 * ziehen beim Kauf als Personen ins Spiel ein): 1 je 40 m² Geschossfläche,
 * Einfamilienhaus höchstens 4, Mehrfamilienhaus höchstens 8. Andere Arten: niemand.
 */
export function plannedResidents(kind: BlockKind, areaM2: number, levels: number): number {
  if (kind !== 'house' && kind !== 'row') return 0
  const byArea = Math.floor(areaM2 * Math.max(1, levels) / M2_PER_RESIDENT)
  return Math.max(1, Math.min(kind === 'house' ? 4 : 8, byArea))
}
export const MIN_PRICE = 800

/** Wert des Hauses ohne Grundstück: Geschossfläche × Satz + Mietertrag (für den Kauf eines Flurstücks). */
export function buildingValue(input: { areaM2: number; levels: number; kind: BlockKind; rentPerInterval: number; locationFactor?: number }): number {
  const factor = input.locationFactor ?? 1
  return input.areaM2 * Math.max(1, input.levels) * FLOOR_RATE[input.kind] * factor + Math.max(0, input.rentPerInterval) * RENT_PERIODS
}

export function buildingPrice(input: { areaM2: number; levels: number; kind: BlockKind; rentPerInterval: number; locationFactor?: number; fitOut?: number }): number {
  const factor = input.locationFactor ?? 1
  const floor = input.areaM2 * Math.max(1, input.levels) * FLOOR_RATE[input.kind]
  const land = input.areaM2 * LAND_RATE
  const rent = Math.max(0, input.rentPerInterval) * RENT_PERIODS
  return Math.max(MIN_PRICE, Math.round(((floor + land) * factor + rent + Math.max(0, input.fitOut ?? 0)) / 50) * 50)
}

/**
 * Ausbau, den ein Haus schon hat (Thomas, 25.10.2026: Cafés, Restaurants u. a.
 * sind kaufbar, aber teurer, weil schon ausgebaut): ein reales Lokal kostet den
 * Umbau mit, den man sich spart – Café 900, Bar 1 800, Restaurant 2 400, Hotel 3 600.
 */
export function fitOutValue(properties: Record<string, unknown> | null | undefined): number {
  const kind = realVenueKind(properties)
  return kind ? VENUE_USAGES[kind].cost : 0
}

// ── Lage (Thomas, 25.10.2026: Innenstadt teurer) ────────────────────────────
// Erster Schritt: Aufschlag nach Abstand zur Ortsmitte (OSM-Ortspunkt, place=*),
// linear fallend bis zum Rand. Später kommen Bodenschätze, Infrastruktur,
// Fertigungsanlagen und Erholungswert dazu (siehe R-13 in population-economy.md).
export type PlaceKind = 'city' | 'town' | 'suburb' | 'village' | 'hamlet'
export interface SettlementPoint { name: string; place: string; lat: number; lon: number }

/** Aufschlag in der Mitte und Radius, bis zu dem er auf null fällt. */
export const PLACE_PREMIUM: Record<PlaceKind, { premium: number; radiusM: number }> = {
  city: { premium: 1.0, radiusM: 3000 },
  town: { premium: 0.6, radiusM: 1200 },
  suburb: { premium: 0.3, radiusM: 800 },
  village: { premium: 0.25, radiusM: 500 },
  hamlet: { premium: 0.1, radiusM: 250 },
}

export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180)
  return Math.hypot((a.lat - b.lat) * M_PER_DEG, (a.lon - b.lon) * M_PER_DEG * k)
}

/** Faktor ≥ 1 auf Bau- und Bodenwert; die stärkste Ortsmitte in Reichweite zählt. */
export function locationFactor(point: GeoPoint, settlements: readonly SettlementPoint[]): { factor: number; place: string | null; distanceM: number | null } {
  let best = { factor: 1, place: null as string | null, distanceM: null as number | null }
  for (const s of settlements) {
    const rule = PLACE_PREMIUM[s.place as PlaceKind]
    if (!rule || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue
    const d = distanceM(point, s)
    if (d >= rule.radiusM) continue
    const factor = 1 + rule.premium * (1 - d / rule.radiusM)
    if (factor > best.factor) best = { factor: Math.round(factor * 100) / 100, place: s.name, distanceM: Math.round(d) }
  }
  return best
}

// Öffentliche Gebäude und Gotteshäuser verkauft die Gemeinde nicht.
const PUBLIC_BUILDINGS = new Set(['church', 'chapel', 'cathedral', 'mosque', 'synagogue', 'temple', 'shrine', 'monastery', 'public', 'civic', 'government', 'townhall', 'school', 'kindergarten', 'university', 'college', 'hospital', 'train_station', 'transportation', 'fire_station', 'police'])
const PUBLIC_AMENITIES = new Set(['place_of_worship', 'townhall', 'school', 'kindergarten', 'university', 'college', 'hospital', 'clinic', 'library', 'fire_station', 'police', 'courthouse', 'community_centre', 'post_office', 'prison'])

/** Grund, warum ein Gebäude nicht verkäuflich ist – oder null. */
export function notForSaleReason(properties: Record<string, unknown>, kind: BlockKind): string | null {
  const building = String(properties.building ?? '').toLowerCase()
  const amenity = String(properties.amenity ?? '').toLowerCase()
  if (kind === 'church' || PUBLIC_BUILDINGS.has(building) || PUBLIC_AMENITIES.has(amenity) || properties.historic) return 'öffentliches Gebäude oder Wahrzeichen'
  return null
}
