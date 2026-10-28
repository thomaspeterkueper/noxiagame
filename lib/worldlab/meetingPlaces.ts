// lib/worldlab/meetingPlaces.ts
// Omnizedenz-Begegnungsstätten leicht findbar machen (Thomas, 28.10.2026).
//
// Eine Liste für Karte, Zielauswahl und Gespräche: feste Orte mit offener
// Resonanzrunde und jedes gebaute oder umgebaute Gebäude der Art
// `resonance_place`. Die Termine entsprechen lib/game/population/realPlaceActivity.ts.

export type GeoPoint = { lat: number; lon: number }

export interface MeetingPlace {
  id: string
  name: string
  /** Ort, wie man ihn nennt (Sundern, Frankfurt am Main …). */
  town: string
  address: string | null
  at: GeoPoint
  /** OSM-Kennung des realen Hauses, falls es eines ist. */
  source: string | null
  /** Offene Resonanzrunde, in Worten. */
  round: string | null
  /** Wer dort einlädt. */
  host: string | null
  /** NOXIA-Gebäude (gekauft und umgebaut oder gebaut). */
  noxiaId?: string
}

export const RESONANCE_BUILDING_TYPES: readonly string[] = ['resonance_place', 'omnizedenz_resonance_place']
export const isResonanceBuilding = (typeId: string | null | undefined) => RESONANCE_BUILDING_TYPES.includes(String(typeId ?? ''))

/** Feste Begegnungsstätten auf der Erde. Mars-Stätten sind gebaute Gebäude. */
export const OMNIZEDENZ_MEETING_PLACES: readonly MeetingPlace[] = [
  {
    id: 'sundern-hauptstrasse-87',
    name: 'Omnizedenz-Begegnungsstätte Sundern',
    town: 'Sundern',
    address: 'Hauptstraße 87',
    at: { lat: 51.32801, lon: 8.004295 },
    source: 'osm:way:459501013',
    round: 'mittwochs 19–21 Uhr',
    host: 'Johanna Lind',
  },
  {
    id: 'frankfurt-artlounge',
    name: 'CAMALEO-ArtLounge',
    town: 'Frankfurt am Main',
    address: 'Mörfelder Landstraße 103',
    at: { lat: 50.096405, lon: 8.684142 },
    source: 'osm:way:265117408',
    round: 'freitags 19–21 Uhr',
    host: 'Samira Haddad',
  },
]

/** NOXIA-Gebäude, wie die Weltkarte sie kennt (Ausschnitt). */
export type MeetingBuilding = { id: string; typeId: string; name: string; lat: number; lon: number; source?: string }

/**
 * Alle Begegnungsstätten: feste Orte, ergänzt um gebaute oder umgebaute Häuser.
 * Steht ein festes Haus als NOXIA-Gebäude im Spiel, wird es mit diesem verknüpft
 * (gleiche OSM-Kennung), statt doppelt zu erscheinen.
 */
export function meetingPlaces(buildings: readonly MeetingBuilding[] = []): MeetingPlace[] {
  const resonance = buildings.filter(building => isResonanceBuilding(building.typeId))
  const fixed = OMNIZEDENZ_MEETING_PLACES.map(place => {
    const built = place.source ? resonance.find(building => building.source === place.source) : undefined
    return built ? { ...place, noxiaId: built.id, at: { lat: built.lat, lon: built.lon } } : { ...place }
  })
  const linked = new Set(fixed.map(place => place.noxiaId).filter(Boolean))
  const extra = resonance.filter(building => !linked.has(building.id)).map((building): MeetingPlace => ({
    id: 'noxia:' + building.id,
    name: building.name.includes('Resonanz') || building.name.includes('Begegnung') ? building.name : `Resonanzplatz · ${building.name}`,
    town: '',
    address: null,
    at: { lat: building.lat, lon: building.lon },
    source: building.source ?? null,
    round: null,
    host: null,
    noxiaId: building.id,
  }))
  return [...fixed, ...extra]
}

export function metresBetween(a: GeoPoint, b: GeoPoint) {
  const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180)
  return Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 111_320 * k)
}

/** Nächste Begegnungsstätte zu einem Punkt. */
export function nearestMeetingPlace(places: readonly MeetingPlace[], from: GeoPoint) {
  let best: { place: MeetingPlace; distanceM: number } | null = null
  for (const place of places) {
    const distanceM = metresBetween(place.at, from)
    if (!best || distanceM < best.distanceM) best = { place, distanceM }
  }
  return best
}

/** Bis zu dieser Entfernung geht man hin; weiter weg braucht es eine Reise. */
export const MEETING_WALK_LIMIT_M = 6000

/** Ein Satz je Stätte für Gespräche und Hinweise. */
export function meetingPlaceLine(place: MeetingPlace) {
  const where = [place.address, place.town].filter(Boolean).join(', ')
  return `${place.name}${where ? ` (${where})` : ''}${place.round ? ` – offene Resonanzrunde ${place.round}` : ''}${place.host ? `, Gastgeberin/Gastgeber ${place.host}` : ''}`
}
