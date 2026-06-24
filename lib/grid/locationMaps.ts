// lib/grid/locationMaps.ts
// Erstellt: 24.06.2026
// Version: 0.4.0
//
// Feste Terrain-Layer pro Standort. Das ist der Zwischenschritt zwischen
// prozeduralem generateGrid() und späterer Supabase-Tabelle location_tiles.
//
// Kürzel:
// g = grass, f = forest_edge, F = forest_dense, u = urban, s = surface
// r = river seed/path, c = crater, m = mountain, a = canyon, h = shaft, M = metal

export type TerrainCode = string

export const LOCATION_MAPS: Record<string, string[]> = {
  // Earth Terrain v2:
  // - ein ruhiger, sichtbarer Flusslauf von Nord nach Süd
  // - größere Waldgebiete statt verstreuter Bauminseln
  // - Urban-Zonen als zusammenhängende Siedlungs-/Terminalflächen
  // - freie Grasflächen als Bau- und Expansionsraum
  earth: [
    'gfffffggggrgggggggggggguuuuugggggg',
    'fFFFFfggggrgggggggggggguuuuugggggg',
    'fFFFFfggggrrggggggggggguuuuugggggg',
    'fFFFFfgggggrggggggggggguuuuugggggg',
    'fffffggggggrrgggggggggggffffffffgg',
    'ggggggggggggrgggggggggggfFFFFFFfgg',
    'ggssssggggggrgggggggggggfFFFFFFfgg',
    'ggssssggggggrrggggggggggfFFFFFFfgg',
    'ggssssgggggggrggggggggggffffffffgg',
    'ggssssgggggggrrggggggggggggggggggg',
    'ggggggggggggggrgggggsssssggggggggg',
    'fffffgggggggggrgggggsssssggggggggg',
    'fFFFfgggggggggrrggggsssssggggggggg',
    'fFFFfggggggggggrgggggguuuuuugggggg',
    'fFFFfggggggggggrrggggguuuuuugggggg',
    'fFFFfgggggggggggrggggguuuuuugggggg',
    'fffffgggggggggggrggggguuuuuugggggg',
    'ggggggffffffggggrrgggggggggggggggg',
    'ggggggfFFFFfgggggrgggggggggggggggg',
    'ggggggfFFFFfgggggrrggggggggggggggg',
    'ggggggfFFFFfggggggrggggggggggggggg',
    'uuuuugfFFFFfggggggrggggggggggggggg',
    'uuuuugffffffggggggrrgggggggggggggg',
    'uuuuuggggggggggggggrgggggggggggggg',
  ],
  // Moon Terrain v1:
  // - dunkle Mare-Fläche links oben
  // - Kratergürtel links unten
  // - Hochland als ruhige Basisfläche
  // - kleine Forschungs-/Basiszone unten rechts
  moon: [
    'ssssssssssmmssssssssssssssssssss',
    'ssssssssssmmssssssssssssssssssss',
    'ssssssssssmmssssssssssssssssssss',
    'ssssssssssmmssssssssssssssssssss',
    'ccccssssssmmssssssssssssssssssss',
    'ccccssssssmmssssssssssssssssssss',
    'ccccssssssmmssssssssssssuuusssss',
    'ccccssssssmmssssssssssssuuusssss',
    'ccccssssssssssssssssssssuuusssss',
    'ccccssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
  ],
  // Mars Terrain v1:
  // - Kraterfeld im Nordwesten
  // - Valles-Marineris-artiger Canyon in der Mitte
  // - Hochland/Plateau im Norden und Osten
  // - Urban-/Industriecluster im Südosten
  mars: [
    'ccccssssssssmmmmmmmmmmmmmmmmmmmm',
    'ccccssssssssmmmmmmmmmmmmmmmmmmmm',
    'ccccssssssaaaaaaammmmmmmmmmmmmmm',
    'ccccssssssaaaaaaammmmmmmmmmmmmmm',
    'ssssssssssaaaaaaammmmmuuuuuummmm',
    'ssssssssssaaaaaaammmmmuuuuuummmm',
    'ssssssssssssssssssuuuuuuuuuummmm',
    'ssssssssssssssssssuuuuuuuuuummmm',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
    'ssssssssssssssssssssssssssssssss',
  ],
  phobos: [
    'ssshssssssMssssssssssshsssssssss',
    'ssssMssssssssssshsssssssssssssss',
    'ssssssshssssssssssssMsssssssssss',
    'ssssssssssssMssssssssssssshsssss',
    'hssssssssssssssssMssssssssssssss',
    'ssssssMssssshsssssssssssssssssss',
    'ssssssssssssssssssssshssssMsssss',
    'ssssMsssssssssssssssssssssssssss',
    'ssssssssshssssMssssssssssssssshs',
    'ssMsssssssssssssssssssssssssssss',
    'ssssssssssssssshssssssssMsssssss',
    'ssssshssssssssssssssssssssssssss',
    'ssssssssMssssssssssshsssssssssss',
    'ssssssssssssssssssssssssssMsssss',
    'shssssssssssssMsssssssssssssssss',
    'ssssssssshssssssssssssMsssssssss',
    'ssssMssssssssssssssssssssssssshs',
    'ssssssssssssshssssssssssssssssss',
    'ssssssssMssssssssssssssssshsssss',
    'ssssssssssssssssMsssssssssssssss',
    'ssshssssssssssssssssssssMsssssss',
    'ssssssssssssMssssssshsssssssssss',
    'ssssssMssssssssssssssssssssssshs',
    'ssssssssssssssssssssMsssssssssss',
  ],
}

export function terrainCodeToType(code: TerrainCode): string {
  switch (code) {
    case 'g': return 'tile_grass'
    case 'f': return 'tile_forest_edge'
    case 'F': return 'tile_forest_dense'
    case 'u': return 'tile_urban'
    case 'r': return 'river'
    case 'c': return 'tile_crater'
    case 'm': return 'tile_mountain'
    case 'a': return 'tile_canyon'
    case 'h': return 'tile_shaft'
    case 'M': return 'tile_metal'
    case 's':
    default: return 'tile_surface'
  }
}

export function getFixedTerrain(slug: string, r: number, c: number): string | null {
  const rows = LOCATION_MAPS[slug]
  if (!rows || !rows[r]) return null
  const code = rows[r][c]
  return code ? terrainCodeToType(code) : null
}
