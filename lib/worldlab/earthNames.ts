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
