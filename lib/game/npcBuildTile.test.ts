import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('naechsteFreieKachel', () => {
  it('weicht belegten Kacheln aus und meldet ein volles Baufeld', async () => {
    const { naechsteFreieKachel } = await import('./tick')
    expect(naechsteFreieKachel([])).toEqual({ row: 7, col: 11 })
    expect(naechsteFreieKachel([{ tile_row: 7, tile_col: 11 }])).toEqual({ row: 7, col: 10 })
    const zeile7 = Array.from({ length: 12 }, (_, col) => ({ tile_row: 7, tile_col: col }))
    expect(naechsteFreieKachel(zeile7)).toEqual({ row: 6, col: 11 })
    const alle = [7, 6, 5].flatMap(row => Array.from({ length: 12 }, (_, col) => ({ tile_row: row, tile_col: col })))
    expect(naechsteFreieKachel(alle)).toBeNull()
  })
})
