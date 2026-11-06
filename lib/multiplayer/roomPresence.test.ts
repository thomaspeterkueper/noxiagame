import { describe, expect, it } from 'vitest'
import { PEER_STALE_MS, peersFrom } from './roomPresence'

describe('peersFrom', () => {
  const now = 1_000_000
  it('lists others, not me, and drops stale or broken entries', () => {
    const peers = peersFrom({
      me: [{ name: 'Thomas', x: 1, y: 1, at: now }],
      anna: [{ name: 'Anna', x: 100, y: 200, seated: true, role: null, at: now - 5000 }],
      old: [{ name: 'Alt', x: 5, y: 5, at: now - 200_000 }],
      broken: [{ name: 'Kaputt' }],
    }, 'me', now)
    expect(peers.map(p => p.name)).toEqual(['Anna'])
    expect(peers[0]).toMatchObject({ profileId: 'anna', seated: true, x: 100, y: 200 })
  })
  it('drops a player who missed two heartbeats (30 s each)', () => {
    const peers = peersFrom({
      left: [{ name: 'Rawdium', x: 10, y: 10, at: now - 80_000 }],
      here: [{ name: 'Anna', x: 10, y: 10, at: now - 31_000 }],
    }, 'me', now)
    expect(PEER_STALE_MS).toBeLessThan(90_000)
    expect(peers.map(p => p.name)).toEqual(['Anna'])
  })
  it('keeps the newest entry of a player with two tabs and limits text', () => {
    const peers = peersFrom({ ben: [{ name: 'Ben', x: 1, y: 1, at: now }, { name: 'Ben', x: 9, y: 9, at: now, emote: { text: 'winkt', at: now } }] }, 'me', now)
    expect(peers[0]).toMatchObject({ x: 9, emote: { text: 'winkt' } })
  })
})
