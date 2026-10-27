// lib/worldlab/tileFormat.ts
// Kennung des Kachelformats für abgelegte Kacheln (world_tiles, Aufgabe 3).
//
// Ändert sich, wie eine Kachel aus den Kartendaten entsteht, müssen alle abgelegten
// Kacheln neu erzeugt werden. Dafür wird TILE_FORMAT erhöht. Damit das nicht
// vergessen wird, prüft tileFormat.test.ts einen Fingerabdruck der Dateien, aus
// denen eine Kachel entsteht: Stimmt er nicht, schlägt der Test fehl und nennt den
// neuen Wert für TILE_FORMAT_SOURCES.

/** Erhöhen, wenn sich die Erzeugung der Kacheln ändert. */
export const TILE_FORMAT = '2026-10-27.1'

/** Dateien, aus denen eine Kachel entsteht (relativ zum Projekt). */
export const TILE_FORMAT_FILES = ['lib/worldlab/simplify.ts', 'lib/worldlab/lineDetails.server.ts', 'lib/worldlab/mercator.ts']

/** Fingerabdruck dieser Dateien beim letzten Erhöhen von TILE_FORMAT (sha256, 16 Zeichen). */
export const TILE_FORMAT_SOURCES = 'ca860ebea09f412b'

/** Abgelegte Kachel noch gültig? Gleiches Format, dieselben Regionen mit demselben Stand. */
export function storedTileValid(stored: { format: string; region_revs: Record<string, number> }, format: string, expected: Record<string, number>): boolean {
  if (stored.format !== format) return false
  const have = Object.keys(stored.region_revs ?? {}), want = Object.keys(expected)
  if (have.length !== want.length) return false
  return want.every(id => stored.region_revs[id] === expected[id])
}
