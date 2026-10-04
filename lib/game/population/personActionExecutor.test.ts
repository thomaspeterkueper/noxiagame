import { describe, expect, it, vi } from 'vitest'
import { executePopulationActionIntent } from './personActionExecutor'

describe('person action executor routing', () => {
  it('does not claim ownership of work execution', async () => {
    const value = await executePopulationActionIntent({} as any, {
      kind: 'work',
      personId: 'p1',
      assignmentId: 'a1',
      locationId: 'mars',
      tileEntityId: null,
      employerActorId: null,
      roleCode: 'scientist',
    }, 1)
    expect(value.executed).toBe(false)
    expect(value.kind).toBe('work')
  })

  it('rejects social execution without a target before touching persistence', async () => {
    const value = await executePopulationActionIntent({} as any, {
      kind: 'local',
      personId: 'p1',
      action: 'social_interaction',
      subjectRef: null,
      relatedPersonId: null,
    }, 1)
    expect(value.executed).toBe(false)
    if ('reason' in value) expect(value.reason).toBe('missing_social_target')
    else throw new Error('expected missing_social_target result')
  })
})
