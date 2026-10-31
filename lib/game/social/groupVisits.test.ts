import { describe, expect, it } from 'vitest'
import { applyVisitEvent, groupCanSocialize, inviteToVenue } from './groupVisits'

describe('NPC group venue visits (#551)', () => {
  const initial = () => inviteToVenue({
    id: 'visit-1', venueId: 'cafe-1', initiatorId: 'npc-a',
    invitedId: 'npc-b', now: 100,
  })
  it('requires confirmed routes and real access before entering', () => {
    let visit = applyVisitEvent(initial(), { type: 'accept', actorId: 'npc-b' }, 101).visit
    expect(applyVisitEvent(visit, { type: 'enter', actorId: 'npc-a', accessGranted: true, freeVisitorSlots: 2 }, 102).changed).toBe(false)
    expect(applyVisitEvent(visit, { type: 'arrive', actorId: 'npc-a', routeConfirmed: false }, 102).changed).toBe(false)
    visit = applyVisitEvent(visit, { type: 'arrive', actorId: 'npc-a', routeConfirmed: true }, 102).visit
    expect(applyVisitEvent(visit, { type: 'enter', actorId: 'npc-a', accessGranted: false, freeVisitorSlots: 2 }, 103).changed).toBe(false)
    expect(applyVisitEvent(visit, { type: 'enter', actorId: 'npc-a', accessGranted: true, freeVisitorSlots: 0 }, 103).changed).toBe(false)
  })
  it('models a two-person visit from invitation to departure', () => {
    let v = initial()
    const event = (e: Parameters<typeof applyVisitEvent>[1], t: number) => { v = applyVisitEvent(v, e, t).visit }
    event({ type: 'accept', actorId: 'npc-b' }, 101)
    for (const id of ['npc-a', 'npc-b']) {
      event({ type: 'arrive', actorId: id, routeConfirmed: true }, 102)
      event({ type: 'enter', actorId: id, accessGranted: true, freeVisitorSlots: 2 }, 103)
    }
    expect(groupCanSocialize(v)).toBe(true)
    event({ type: 'leave', actorId: 'npc-a' }, 104)
    expect(groupCanSocialize(v)).toBe(false)
    event({ type: 'leave', actorId: 'npc-b' }, 105)
    expect(v.phase).toBe('finished')
    expect(v.endedAt).toBe(105)
    expect(applyVisitEvent(v, { type: 'accept', actorId: 'npc-c' }, 106).changed).toBe(false)
  })
  it('is idempotent and only initiator can cancel', () => {
    const accepted = applyVisitEvent(initial(), { type: 'accept', actorId: 'npc-b' }, 101).visit
    expect(applyVisitEvent(accepted, { type: 'accept', actorId: 'npc-b' }, 101).changed).toBe(false)
    expect(applyVisitEvent(accepted, { type: 'cancel', actorId: 'npc-b' }, 102).changed).toBe(false)
    expect(applyVisitEvent(accepted, { type: 'cancel', actorId: 'npc-a' }, 102).visit.phase).toBe('cancelled')
  })
})
