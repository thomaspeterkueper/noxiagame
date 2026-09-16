import { describe, expect, it } from 'vitest'
import { decidePersonActivity, type PersonSimulationState } from './personSimulation'

const baseState: PersonSimulationState = {
  personId: 'person-test-1',
  lod: 'active',
  activity: 'standby',
  locationId: 'tharsis-hub',
  assignmentId: 'ssf-lab',
  needs: {
    rest: 0.9,
    wellbeing: 0.9,
    social: 0.9,
    purpose: 0.2,
    safety: 1,
  },
}

const baseContext = {
  canWork: true,
  canTravel: true,
  hasSocialOpportunity: true,
  hasRecoveryOpportunity: true,
  safetyPressure: 0,
}

describe('person simulation utility decisions', () => {
  it('selects assigned work when purpose is low and the person is rested', () => {
    expect(decidePersonActivity(baseState, baseContext).selected.activity).toBe('work')
  })

  it('selects rest when rest satisfaction is critical', () => {
    const state = { ...baseState, needs: { ...baseState.needs, rest: 0.05, purpose: 0.9 } }
    expect(decidePersonActivity(state, baseContext).selected.activity).toBe('rest')
  })

  it('is deterministic for equal persisted state and observations', () => {
    expect(decidePersonActivity(baseState, baseContext)).toEqual(decidePersonActivity(baseState, baseContext))
  })
})
