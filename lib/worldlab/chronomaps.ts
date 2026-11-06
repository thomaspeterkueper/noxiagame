/**
 * Register der Erlebnisse (Chronomaps, Spiele, Abstraktes). Speist beide Zugänge:
 * Erlebnis-Studios (NOXIA-Gebäudeart `immersion_studio`: man legt sich in einen Pod) und den Button am historischen Ort.
 * Inhalte kommen später aus dem Wissensgraphen (reales Wissen) und den Büchern (Ergänzung).
 */
export interface GeoPt { lat: number; lon: number }

export interface Chronomap {
  id: string
  /** chronotrip: Zeitreise an einen Ort der Erde; site: begehbarer Ort der Gegenwart (z. B. die Grabung); game: ein Spiel (z. B. Endia); abstract: reine Erfahrungswelt */
  category: 'chronotrip' | 'site' | 'game' | 'abstract'
  title: string
  /** Epoche, frei lesbar */
  era: string
  /** Startpunkt in der Gegenwartskarte (Konstantinopel: Theodosianischer Hafen, Yenikapı) */
  start: GeoPt
  /** Namen (kleingeschrieben, ohne Akzente) von Orten/Gebäuden, die den Button „Zeitreise" erhalten */
  placeNames: string[]
  /** Reale Gegend, in der Timetravel-Agencys stehen */
  agencyArea: { center: GeoPt; radiusM: number }
  status: 'planned' | 'playable'
}

export const CHRONOMAPS: Chronomap[] = [
  {
    id: 'dvaraka-1600-bc', category: 'chronotrip', title: 'Dvārakā – die Stadt vor dem Bruch', era: 'um 1600 v. Chr. · erste Szene: die dritte Nacht',
    start: { lat: 22.2394, lon: 68.9678 }, placeNames: ['dvaraka', 'dwarka', 'hafen dvaraka'],
    agencyArea: { center: { lat: 22.2394, lon: 68.9678 }, radiusM: 4000 }, status: 'playable',
  },
  {
    id: 'dvaraka-grabung', category: 'site', title: 'Dvārakā – die Grabung', era: 'Gegenwart (2086)',
    start: { lat: 22.2394, lon: 68.9678 }, placeNames: [],
    agencyArea: { center: { lat: 22.2394, lon: 68.9678 }, radiusM: 4000 }, status: 'playable',
  },
  {
    id: 'konstantinopel-hafen', category: 'chronotrip', title: 'Konstantinopel – der Hafen', era: 'Spätantike bis Mittelalter',
    start: { lat: 40.999, lon: 28.9515 }, placeNames: ['hagia sophia', 'ayasofya', 'hippodrom', 'sultanahmet', 'theodosianischer hafen', 'yenikapi'],
    agencyArea: { center: { lat: 41.008, lon: 28.96 }, radiusM: 5000 }, status: 'planned',
  },
  { id: 'endia', category: 'game', title: 'Endia', era: 'Spielwelt', start: { lat: 0, lon: 0 }, placeNames: [], agencyArea: { center: { lat: 0, lon: 0 }, radiusM: 0 }, status: 'planned' },
  { id: 'abstrakt-1', category: 'abstract', title: 'Abstrakte Räume', era: 'ohne Zeit', start: { lat: 0, lon: 0 }, placeNames: [], agencyArea: { center: { lat: 0, lon: 0 }, radiusM: 0 }, status: 'planned' },
]

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Chronomaps, die für einen Ort/ein Gebäude (Name) einen Zeitreise-Button zeigen. */
export function chronomapsForPlace(name: string | undefined): Chronomap[] {
  const n = name ? fold(name) : ''
  if (n.length < 3) return []
  return CHRONOMAPS.filter(map => map.placeNames.some(p => n.includes(p)))
}

/** Chronomaps, deren Studio-Gegend `at` einschließt. */
export function chronomapsNear(at: GeoPt): Chronomap[] {
  return CHRONOMAPS.filter(map => map.category === 'chronotrip' || map.category === 'site').filter(map => {
    const dy = (at.lat - map.agencyArea.center.lat) * 111320
    const dx = (at.lon - map.agencyArea.center.lon) * 111320 * Math.cos(at.lat * Math.PI / 180)
    return Math.hypot(dx, dy) <= map.agencyArea.radiusM
  })
}

/** Was ein Erlebnis-Studio bei `at` anbietet: Zeitreisen der Gegend plus alle Spiele und abstrakten Welten. */
export function experiencesAt(at: GeoPt): Chronomap[] {
  return [...chronomapsNear(at), ...CHRONOMAPS.filter(map => map.category === 'game' || map.category === 'abstract')]
}
