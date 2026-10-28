// lib/worldlab/venueConversion.ts
// Lokale auf der Erde entstehen durch Kauf und Umbau bestehender Häuser, nicht
// durch Neubau (Thomas, 25.10.2026; Request R-13, docs/workstreams/population-economy.md).
//
// Reine Regeln, kein Zustand:
//   * welche Nutzungen ein Lokal sind und was der Umbau kostet und dauert
//     (wie die bisherigen Baukosten: Café 900, Bar 1 800, Restaurant 2 400, Hotel 3 600);
//   * wie groß ein Haus mindestens sein muss;
//   * Personalplätze, Gästezimmer und Wohnplätze nach der Größe des Hauses –
//     Wohnungen liegen in den Obergeschossen (R-6), im Hotel sind dort die Zimmer;
//   * ob ein Haus laut Kartendaten schon ein Lokal ist (dann nicht umbaubar,
//     es gehört dem Ort) – die Lokalart liest venueKindForRealPlace (Gastronomie).
// Gebucht wird in der Datenbank (start_earth_venue_conversion), nicht hier.

import { venueKindForRealPlace, venueSizeForArea, type VenueKind, type VenueSize } from '../game/hospitality/venues'

export type VenueUsage = VenueKind

export interface VenueUsageRule {
  /** Umbaukosten in Credits – wie der bisherige Neubau. */
  cost: number
  /** Bauzeit in Ticks (eine Stunde je Tick). */
  buildTicks: number
  /** Kleinste Grundfläche (m²), in der das Lokal Platz hat. */
  minAreaM2: number
  /** Personalplätze nach Größe des Lokals. */
  staff: Record<VenueSize, number>
}

export const VENUE_USAGES: Readonly<Record<VenueUsage, VenueUsageRule>> = {
  cafe: { cost: 900, buildTicks: 1, minAreaM2: 40, staff: { small: 1, standard: 2, large: 3 } },
  bar: { cost: 1800, buildTicks: 2, minAreaM2: 50, staff: { small: 1, standard: 2, large: 3 } },
  restaurant: { cost: 2400, buildTicks: 2, minAreaM2: 70, staff: { small: 2, standard: 3, large: 4 } },
  hotel: { cost: 3600, buildTicks: 3, minAreaM2: 90, staff: { small: 2, standard: 2, large: 3 } },
  // Nachtclub (Gastronomie, 28.10.2026; Vorschlag in R-19): Tresen, Tür, DJ, zweiter Tresen.
  // Angeboten wird der Umbau erst, wenn building_definitions eine Zeile `nightclub` hat
  // und start_earth_venue_conversion den Typ annimmt (R-19).
  nightclub: { cost: 3000, buildTicks: 3, minAreaM2: 120, staff: { small: 2, standard: 3, large: 4 } },
}

/** Wohnfläche je Wohnplatz in den Obergeschossen (wie beim Kauf eines Wohnhauses). */
export const M2_PER_FLAT_PLACE = 40
/** Fläche je Gästezimmer im Hotel (Zimmer mit Flur und Bad). */
export const M2_PER_GUEST_ROOM = 25
export const MAX_GUEST_ROOMS = 30

export function isVenueUsage(value: unknown): value is VenueUsage {
  return typeof value === 'string' && value in VENUE_USAGES
}

/** Lokalart laut Kartendaten – oder null, wenn das Haus kein Lokal ist. */
export function realVenueKind(tags: Record<string, unknown> | null | undefined): VenueKind | null {
  return venueKindForRealPlace(tags)
}

export interface VenuePlan {
  usage: VenueUsage
  cost: number
  buildTicks: number
  staffCapacity: number
  /** Gästezimmer (tile_entities.transient_capacity). */
  transientCapacity: number
  /** Wohnplätze (tile_entities.residential_capacity). Wer schon dort wohnt, behält seinen Platz. */
  residentialCapacity: number
}

export interface VenueHouse {
  /** Grundfläche eines Geschosses (m²). */
  areaM2: number
  /** Geschosse samt Erdgeschoss. */
  levels: number
  /** Wer heute dort wohnt. */
  residents?: number
}

/**
 * Was das umgebaute Haus hat. Das Erdgeschoss ist das Lokal; die Obergeschosse
 * sind Wohnungen, im Hotel Gästezimmer. Ein Hotel ohne Obergeschoss hat seine
 * Zimmer hinter der Lobby (die Hälfte der Fläche).
 */
export function venuePlan(usage: VenueUsage, house: VenueHouse): VenuePlan {
  const rule = VENUE_USAGES[usage]
  const area = Math.max(0, Number.isFinite(house.areaM2) ? house.areaM2 : 0)
  const levels = Math.max(1, Math.round(Number.isFinite(house.levels) ? house.levels : 1))
  const residents = Math.max(0, Math.floor(house.residents ?? 0))
  const upperM2 = area * (levels - 1)
  const staffCapacity = rule.staff[venueSizeForArea(area)]
  if (usage === 'hotel') {
    const roomM2 = levels > 1 ? upperM2 : area / 2
    return {
      usage, cost: rule.cost, buildTicks: rule.buildTicks, staffCapacity,
      transientCapacity: Math.max(2, Math.min(MAX_GUEST_ROOMS, Math.floor(roomM2 / M2_PER_GUEST_ROOM))),
      residentialCapacity: residents,
    }
  }
  return {
    usage, cost: rule.cost, buildTicks: rule.buildTicks, staffCapacity,
    transientCapacity: 0,
    residentialCapacity: Math.max(residents, Math.floor(upperM2 / M2_PER_FLAT_PLACE)),
  }
}

/** Grund, warum ein Haus nicht zu diesem Lokal umgebaut werden kann – oder null. */
export function venueConversionBlocker(usage: VenueUsage, input: { areaM2: number; tags?: Record<string, unknown> | null; currentUsage?: string | null }): string | null {
  // Ein gekauftes reales Lokal ist schon ausgebaut: dieselbe Lokalart braucht keinen Umbau,
  // eine andere Nutzung ist erlaubt (Thomas, 25.10.2026: reale Lokale sind kaufbar).
  if (input.currentUsage === usage || realVenueKind(input.tags) === usage) return 'Das Haus hat diese Nutzung schon.'
  if (!(input.areaM2 >= VENUE_USAGES[usage].minAreaM2)) return `Zu klein: mindestens ${VENUE_USAGES[usage].minAreaM2} m² Grundfläche.`
  return null
}

/** Auf der Erde werden Lokale nicht neu gebaut, nur umgebaut. */
export function isConversionOnlyOnEarth(buildableId: string): boolean {
  return isVenueUsage(buildableId)
}
