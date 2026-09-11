import { describe, expect, it } from 'vitest'
import { LABORATORY_STANDARD_INTERIOR } from './templates/laboratoryStandard'
import { getAdjacentRoomIds, getPortalBetweenRooms, validateInteriorTemplate } from './topology'

describe('shared building interior topology', () => {
  it('keeps the standard laboratory template structurally valid', () => {
    expect(validateInteriorTemplate(LABORATORY_STANDARD_INTERIOR)).toEqual([])
  })

  it('treats rooms as a bidirectional graph through portals', () => {
    expect(getAdjacentRoomIds(LABORATORY_STANDARD_INTERIOR, 'corridor-0')).toEqual(expect.arrayContaining([
      'airlock',
      'analysis-lab',
      'workshop',
      'storage',
      'technical',
      'corridor-1',
    ]))
    expect(getPortalBetweenRooms(LABORATORY_STANDARD_INTERIOR, 'corridor-0', 'analysis-lab')).toBe('p-corridor-analysis')
    expect(getPortalBetweenRooms(LABORATORY_STANDARD_INTERIOR, 'analysis-lab', 'corridor-0')).toBe('p-corridor-analysis')
  })

  it('keeps world-body physics out of the interior template', () => {
    expect(LABORATORY_STANDARD_INTERIOR).not.toHaveProperty('worldBodyId')
    expect(LABORATORY_STANDARD_INTERIOR).not.toHaveProperty('gravity')
    expect(LABORATORY_STANDARD_INTERIOR).not.toHaveProperty('atmosphere')
  })
})
