import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { storedTileValid, TILE_FORMAT_FILES, TILE_FORMAT_SOURCES } from './tileFormat'

describe('Kachelformat', () => {
  it('ist erhöht, wenn sich die Erzeugung der Kacheln geändert hat', () => {
    const hash = createHash('sha256')
    for (const file of TILE_FORMAT_FILES) hash.update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))
    const now = hash.digest('hex').slice(0, 16)
    expect(now, `Kachelerzeugung geändert: in lib/worldlab/tileFormat.ts TILE_FORMAT erhöhen und TILE_FORMAT_SOURCES = '${now}' setzen – sonst liefert world_tiles alte Kacheln.`).toBe(TILE_FORMAT_SOURCES)
  })
})

describe('abgelegte Kachel', () => {
  const stored = { format: 'f1', region_revs: { a: 2, b: 0 } }
  it('gilt bei gleichem Format und Stand', () => expect(storedTileValid(stored, 'f1', { a: 2, b: 0 })).toBe(true))
  it('verfällt bei neuem Format', () => expect(storedTileValid(stored, 'f2', { a: 2, b: 0 })).toBe(false))
  it('verfällt, wenn eine Region neue Objekte hat', () => expect(storedTileValid(stored, 'f1', { a: 3, b: 0 })).toBe(false))
  it('verfällt, wenn eine Region dazukam oder wegfiel', () => {
    expect(storedTileValid(stored, 'f1', { a: 2, b: 0, c: 0 })).toBe(false)
    expect(storedTileValid(stored, 'f1', { a: 2 })).toBe(false)
  })
})
