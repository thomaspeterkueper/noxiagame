/**
 * Register der Chronomaps (Zeitreisen). Speist beide Zugänge:
 * Timetravel-Agencys (eigene Ortsart `timetravel_agency`) und den Button am historischen Ort.
 * Inhalte kommen später aus dem Wissensgraphen (reales Wissen) und den Büchern (Ergänzung).
 */
export interface GeoPt { lat: number; lon: number }

export interface Chronomap {
  id: string
  title: string
  /** Epoche, frei lesbar */
  era: string
  /** Startpunkt in der Gegenwartskarte (Konstantinopel: der Hafen) */
  start: GeoPt
  /** Namen (kleingeschrieben, ohne Akzente) von Orten/Gebäuden, die den Button „Zeitreise" erhalten */
  placeNames: string[]
  /** Reale Gegend, in der Timetravel-Agencys stehen */
  agencyArea: { center: GeoPt; radiusM: number }
  status: 'planned' | 'playable'
}

export const CHRONOMAPS: Chronomap[] = [
  {
    id: 'dvaraka-1600-bc', title: 'Dvārakā – die Stadt vor dem Bruch', era: 'um 1600 v. Chr.',
    start: { lat: 22.2394, lon: 68.9678 }, placeNames: ['dvaraka', 'dwarka', 'hafen dvaraka'],
    agencyArea: { center: { lat: 22.2394, lon: 68.9678 }, radiusM: 4000 }, status: 'planned',
  },
  {
    id: 'konstantinopel-hafen', title: 'Konstantinopel – der Hafen', era: 'Spätantike bis Mittelalter',
    start: { lat: 41.0136, lon: 28.9784 }, placeNames: ['hagia sophia', 'ayasofya', 'hippodrom', 'sultanahmet', 'theodosianischer hafen', 'yenikapi'],
    agencyArea: { center: { lat: 41.0082, lon: 28.9784 }, radiusM: 3000 }, status: 'planned',
  },
]

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Chronomaps, die für einen Ort/ein Gebäude (Name) einen Zeitreise-Button zeigen. */
export function chronomapsForPlace(name: string | undefined): Chronomap[] {
  const n = name ? fold(name) : ''
  if (n.length < 3) return []
  return CHRONOMAPS.filter(map => map.placeNames.some(p => n.includes(p)))
}

/** Chronomaps, deren Timetravel-Agency in der Nähe von `at` liegt. */
export function chronomapsNear(at: GeoPt): Chronomap[] {
  return CHRONOMAPS.filter(map => {
    const dy = (at.lat - map.agencyArea.center.lat) * 111320
    const dx = (at.lon - map.agencyArea.center.lon) * 111320 * Math.cos(at.lat * Math.PI / 180)
    return Math.hypot(dx, dy) <= map.agencyArea.radiusM
  })
}
