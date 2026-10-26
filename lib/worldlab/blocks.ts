// lib/worldlab/blocks.ts
// Der Baukasten: wie jede Blockart aussieht. Ohne gezeichnete Bilder sind es
// einfarbige Quader mit Walmdach; liegen Bilder vor (DRAWN), werden sie auf
// Wände und Dachflächen gelegt. Zeichenvorlage: docs/workstreams/world-map-zeichenvorlage.md

import type { AreaKind, BlockKind, RoadClass } from './simplify'

export interface BlockStyle {
  wallLight: number
  wallDark: number
  roof: number
  /** Höhe eines Geschosses in Metern – mal 16 ergibt die Bildhöhe eines Wandbildes in Pixeln. */
  storeyM: number
  /** Dachaufbau über der Traufe in Metern. */
  roofM: number
  /** Breite eines Wandabschnitts in der Vorlage (Meter); das Bild wiederholt sich nach rechts. */
  bayM: number
}

export const BLOCK_STYLES: Record<BlockKind, BlockStyle> = {
  // Geschosshöhen auf ganze Pixel bei 16 px je Meter: 3 m = 48 px, 4 m = 64 px, 3,5 m = 56 px, 2,5 m = 40 px.
  house:  { wallLight: 0xf4ead6, wallDark: 0xd9c9a8, roof: 0xb8553a, storeyM: 3, roofM: 2.4, bayM: 3 },
  row:    { wallLight: 0xefe6d8, wallDark: 0xcfc2ad, roof: 0x9c4a36, storeyM: 3, roofM: 2, bayM: 3 },
  hall:   { wallLight: 0xd9dee0, wallDark: 0xb4bcc0, roof: 0x8d979c, storeyM: 4, roofM: 0.8, bayM: 6 },
  // Fabrik: Wellblech, Fensterband, Tore; flaches Sheddach (Sägezahn-Oberlichter) als Dachbild.
  factory: { wallLight: 0xc9d0d4, wallDark: 0xa3abb0, roof: 0x7a8288, storeyM: 5, roofM: 0, bayM: 6 },
  church: { wallLight: 0xe9e2d2, wallDark: 0xc6bca6, roof: 0x5f6e7a, storeyM: 3.5, roofM: 5, bayM: 4 },
  shed:   { wallLight: 0xcdbfa6, wallDark: 0xa99a80, roof: 0x7d6a55, storeyM: 2.5, roofM: 0.6, bayM: 3 },
}

export const GROUND_COLOR = 0xa9bd8c
export const AREA_COLORS: Record<AreaKind, number> = {
  field: 0xbfcf93, built: 0xcfc9b4, garden: 0x9fc283, forest: 0x6f9a62, water: 0x6fb1d6,
  park: 0x8fbd72, playground: 0xdcc898, cemetery: 0x8eae78, allotments: 0xa3c27c, parking: 0xb4b3ae, pool: 0x74c4e6,
  grounds: 0xb9c6a0, track: 0xb5654a, pitch: 0x5f9e4c, sand: 0xd9c49a, hardcourt: 0xa8a49d, clay: 0xc06e4a,
  plaza: 0xd9d4c8,
}
/** Randlinie für Flächen, die eine haben (Spielfeld: helle Markierung, Becken: heller Rand). */
export const AREA_OUTLINES: Partial<Record<AreaKind, { widthM: number; color: number }>> = {
  pitch: { widthM: 0.8, color: 0xf2f5ec },
  clay: { widthM: 0.6, color: 0xf2f5ec },
  pool: { widthM: 1.2, color: 0xeef3f4 },
  track: { widthM: 0.5, color: 0xf2f5ec },
  playground: { widthM: 0.5, color: 0x9a7f52 },
  parking: { widthM: 0.4, color: 0x8e8d88 },
}

/**
 * Muster auf Flächen, damit man sie auf einen Blick erkennt. Die Ansicht
 * erzeugt die Muster selbst (keine Bilddateien); `sizeM` ist die Kantenlänge
 * einer Musterkachel am Boden.
 *   trees   – Baumkronen (Wald dicht, Park locker, Friedhof vereinzelt)
 *   graves  – Grabreihen
 *   plots   – Parzellen mit Beeten und Laube
 *   stalls  – Stellplatz-Markierung
 *   rows    – Ackerfurchen
 */
