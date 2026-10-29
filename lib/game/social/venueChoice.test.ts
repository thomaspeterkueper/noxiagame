import { describe, expect, it } from 'vitest'
import { chooseGroupVenue, type NpcPreference, type VenueOption } from './venueChoice'
const pair: NpcPreference[] = [
  { npcId: 'a', interests: { music: 1, food: 0.2 }, needs: { music: 0.9 }, autonomy: 0.9 },
  { npcId: 'b', interests: { music: 0.8, food: 0.2 }, needs: { music: 0.8 }, autonomy: 0.4 },
]
const venue = (id: string, purposes: VenueOption['purposes']): VenueOption => ({
  id, purposes, open: true, accessible: true, visitorCapacityAvailable: true,
  routeReachable: true, travelCost: 0.1,
})
describe('autonomous NPC venue choice', () => {
  it('can choose music over the cafe without a hardcoded destination', () => {
    expect(chooseGroupVenue(pair, [venue('cafe', ['food']), venue('club', ['music'])])?.venueId).toBe('club')
  })
  it('rejects unreachable, closed, private and fully occupied venues', () => {
    const opts = [venue('club', ['music']), venue('cafe', ['food'])]
    for (const field of ['open', 'accessible', 'visitorCapacityAvailable', 'routeReachable'] as const) {
      expect(chooseGroupVenue(pair, [{ ...opts[0], [field]: false }, opts[1]])?.venueId).not.toBe('club')
    }
  })
  it('can decline every venue and never forces absent members', () => {
    expect(chooseGroupVenue([], [venue('club', ['music'])])).toBeNull()
    expect(chooseGroupVenue(pair, [venue('closed', ['music'])], 1)).toBeNull()
    expect(chooseGroupVenue(pair, [{ ...venue('club', ['music']), open: false }])).toBeNull()
  })
  it('is stable and independent of input ordering on ties', () => {
    const a = venue('a', ['music']), b = venue('b', ['music'])
    expect(chooseGroupVenue(pair, [b, a])?.venueId).toBe('a')
    expect(chooseGroupVenue(pair, [a, b])?.venueId).toBe('a')
  })
})
