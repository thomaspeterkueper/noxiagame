// Wer ist gerade an einem realen Ort? (NOXIA-NPC-RELIGION-0001, 28.10.2026)
//
// Grundlage ist allein die autoritative Präsenz (person_surface_presence über
// /api/world-lab/people). Ein Innenraum zeigt nur Personen, die laut Simulation
// dort sind: wer dort arbeitet (Pfarrerin, Imam …) und wer zu einem Termin oder
// Besuch da ist. Nichts wird erfunden.

export interface PresenceRow {
  id: string
  displayName: string
  lat: number
  lon: number
  sourceKind: string
  publicRole?: string | null
  activityState?: string | null
  lastAction?: string | null
  /** OSM-Kennung des Gebäudes, an dem die Person ist (z. B. „osm:way:264006197“). */
  placeOsm?: string | null
}

export interface PlacePerson { id: string; name: string; role: string; host: boolean; doing?: string }

const DOING: Record<string, string> = {
  service: 'Gottesdienst',
  open_community: 'offene Gesprächszeit',
  friday_prayer: 'Freitagsgebet',
  shabbat: 'Schabbat',
  aarti: 'Aarti',
  dharma_service: 'Andacht und Dharma-Vortrag',
  resonance_round: 'Resonanzrunde',
}

/** „visit:friday_prayer“ (Besuch) oder „host:friday_prayer“ (trägt den Termin) → „Freitagsgebet“. */
export function doingFromAction(lastAction: string | null | undefined): string | undefined {
  const match = /^(?:visit|host):([a-z_]+)$/.exec(String(lastAction ?? ''))
  return match ? DOING[match[1]] : undefined
}

function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180)
  return Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 111_320 * k)
}

/**
 * Personen an einem Ort: gleiche OSM-Kennung, oder – wenn der Ort keine hat
 * (Kartenpunkt) – höchstens `radiusM` vom Punkt entfernt.
 */
export function peopleAtPlace(
  rows: readonly PresenceRow[],
  place: { osm?: string | null; at: { lat: number; lon: number }; radiusM?: number },
): PlacePerson[] {
  const radius = place.radiusM ?? 40
  const here = rows.filter(row =>
    (row.sourceKind === 'region_feature_anchor' || row.sourceKind === 'building_anchor')
    && (place.osm ? row.placeOsm === place.osm : distanceM(row, place.at) <= radius))
  const people = here.map(row => {
    const doing = doingFromAction(row.lastAction)
    const working = /work|inspect/.test(String(row.activityState ?? ''))
    const hosting = String(row.lastAction ?? '').startsWith('host:')
    return { id: row.id, name: row.displayName, role: row.publicRole || 'Besucher(in)', host: hosting || (working && !doing), doing }
  })
  // Wer den Ort trägt, ist beim Termin mit dabei: gleicher Anlass.
  const event = people.find(person => person.doing)?.doing
  return people
    .map(person => person.host && event ? { ...person, doing: event } : person)
    .sort((a, b) => Number(b.host) - Number(a.host) || a.name.localeCompare(b.name))
}