export type AreaPattern = { kind: 'trees' | 'graves' | 'plots' | 'stalls' | 'rows'; sizeM: number; density?: number }
export const AREA_PATTERNS: Partial<Record<AreaKind, AreaPattern>> = {
  forest: { kind: 'trees', sizeM: 24, density: 1 },
  park: { kind: 'trees', sizeM: 32, density: 0.18 },
  cemetery: { kind: 'graves', sizeM: 16 },
  allotments: { kind: 'plots', sizeM: 30 },
  parking: { kind: 'stalls', sizeM: 15 },
  field: { kind: 'rows', sizeM: 12 },
}
export const ROAD_STYLES: Record<RoadClass, { widthM: number; color: number }> = {
  main: { widthM: 9, color: 0xf2ead8 },
  street: { widthM: 6, color: 0xe9e2d0 },
  service: { widthM: 3.6, color: 0xe2dbc8 },
  path: { widthM: 2.2, color: 0xd8cfb8 },
}
/** Laufbahn als Linie: rotes Band mit sechs Bahnen (7,3 m). */
export const TRACK_STYLE = { widthM: 7.3, color: 0xb5654a, laneColor: 0xf2f5ec }
export const RIVER_STYLE = { widthM: 5, color: 0x6fb1d6 }
export const OUTLINE = 0x5b4a3c

/** Gezeichnete Bilder einer Blockart (Pfade unter /public). Jedes darf fehlen. */
export interface BlockArt {
  /** Erdgeschoss: ein Geschoss hoch, wiederholt sich nach rechts. */
  wallGround?: string
  /** Obergeschoss: ein Geschoss hoch, wiederholt sich nach rechts und nach oben. Fehlt es, gilt das Erdgeschoss. */
  wallUpper?: string
  /** Dachfläche: Ziegelreihen waagerecht, wiederholt sich in beide Richtungen. */
  roof?: string
}

export const ART_FILES = { wallGround: 'wand-erdgeschoss.png', wallUpper: 'wand-obergeschoss.png', roof: 'dach.png' } as const

/** Ordner für fertige Zeichnungen: public/worldlab/blocks/<art>/<datei>. */
export const ART_DIR = '/worldlab/blocks'
/** Ordner mit den Vorlagen zum Übermalen; stehen auf der Karte, solange keine eigene Zeichnung eingetragen ist. */
export const TEMPLATE_DIR = '/worldlab/vorlagen'

/**
 * Welche Zeichnungen es gibt. Eine neue Zeichnung: Datei nach ART_DIR legen und
 * hier eintragen, z. B. house: { wallGround: true, roof: true }.
 */
export const DRAWN: Partial<Record<BlockKind, Partial<Record<keyof BlockArt, true>>>> = {
  // Erzeugt von scripts/worldlab-blocks.py (13.10.2026).
  house: { wallGround: true, wallUpper: true, roof: true },
  row: { wallGround: true, wallUpper: true, roof: true },
  hall: { wallGround: true, wallUpper: true, roof: true },
  factory: { wallGround: true, wallUpper: true, roof: true },
  church: { wallGround: true, wallUpper: true, roof: true },
  shed: { wallGround: true, wallUpper: true, roof: true },
}

/**
 * Pfade der Bilder für alle Blockarten.
 * - 'drawn': fertige Zeichnung aus DRAWN, wo es eine gibt, sonst die Vorlage (Standard)
 * - 'template': nur Vorlagen
 * - 'none': keine Bilder, einfarbige Quader
 */
export function blockArt(source: 'drawn' | 'template' | 'none'): Partial<Record<BlockKind, BlockArt>> {
  const out: Partial<Record<BlockKind, BlockArt>> = {}
  if (source === 'none') return out
  for (const kind of Object.keys(BLOCK_STYLES) as BlockKind[]) {
    const art: BlockArt = {}
    for (const part of Object.keys(ART_FILES) as Array<keyof BlockArt>) {
      const drawn = source === 'drawn' && DRAWN[kind]?.[part]
      art[part] = `${drawn ? ART_DIR : TEMPLATE_DIR}/${kind}/${ART_FILES[part]}`
    }
    out[kind] = art
  }
  return out
}

/**
 * Aussehen von NOXIA-Gebäuden, die auf einem echten Gebäude stehen: Der Grundriss
 * kommt aus der Karte, Dachfarbe und Geschosse von hier. Ohne Eintrag gilt
 * NOXIA_DEFAULT_LOOK – ein blaues Dach, damit eigene Gebäude auffallen.
 */
export interface NoxiaLook { roof: number; levels?: number }
export const NOXIA_DEFAULT_LOOK: NoxiaLook = { roof: 0x3b5b86 }
export const NOXIA_LOOKS: Record<string, Partial<NoxiaLook>> = {
  // Bogenstraße 15: Bungalow von 1971 mit dunkelblauem Walmdach (Thomas, 13.10.2026)
  ssf_headquarters_sundern: { roof: 0x24324a, levels: 1 },
  // Gekauftes reales Gebäude: sieht aus wie vorher, nur der Eigentümer ist neu.
  acquired_building: { roof: undefined },
}
