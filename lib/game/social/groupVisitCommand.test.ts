import { describe, expect, it } from 'vitest'
import { applyVisitEvent, inviteToVenue } from './groupVisits'
import { prepareGroupAdmission } from './groupVisitCommand'

const base = () => {
  let visit = inviteToVenue({ id: 'v-1', venueId: 'cafe-1', initiatorId: 'a', invitedId: 'b', now: 1 })
  visit = applyVisitEvent(visit, { type: 'accept', actorId: 'b' }, 2).visit
  for (const id of ['a', 'b']) visit = applyVisitEvent(visit, { type: 'arrive', actorId: id, routeConfirmed: true }, 3).visit
  return { visit, locationId: 'earth', tick: 4, endsTick: 6, verifiedInvitationIds: ['b'],
    availableVisitorSlots: 2, venueAccessible: true, venueOpen: true,
    people: ['a', 'b'].map(personId => ({
      personId, locationId: 'earth', simulationTier: 'active', activityState: 'idle',
      travelling: false, activeTemporaryVenueId: null,
    })) }
}
describe('atomic admission handoff', () => {
  it('creates stable proposal using existing temporary assignment vocabulary', () => {
    const p = prepareGroupAdmission(base())
    expect(p.command).toMatchObject({
      dedupeKey: 'group_visit:v-1:cafe-1', personIds: ['a', 'b'],
      assignmentType: 'temporary', roleCode: 'visit:social_group',
      activityState: 'socialising', authoritativeCommitRequired: true,
    })
    expect(prepareGroupAdmission(base())).toEqual(p)
  })
  it('rejects unsigned invitations and insufficient capacity', () => {
    expect(prepareGroupAdmission({ ...base(), verifiedInvitationIds: [] }).command).toBeNull()
    expect(prepareGroupAdmission({ ...base(), availableVisitorSlots: 1 }).command).toBeNull()
  })
  it('rejects malformed time windows', () => {
    expect(prepareGroupAdmission({ ...base(), endsTick: 4 }).reason).toBe('invalid_visit_window')
  })
})
