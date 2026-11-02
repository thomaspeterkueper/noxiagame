// lib/worldlab/placeSearch.ts
// Ortssuche im Suchfeld der Weltkarte (Thomas, 02.11.2026: „Seelenberg kennt unser Suchfeld nicht“).
// Das Feld verstand nur Straßen, Adressen und Koordinaten; Orte wie Seelenberg, Vuiteboeuf oder
// Dvārakā stehen als Regionen (celestial_regions.label) in der Datenbank und werden hier gefunden.

export interface PlaceRegion { slug: string; label: string; center_lat: number; center_lon: number }
export interface PlaceHit { lat: number; lon: number; label: string; slug: string }

/** Kleinbuchstaben ohne Akzente und Zeichen wie ā (Dvārakā = dvaraka), ß = ss. */
export function placeKey(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('de').replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

// Zweites Stück eines Namens, das eine Straße ist („dvaraka, Atmakur (N) Main road, …“): ein Straßentreffer, kein Ort.
const STREET_LIKE = /\b(road|street|lane|marg|path|nagar|strasse|straße|weg|platz|allee|rue|avenue)\b/i

/** Namen, unter denen ein Ort gesucht werden kann: erstes Stück des Labels, Klammerzusatz („Dvārakā (Dwarka)“) und beide getrennt. */
export function placeNames(label: string): string[] {
  const first = label.split(',')[0] ?? ''
  const paren = [...first.matchAll(/\(([^)]+)\)/g)].map(m => m[1])
  const bare = first.replace(/\([^)]*\)/g, ' ')
  return [bare, ...paren, first].map(placeKey).filter(Boolean)
}

export function shortPlaceLabel(label: string): string {
  const parts = label.split(',').map(part => part.trim())
  return parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : label
}

export function findPlace(regions: readonly PlaceRegion[], query: string, near?: { lat: number; lon: number } | null): PlaceHit | null {
  const wanted = placeKey(query)
  if (wanted.length < 3) return null
  const distance = (r: PlaceRegion) => near ? Math.hypot(r.center_lat - near.lat, (r.center_lon - near.lon) * Math.cos(near.lat * Math.PI / 180)) : 0
  const usable = regions.filter(region => !STREET_LIKE.test(region.label.split(',')[1] ?? ''))
  const exact = usable.filter(region => placeNames(region.label).includes(wanted))
  const prefix = exact.length ? [] : usable.filter(region => placeNames(region.label).some(name => name.startsWith(wanted)))
  const best = [...exact, ...prefix].sort((a, b) => distance(a) - distance(b))[0]
  return best ? { lat: best.center_lat, lon: best.center_lon, label: shortPlaceLabel(best.label), slug: best.slug } : null
}
