// lib/grid/locationMaps.ts
// Erstellt: 24.06.2026
// Version: 0.5.0
//
// Feste Terrain-Layer pro Standort. Das ist der Zwischenschritt zwischen
// prozeduralem generateGrid() und späterer Supabase-Tabelle location_tiles.
//
// Kürzel Basis:
// g = grass, f = forest_edge, F = forest_dense, u = legacy urban, s = surface
// r = river seed/path, c = crater, m = mountain, a = canyon, h = shaft, M = metal
//
// Kürzel spezialisierte Tiles:
// A = farmland, C = city, P = spaceport
// L = mare, q = lunar highland, R = research
// d = mars dust, p = mars plateau, H = mars habitat, I = mars industry

export type TerrainCode = string

export const LOCATION_MAPS: Record<string, string[]> = {
  // Earth Terrain v3:
  // - Fluss, Waldcluster und freie Grasflächen bleiben erhalten
  // - Städte, Farmland und Raumhafen sind jetzt eigene Tile-Klassen
  earth: [
    'gfffffggggrggggggggggggCCCCPggggg',
    'fFFFFfggggrggggggggggggCCCCPggggg',
    'fFFFFfggggrrgggggggggggCCCCPggggg',
    'fFFFFfgggggrgggggggggggCCCCPggggg',
    'fffffggggggrrgggggggggggffffffffgg',
    'ggggggAAAAAgrgggggggggggfFFFFFFfgg',
    'ggAAAAAgggggrgggggggggggfFFFFFFfgg',
    'ggAAAAAgggggrrggggggggggfFFFFFFfgg',
    'ggAAAAAgggggggrgggggggggffffffffgg',
    'gggggggggggggrrggggggggggggggggggg',
    'ggggggggggggggrgggggCCCCCggggggggg',
    'fffffgggggggggrgggggCCCCCggggggggg',
    'fFFFfgggggggggrrggggCCCCCggggggggg',
    'fFFFfggggggggggrggggggAAAAAggggggg',
    'fFFFfggggggggggrrgggggAAAAAggggggg',
    'fFFFfgggggggggggrgggggAAAAAggggggg',
    'fffffgggggggggggrgggggAAAAAggggggg',
    'ggggggffffffggggrrgggggggggggggggg',
    'ggggggfFFFFfgggggrgggggggggggggggg',
    'ggggggfFFFFfgggggrrggggggggggggggg',
    'ggggggfFFFFfggggggrggggggggggggggg',
    'CCCCPfFFFFfggggggrggggggggggggggg',
    'CCCCPffffffggggggrrgggggggggggggg',
    'CCCCPgggggggggggggrgggggggggggggg',
  ],
  // Moon Terrain v2:
  // - Mare und Hochland sind eigene Tile-Klassen
  // - Forschung/Basisgebiet ist ein eigenes Research-Tile
  moon: [
    'LLLLLqqqqqmmqqqqqqqqqqqqqqqqqqqq',
    'LLLLLqqqqqmmqqqqqqqqqqqqqqqqqqqq',
    'LLLLLqqqqqmmqqqqqqqqqqqqqqqqqqqq',
    'LLLLLqqqqqmmqqqqqqqqqqqqqqqqqqqq',
    'ccccqqqqqqmmqqqqqqqqqqqqqqqqqqqq',
    'ccccqqqqqqmmqqqqqqqqqqqqqqqqqqqq',
    'ccccqqqqqqmmqqqqqqqqqqqqRRRqqqqq',
    'ccccqqqqqqmmqqqqqqqqqqqqRRRqqqqq',
    'ccccqqqqqqqqqqqqqqqqqqqqRRRqqqqq',
    'ccccqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
  ],
  // Mars Terrain v2:
  // - Staub, Plateau, Habitat und Industrie sind eigene Tile-Klassen
  // - Canyon/Krater bleiben geologische Extremzonen
  mars: [
    'ccccddddddddpppppppppppppppppppp',
    'ccccddddddddpppppppppppppppppppp',
    'ccccddddddaaaaaaappppppppppppppp',
    'ccccddddddaaaaaaappppppppppppppp',
    'ddddddddddaaaaaaapppppHHHHHIIppp',
    'ddddddddddaaaaaaapppppHHHHHIIppp',
    'ddddddddddddddddddHHHHHIIIIIIppp',
    'ddddddddddddddddddHHHHHIIIIIIppp',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
    'dddddddddddddddddddddddddddddddd',
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
    case 'A': return 'tile_farmland'
    case 'C': return 'tile_city'
    case 'P': return 'tile_spaceport'
    case 'L': return 'tile_mare'
    case 'q': return 'tile_highland'
    case 'R': return 'tile_research'
    case 'd': return 'tile_dust'
    case 'p': return 'tile_plateau'
    case 'H': return 'tile_habitat'
    case 'I': return 'tile_industry'
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
