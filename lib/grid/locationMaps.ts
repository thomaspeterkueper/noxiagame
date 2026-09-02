// lib/grid/locationMaps.ts
// Erstellt: 24.06.2026
// Aktualisiert: 02.09.2026 — Earth v5 als verdichtete Sauerland-Repräsentation
// Version: 0.10.0
//
// Feste Terrain-Layer pro Standort. Das ist der Zwischenschritt zwischen
// prozeduralem generateGrid() und späterer Supabase-Tabelle location_tiles.
//
// Kürzel Basis:
// g = grass, f = forest_edge, F = forest_dense, u = legacy urban, s = surface
// r = river seed/path, c = crater, m = mountain, a = canyon, h = shaft, M = metal
//
// Kürzel spezialisierte Tiles:
// A = farmland, C = city, P = vorbereitete Spaceport-Hardstand-/Betonfläche
// L = mare, q = lunar highland, R = research, X = ice, E = helium-3, T = titanium
// d = mars dust, p = mars plateau
// Gebäude/Anlagen werden nicht durch Terrain-Marker vorgetäuscht; sie kommen
// aus kanonischen Seeds/DB-Entities (Earth: earthStartSeed, Mars: tharsisHubSeed).

export type TerrainCode = string

export const LOCATION_MAPS: Record<string, string[]> = {
  // Earth Terrain v5 / Sauerland:
  // - exakt 32 Spalten × 24 Zeilen
  // - verdichtete, nicht-katastergetreue Repräsentation eines Sauerland-Talraums
  // - Waldgürtel, offenes Grün, Landwirtschaft, Siedlungsanschluss und Fluss/Talzug
  // - südöstliche P-Zone ist der vorbereitete Tharsis-Hub-Hardstand
  // - Gebäude selbst kommen aus lib/game/seeds/earthStartSeed.ts
  earth: [
    'fffffggggggrgggggggggggggggggggg',
    'fFFFfggggggrrggggggggggggggggggg',
    'fFFFfgggggggrggggggggggggffffggg',
    'fffffgggggggrrggggggggggfFFFFfgg',
    'gggggggggggggrgggAAAAgggfFFFFfgg',
    'gggAAAAggggggrgggAAAAgggfffffggg',
    'gggAAAAggggggrrggggggggggggggggg',
    'ggggggggggggggrgggggggggggCCCCgg',
    'ffffggggggggggrrggggggggggCCCCgg',
    'fFFfgggggggggggrggggggggggCCCCgg',
    'fFFfgggggggggggrrggggggggggggggg',
    'ffffggggggggggggrggggggggggggggg',
    'gggggggfffffggggrrgggggggggggggg',
    'gggggggfFFFfgggggrgggggggggggggg',
    'gggggggfFFFfgggggrrggggggggggggg',
    'gggggggfffffggggggrggggggggggggg',
    'ggggggggggggggggggrrgggggggggggg',
    'gggggggggggggggggggrgggggPPPPggg',
    'gggggggggggffffggggrrggggPPPPggg',
    'gggggggggggfFFfgggggrggggPPPPggg',
    'gggAAAAggggfFFfgggggrrgggPPPPggg',
    'gggAAAAggggffffggggggrgggPPPPggg',
    'gggggggggggggggggggggrggCCCCgggg',
    'ffffgggggggggggggggggrrggCCCCggg',
  ],
  // Moon Terrain v3 / Shackleton:
  moon: [
    'XXXXccccssqqqqqqqqqqTTTTqqqqqqqq',
    'XXXcccccSSqqqqqqqqqqTTTTqqqqqqqq',
    'XXccccccSSqqqqRRRqqqqqqqqqqqqqqq',
    'ccccssssSSqqqqRRRqqqqqqqqqqqqqqq',
    'ccccssssssqqqqRRRqqqqEEEEqqqqqqq',
    'ccccssssssqqqqqqqqqqqEEEEqqqqqqq',
    'XXccssssssqqqqqqqqqqqEEEEqqqqqqq',
    'XXXsssssssqqqTTTqqqqqqqqqqqqqqqq',
    'XXsssssssqqqqTTTqqqqqqqRRRqqqqqq',
    'sssssssqqqqqqTTTqqqqqqqRRRqqqqqq',
    'ssssssqqqqqqqqqqqqqqqqqRRRqqqqqq',
    'ssssssqqqqqqqqqqqssssssssqqqqqqq',
    'ssccccqqqqqqqqqqqssssssssqqqqqqq',
    'ssccccqqqqqEEEEqqssssssssqqqqqqq',
    'ssccccqqqqqEEEEqqqqqqqqqqqqqqqqq',
    'ssssssqqqqqEEEEqqqqqTTTqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqTTTqqqqqqqqq',
    'qqqXXXXqqqqqqqqqqqqqTTTqqqqqqqqq',
    'qqqXXXXqqqqqqqqqqqqqqqqqqqqqqqqq',
    'qqqXXXXqqqqqqqqqqqqqRRRqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqRRRqqqqqqqqq',
    'qqqqqqqqqqqqqqqqqqqqRRRqqqqqqqqq',
    'qqqqqqqqqqqccccqqqqqqqqqqqqqqqqq',
    'qqqqqqqqqqqccccqqqqqqqqqqqqqqqqq',
  ],
  // Mars Terrain v4
  mars: [
    'ccccddddddddpppppppppppppppppppp',
    'cccccdddddpppppppppppppppppppppp',
    'ccccdddddddaaaaaaaappppppppppppp',
    'cccddddddddaaaaaaaaapppppppppppp',
    'ccdddddddddaaaaaaaaapppppppppppp',
    'dddddddddddaaaaaaaaapppppppppppp',
    'dddddddddddaaaaaaaaapppppppppppp',
    'dddddddddddaaaaaaaappppppppppppp',
    'dddddddddddsssssddpppppppppppppp',
    'ddddddddssssssssdddppppppppppppp',
    'ddddddssssssssssssdddpppccccpppp',
    'ddddddssssssssssssdddpppccccpppp',
    'ddddddssssssssssssddddppcccccppp',
    'ddddddddssssssssdddddddppccccppp',
    'pppddddddddddddddddddddppppppppp',
    'ppppdddddddddddddddddddddppppppp',
    'pppppdddddddddddddddddddpppppppp',
    'pppppdddddddddddddddddddpppppppp',
    'ppppppddddddddddddddddddddpppppp',
    'ppppppddddddddddddddddddddpppppp',
    'dddddddddddddddddddddddddddddddd',
    'ddddddddddccccdddddddddddddddddd',
    'ddddddddddccccdddddddddddddddddd',
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
    case 'P': return 'tile_concrete'
    case 'L': return 'tile_mare'
    case 'q': return 'tile_highland'
    case 'R': return 'tile_research'
    case 'X': return 'tile_ice'
    case 'E': return 'tile_helium3'
    case 'T': return 'tile_titanium'
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
    case 'S':
    default: return 'tile_surface'
  }
}

export function getFixedTerrain(slug: string, r: number, c: number): string | null {
  const rows = LOCATION_MAPS[slug]
  if (!rows || !rows[r]) return null
  const code = rows[r][c]
  return code ? terrainCodeToType(code) : null
}
