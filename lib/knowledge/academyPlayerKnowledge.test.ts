import { describe, expect, it } from 'vitest'
import { projectPlayerKnowledge } from './academyPlayerKnowledge'

describe('personal academy knowledge projection', () => {
  const modules = [
    { id: 'PHY-L1-000001', legacyId: 'LRN:SSF:PHY-1101', title: 'Gravitation', domain: 'Physik', sourceEntityIds: ['ENTITY:GRAV', 'ENTITY:GRAV'] },
    { id: 'TEC-L1-000002', title: 'Werkzeuge', domain: 'Technik', sourceEntityIds: [] },
  ]
  it('honors canonical and legacy completions without manufacturing competence', () => {
    const p = projectPlayerKnowledge(modules, ['LRN:SSF:PHY-1101'])
    expect(p[0]).toEqual({ id: 'PHY-L1-000001', title: 'Gravitation', domain: 'Physik', status: 'completed', completed: true, sourceEntityIds: ['ENTITY:GRAV'] })
    expect(p[1].status).toBe('available')
    expect(p[0]).not.toHaveProperty('unlocked')
    expect(p[0]).not.toHaveProperty('qualified')
  })
  it('does not merge different users progress or duplicate modules', () => {
    expect(projectPlayerKnowledge([modules[0], modules[0]], [])).toHaveLength(1)
    expect(projectPlayerKnowledge(modules, []).every(m => !m.completed)).toBe(true)
  })
})
