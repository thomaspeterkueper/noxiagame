import { describe, expect, it } from 'vitest'
import { projectNamedPersonDecisionToIntent } from './namedPersonIntent'
import type { NamedPersonIntentContext } from './namedPersonIntent'

function context(actionCode: string): NamedPersonIntentContext {
  return {
    personId: 'p1',
    simulationTier: 'active',
    currentLocationId: 'mars',
    assignments: [],
    relationships: [],
    knowledge: [],
    decision: {
      activity: 'working',
      actionCode,
      priority: 0.5,
      factors: {},
      reason: 'test',
    },
  }
}

describe('named person intent projection', () => {
  it('projects rest without world mutation', () => {
    const value = projectNamedPersonDecisionToIntent(context('recover_rest'))
    expect(value.ok).toBe(true)
    if (value.ok) expect(value.intent.kind).toBe('rest')
  })

  it('blocks assigned work when no work assignment exists', () => {
    const value = projectNamedPersonDecisionToIntent(context('perform_assigned_work'))
    expect(value.ok).toBe(false)
    if (!value.ok) expect(value.reason).toBe('missing_work_assignment')
  })

  it('projects assigned work through the shared affordance boundary', () => {
    const input = context('perform_assigned_work')
    input.assignments.push({
      id: 'work-1',
      personId: 'p1',
      assignmentType: 'work',
      locationId: 'mars',
      tileEntityId: 'lab-1',
      employerActorId: null,
      roleCode: 'scientist',
      startsTick: 0,
      endsTick: null,
      isActive: true,
    })
    const value = projectNamedPersonDecisionToIntent(input)
    expect(value.ok).toBe(true)
    if (value.ok) expect(value.intent.kind).toBe('work')
  })

  it('requires a relationship target for social contact', () => {
    const input = context('seek_social_contact')
    input.decision.activity = 'socialising'
    const value = projectNamedPersonDecisionToIntent(input)
    expect(value.ok).toBe(false)
    if (!value.ok) expect(value.reason).toBe('missing_social_target')
  })

  it('keeps coordination distinct from execution', () => {
    const input = context('coordinate_colony_response')
    input.decision.subjectType = 'pressure'
    input.decision.subjectRef = 'water'
    const value = projectNamedPersonDecisionToIntent(input)
    expect(value.ok).toBe(true)
    if (value.ok) expect(value.intent.kind).toBe('coordinate')
  })
})
