import { describe, expect, it } from 'vitest'
import { cellsAround, mapPeersFrom, presenceCell } from './mapPresence'

describe('map presence (W-16 Punkt 1)', () => {
  const now = 1_000_000
  const here = { lat: 51.3311, lon: 8.0047 }
  it('listens to the own cell and its eight neighbours', () => {
    const cells = cellsAround(here.lat, here.lon)
    expect(cells).toHaveLength(9)
    const own = presenceCell(here.lat, here.lon)
    expect(cells[0]).toBe(`${own.i}:${own.j}`)
    expect(new Set(cells).size).toBe(9)
  })
  it('lists others nearby, newest entry per player across cells', () => {
    const peers = mapPeersFrom([
      { me: [{ name: 'Thomas', lat: here.lat, lon: here.lon, at: now }], anna: [{ name: 'Anna', lat: 51.3312, lon: 8.0048, at: now - 3000 }] },
      { anna: [{ name: 'Anna', lat: 51.3320, lon: 8.0050, at: now - 1000, emote: { text: 'winkt', at: now - 500 } }], far: [{ name: 'Fern', lat: 51.4, lon: 8.0, at: now }] },
      { old: [{ name: 'Alt', lat: here.lat, lon: here.lon, at: now - 200_000 }], broken: [{ name: 'Kaputt' }] },
    ], 'me', here, now)
    expect(peers.map(p => p.name)).toEqual(['Anna'])
    expect(peers[0]).toMatchObject({ profileId: 'anna', lat: 51.332, emote: { text: 'winkt' } })
  })
  it('drops old gestures', () => {
    const peers = mapPeersFrom([{ ben: [{ name: 'Ben', lat: here.lat, lon: here.lon, at: now, emote: { text: 'winkt', at: now - 20_000 } }] }], 'me', here, now)
    expect(peers[0].emote).toBeNull()
  })
})
