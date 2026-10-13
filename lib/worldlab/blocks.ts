// lib/worldlab/blocks.ts
// Der Baukasten: wie jede Blockart aussieht. Heute sind es gezeichnete Quader
// mit Dach – genau diese Liste wird später durch selbst gezeichnete Bilder
// ersetzt, ohne dass sich an Kacheln oder Karte etwas ändert.

import type { AreaKind, BlockKind, RoadClass } from './simplify'

export interface BlockStyle {
  wallLight: number
  wallDark: number
  roof: number
  /** Höhe eines Geschosses in Metern. */
  storeyM: number
  /** Dachaufbau über der Traufe in Metern. */
  roofM: number
}

export const BLOCK_STYLES: Record<BlockKind, BlockStyle> = {
  house:  { wallLight: 0xf4ead6, wallDark: 0xd9c9a8, roof: 0xb8553a, storeyM: 3, roofM: 2.4 },
  row:    { wallLight: 0xefe6d8, wallDark: 0xcfc2ad, roof: 0x9c4a36, storeyM: 3, roofM: 2 },
  hall:   { wallLight: 0xd9dee0, wallDark: 0xb4bcc0, roof: 0x8d979c, storeyM: 4, roofM: 0.8 },
  church: { wallLight: 0xe9e2d2, wallDark: 0xc6bca6, roof: 0x5f6e7a, storeyM: 3.4, roofM: 5 },
  shed:   { wallLight: 0xcdbfa6, wallDark: 0xa99a80, roof: 0x7d6a55, storeyM: 2.6, roofM: 0.6 },
}

export const GROUND_COLOR = 0xa9bd8c
export const AREA_COLORS: Record<AreaKind, number> = {
  field: 0xbfcf93, built: 0xcfc9b4, forest: 0x6f9a62, water: 0x6fb1d6,
  grounds: 0xb9c6a0, track: 0xb5654a, pitch: 0x5f9e4c,
}
/** Randlinie für Flächen, die eine haben (Spielfeld: helle Markierung). */
export const AREA_OUTLINES: Partial<Record<AreaKind, { widthM: number; color: number }>> = {
  pitch: { widthM: 0.8, color: 0xf2f5ec },
}
export const ROAD_STYLES: Record<RoadClass, { widthM: number; color: number }> = {
  main: { widthM: 9, color: 0xf2ead8 },
  street: { widthM: 6, color: 0xe9e2d0 },
  path: { widthM: 2.2, color: 0xd8cfb8 },
}
export const RIVER_STYLE = { widthM: 5, color: 0x6fb1d6 }
export const OUTLINE = 0x5b4a3c
