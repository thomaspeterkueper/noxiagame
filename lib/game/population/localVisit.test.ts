import { describe, expect, it } from 'vitest'
import { resolvedPresenceCandidate } from './presence'
import type { Person, PersonAssignment } from './types'

const person: Person = {
  id: 'p1', displayName: 'Visitor', birthYear: null, currentLocationId: 'mars',
  simulationTier: 'active', activityState: 'socialising', lastAction: 'visit:medical_care',
  lastDecisionFactors: {}, lastTick: 42,
}

describe('local visit presence', () => {
  it('resolves an explicit temporary visit as current tile presence', () => {
    const assignments: PersonAssignment[] = [{
      id: 'visit1', personId: 'p1', assignmentType: 'temporary', locationId: 'mars',
      tileEntityId: 'medical-core', employerActorId: null, roleCode: 'visit:medical_care',
      startsTick: 42, endsTick: null, isActive: true,
    }]
    expect(resolvedPresenceCandidate(person, assignments)?.tileEntityId).toBe('medical-core')
  })

  it('does not turn an inactive visit into presence', () => {
    const assignments: PersonAssignment[] = [{
      id: 'visit1', personId: 'p1', assignmentType: 'temporary', locationId: 'mars',
      tileEntityId: 'medical-core', employerActorId: null, roleCode: 'visit:medical_care',
      startsTick: 41, endsTick: 42, isActive: false,
    }]
    expect(resolvedPresenceCandidate(person, assignments)).toBeNull()
  })
})
