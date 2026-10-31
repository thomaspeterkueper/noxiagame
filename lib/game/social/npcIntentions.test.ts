import { describe, expect, it } from 'vitest'
import { reconsiderNpcPlan } from './npcIntentions'
import type { NpcPreference, VenueOption } from './venueChoice'
const actor: NpcPreference = { npcId: 'a', interests: { music: 0.9, food: 0.1 }, needs: { music: 0.8 }, autonomy: 0.8 }
const venue = (id: string, purposes: VenueOption['purposes']): VenueOption => ({
  id, purposes, accessible: true, open: true, visitorCapacityAvailable: true,
  routeReachable: true, travelCost: 0.1,
})
describe('NPC intention proposals', () => {
  it('forms personal goals from preferences without a scripted cafe', () => {
    const result = reconsiderNpcPlan({ actor, venues: [venue('cafe',['food']), venue('club',['music'])], current: null, now: 100 })
    expect(result.action).toBe('propose')
    expect(result.next?.venueId).toBe('club')
  })
  it('preserves commitments during cooldown', () => {
    const current = { npcId: 'a', venueId: 'cafe', reason: 'personal_need' as const, createdAt: 100, lockedUntil: 250 }
    expect(reconsiderNpcPlan({ actor, venues: [venue('club',['music'])], current, now: 150 }).action).toBe('keep')
  })
  it('can reconsider when preferences change and commitment expires', () => {
    const current = { npcId: 'a', venueId: 'cafe', reason: 'personal_need' as const, createdAt: 100, lockedUntil: 200 }
    const result = reconsiderNpcPlan({ actor, venues: [venue('club',['music'])], current, now: 250 })
    expect(result.action).toBe('switch')
    expect(result.next?.venueId).toBe('club')
  })
  it('does not treat an unaccepted invitation as consent', () => {
    const result = reconsiderNpcPlan({ actor, venues: [venue('club',['music'])], current: null, now: 250,
      encounter: { counterpartId: 'b', familiarity: 1, invitationAccepted: false, urgentSafetyEvent: false } })
    expect(result.next?.reason).toBe('personal_need')
  })
  it('defers safety situations to the authoritative core', () => {
    const result = reconsiderNpcPlan({ actor, venues: [venue('club',['music'])], current: null, now: 250,
      encounter: { counterpartId: 'b', familiarity: 1, invitationAccepted: true, urgentSafetyEvent: true } })
    expect(result.action).toBe('wait')
    expect(result.next).toBeNull()
  })
})
