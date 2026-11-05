// lib/worldlab/placeNames.ts
// Namen, die in OpenStreetMap fehlen, aber bekannt sind (von Thomas genannt).
// Nur echte Namen echter Orte – nichts erfinden. Schlüssel: OSM-Kennung.

export const PLACE_NAMES: Readonly<Record<string, string>> = {
  // Sundern, Neuer Friedhof (Thomas, 05.11.2026, Stadtplan Sundern: „Auferstehungskapelle“)
  'osm:way:246550928': 'Auferstehungskapelle',
}

export function knownPlaceName(source: unknown): string | undefined {
  return typeof source === 'string' ? PLACE_NAMES[source] : undefined
}
