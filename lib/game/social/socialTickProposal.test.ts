import { describe, expect, it } from 'vitest'
import { evaluateNpcSocialTick } from './socialTickProposal'
import type { NpcSocialTickInput } from './socialTickProposal'
const input: NpcSocialTickInput = {
  actor: { npcId: 'a', interests: { music: 1 }, needs: { music: 0.9 }, autonomy: 0.6 },
  venues: [{ id: 'club', purposes: ['music'], open: true, accessible: true,
    visitorCapacityAvailable: true, routeReachable: true, travelCost: 0.1 }],
  socialContext: { unfamiliar: false, perceivedRisk: 0, trustedCompanion: false },
  current: null, tickTime: 100, enabled: true,
}
describe('social tick proposal boundary', () => {
  it('does nothing when disabled', () => {
    const result = evaluateNpcSocialTick({ ...input, enabled: false })
    expect(result.proposal.action).toBe('wait')
    expect(result.proposal.next).toBeNull()
  })
  it('proposes rather than executes venue decisions', () => {
    const result = evaluateNpcSocialTick(input)
    expect(result.proposal.action).toBe('propose')
    expect(result.proposal.next?.venueId).toBe('club')
    expect(result.requiresCoreValidation).toBe(true)
  })
  it('cannot propose visits to inaccessible venues', () => {
    const venues = input.venues.map(v => ({ ...v, accessible: false }))
    expect(evaluateNpcSocialTick({ ...input, venues }).proposal.next).toBeNull()
  })
})
