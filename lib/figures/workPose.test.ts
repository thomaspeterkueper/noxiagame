import { describe, expect, it } from 'vitest'
import { workPoseFor } from './workPose'

describe('work poses on the map (W-17)', () => {
  it('shows the work of the place', () => {
    expect(workPoseFor('mine')).toBe('hacken')
    expect(workPoseFor('warehouse')).toBe('tragen')
    expect(workPoseFor('cafe')).toBe('wischen')
    expect(workPoseFor('repair_bay')).toBe('haemmern')
    expect(workPoseFor('bank')).toBeNull()
    expect(workPoseFor(null)).toBeNull()
  })
  it('hammers on a construction site', () => {
    expect(workPoseFor('bank', true)).toBe('haemmern')
  })
})
