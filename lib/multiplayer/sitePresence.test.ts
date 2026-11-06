import { describe, expect, it } from 'vitest'
import { sitePeersFrom } from './sitePresence'

const now = 1_000_000
describe('Gemeinsames Erleben – Präsenz', () => {
  it('ohne mich, ohne Altes, ohne Ungültiges', () => {
    const state = {
      me: [{ name: 'Ich', x: 1, y: 2, at: now }],
      a: [{ name: 'Anna', x: 10.04, y: 5, at: now - 1000 }],
      b: [{ name: 'Alt', x: 1, y: 1, at: now - 60_000 }],
      c: [{ name: 'Kaputt', x: NaN, y: 1, at: now }],
    }
    const peers = sitePeersFrom(state, 'me', now)
    expect(peers.map(p => p.name)).toEqual(['Anna'])
    expect(peers[0].x).toBe(10)
  })
  it('je Spieler der neueste Eintrag, höchstens acht', () => {
    const one = sitePeersFrom({ a: [{ name: 'A', x: 1, y: 1, at: now - 5000 }, { name: 'A', x: 9, y: 9, at: now - 1000 }] }, 'me', now)
    expect(one[0].x).toBe(9)
    const many: Record<string, Array<{ name: string; x: number; y: number; at: number }>> = {}
    for (let i = 0; i < 12; i++) many['p' + i] = [{ name: 'N' + String(i).padStart(2, '0'), x: i, y: 0, at: now }]
    expect(sitePeersFrom(many, 'me', now)).toHaveLength(8)
  })
})
