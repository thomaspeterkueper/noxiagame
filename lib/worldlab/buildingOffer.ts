// lib/worldlab/buildingOffer.ts
// Kauf realer Gebäude der Erdkarte (Thomas, 25.10.2026): Geld geht an die
// Gemeinde, Bewohner bleiben und zahlen Miete an den neuen Eigentümer,
// Mieteinnahmen erhöhen den Preis, abreißen nur selbst gekaufte Gebäude.
// Hier: Maße aus dem OSM-Grundriss, Preis und was nicht verkäuflich ist.
// Gebucht wird in der Datenbank (buy_earth_building), nicht hier.

import { blockLevels, orientedBox, polygonArea, worldBlockKind, type BlockKind } from './simplify'

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
export const RENT_PERIODS = 10
export const MIN_PRICE = 800

export function buildingPrice(input: { areaM2: number; levels: number; kind: BlockKind; rentPerInterval: number }): number {
  const floor = input.areaM2 * Math.max(1, input.levels) * FLOOR_RATE[input.kind]
  const land = input.areaM2 * LAND_RATE
  const rent = Math.max(0, input.rentPerInterval) * RENT_PERIODS
  return Math.max(MIN_PRICE, Math.round((floor + land + rent) / 50) * 50)
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
