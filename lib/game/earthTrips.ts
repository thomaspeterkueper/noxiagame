// lib/game/earthTrips.ts
// Reisen auf der Erde über das Reisebüro (Thomas, 27.10.2026: „Reisebüro, auch
// für Reisen zu anderen Gegenden der Erde, nicht nur im Weltraum“).
// Ziele sind die Orte mit Kartendaten (celestial_regions der Erde). Bis 400 km
// fährt man Bahn, darüber fliegt man. Preis und Dauer hängen an der Strecke;
// die Dauer folgt der Spieluhr (60-fach, Thomas 12.10.2026), höchstens fünf
// Minuten echte Zeit, damit niemand eine halbe Stunde vor dem Bildschirm wartet.

export type EarthTripMode = 'rail' | 'air'
export interface GeoPoint { lat: number; lon: number }

export interface EarthDestination { slug: string; name: string; country: string | null; at: GeoPoint }
export interface EarthTripOffer extends EarthDestination { mode: EarthTripMode; distanceKm: number; price: number; durationSeconds: number }

/** Bis zu dieser Entfernung Bahn, darüber Flug. */
export const RAIL_MAX_KM = 400
/** Ziele näher als das gelten als „hier“ und werden nicht angeboten. */
export const SAME_PLACE_KM = 15
/** Zwei Regionen näher als das sind derselbe Ort (z. B. Sauerland und Sundern). */
export const DUPLICATE_KM = 5
/** Spieluhr: eine Spielstunde dauert 60 echte Sekunden. */
export const GAME_SECONDS_PER_REAL_SECOND = 60
export const MAX_TRIP_SECONDS = 300

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function tripMode(km: number): EarthTripMode {
  return km <= RAIL_MAX_KM ? 'rail' : 'air'
}

/** Bahn: 8 Cr + 0,15 Cr/km. Flug: 60 Cr + 0,04 Cr/km (Mondticket zum Vergleich: 500 Cr). */
export function tripPrice(km: number, mode: EarthTripMode = tripMode(km)): number {
  return Math.round(mode === 'rail' ? 8 + 0.15 * km : 60 + 0.04 * km)
}

/** Bahn 120 km/h plus eine halbe Stunde, Flug 800 km/h plus zweieinhalb Stunden – in Spielzeit, umgerechnet auf echte Sekunden. */
export function tripSeconds(km: number, mode: EarthTripMode = tripMode(km)): number {
  const gameHours = mode === 'rail' ? km / 120 + 0.5 : km / 800 + 2.5
  return Math.max(10, Math.min(MAX_TRIP_SECONDS, Math.round(gameHours * 3600 / GAME_SECONDS_PER_REAL_SECOND)))
}

/** Ortsname aus einer Regionsbezeichnung: „Frankfurt am Main, Hessen, Deutschland“ → Frankfurt am Main / Deutschland. */
export function regionName(label: string): { name: string; country: string | null } {
  const text = label.trim()
  if (text.includes('·')) {
    const parts = text.split('·').map(part => part.trim()).filter(part => part && part !== 'Earth')
    return { name: parts[parts.length - 1] ?? text, country: parts.length > 1 ? parts[0] : null }
  }
  const parts = text.split(',').map(part => part.trim()).filter(Boolean)
  return { name: parts[0] ?? text, country: parts.length > 1 ? parts[parts.length - 1] : null }
}

export function earthTripOffers(from: GeoPoint, destinations: readonly EarthDestination[]): EarthTripOffer[] {
  const offers: EarthTripOffer[] = []
  for (const destination of destinations) {
    const km = distanceKm(from, destination.at)
    if (km < SAME_PLACE_KM) continue
    // Zwei Regionen am selben Ort (z. B. Sauerland und Sundern): nur eine anbieten
    if (offers.some(offer => distanceKm(offer.at, destination.at) < DUPLICATE_KM)) continue
    const mode = tripMode(km)
    offers.push({ ...destination, mode, distanceKm: Math.round(km), price: tripPrice(km, mode), durationSeconds: tripSeconds(km, mode) })
  }
  return offers.sort((a, b) => a.distanceKm - b.distanceKm)
}
