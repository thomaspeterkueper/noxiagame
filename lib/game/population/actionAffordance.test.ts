import { describe, expect, it } from 'vitest'
import { evaluatePersonActionAffordance } from './actionAffordance'
import type { PersonActionAffordanceContext } from './actionAffordance'

function base(): PersonActionAffordanceContext {
  return {
    personId: 'p1',
    simulationTier: 'active',
    currentLocationId: 'mars',
    assignments: [],
    relationships: [],
    knowledge: [],
  }
}

describe('person action affordances', () => {
  it('blocks work without a work assignment', () => {
    const value = evaluatePersonActionAffordance(base(), { action: 'work' })
    expect(value.allowed).toBe(false)
    expect(value.blockers).toContain('missing_work_assignment')
  })

  it('allows work only when the active assignment is at the current location', () => {
    const context = base()
    context.assignments.push({
      id: 'a1',
      personId: 'p1',
      assignmentType: 'work',
      locationId: 'mars',
      tileEntityId: null,
      employerActorId: null,
      roleCode: 'technician',
      startsTick: 0,
      endsTick: null,
      isActive: true,
    })
    expect(evaluatePersonActionAffordance(context, { action: 'work' }).allowed).toBe(true)
  })

  it('does not let a person inspect a problem they do not know', () => {
    const value = evaluatePersonActionAffordance(base(), {
      action: 'inspect_problem',
      subjectType: 'building',
      subjectRef: 'pump-1',
    })
    expect(value.allowed).toBe(false)
    expect(value.blockers).toContain('unknown_subject')
  })

  it('allows inspection once personal knowledge reaches confidence threshold', () => {
    const context = base()
    context.knowledge.push({
      id: 'k1',
      personId: 'p1',
      subjectType: 'building',
      subjectRef: 'pump-1',
      knowledgeType: 'observed_failure',
      confidence: 0.7,
      learnedTick: 5,
      sourceEventId: null,
      details: {},
    })
    expect(evaluatePersonActionAffordance(context, {
      action: 'inspect_problem',
      subjectType: 'building',
      subjectRef: 'pump-1',
    }).allowed).toBe(true)
  })

  it('keeps information gathering available when the subject is unknown', () => {
    const value = evaluatePersonActionAffordance(base(), {
      action: 'gather_information',
      subjectType: 'terrain',
      subjectRef: 'sector-9',
    })
    expect(value.allowed).toBe(true)
    expect(value.factors.alreadyKnown).toBe(false)
  })

  it('requires active local presence for a local visit', () => {
    const context = base()
    context.simulationTier = 'background'
    const value = evaluatePersonActionAffordance(context, {
      action: 'local_visit',
      destinationLocationId: 'mars',
    })
    expect(value.allowed).toBe(false)
    expect(value.blockers).toContain('person_not_active')
  })

  it('rejects non-positive resource acquisition amounts', () => {
    const value = evaluatePersonActionAffordance(base(), {
      action: 'secure_resource',
      resource: 'credits',
      amount: 0,
    })
    expect(value.allowed).toBe(false)
    expect(value.blockers).toContain('invalid_resource_amount')
  })
})
