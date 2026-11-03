// lib/worldlab/earthNames.ts
// W-8 (Gastronomie, 28.10.2026): Gebäudenamen auf der Erde ohne Kolonie-Vokabular.
// Ein Pfarrer im Sauerland war „auf dem Weg zum Habitat“ – der Name kam aus
// building_definitions. Auf der Erde heißen diese Bauten so, wie man sie dort nennt;
// auf Mond und Mars bleibt „Habitat“ richtig. Gilt für Beschriftung, Gebäudetafel,
// Zielliste und Gesprächsfakten der Weltkarte.

export const EARTH_BUILDING_NAMES: Record<string, string> = {
  habitat: 'Wohnhaus',
  residential_block: 'Wohnblock',
}

/** Name einer Gebäudeart auf der Erde (sonst der allgemeine Name). */
export function earthBuildingName(typeId: string, generic: string | undefined): string {
  return EARTH_BUILDING_NAMES[typeId] ?? generic ?? typeId
}

/**
 * Schildname: Art · eigener Name („Bar · Metropol“). Beginnt der eigene Name schon
 * mit der Art („Reisebüro · Hauptstraße 47“), nicht doppelt (03.11.2026). Gekaufte
 * Häuser tragen nur ihren Namen.
 */
export function buildingLabel(typeId: string, generic: string | undefined, displayName: string | null | undefined): string {
  const kind = generic ?? typeId
  const own = displayName?.trim()
  if (!own) return kind
  if (typeId === 'acquired_building') return own
  if (own.toLocaleLowerCase('de').startsWith(kind.toLocaleLowerCase('de'))) return own
  return `${kind} · ${own}`
}
