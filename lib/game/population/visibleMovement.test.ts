import { describe, expect, it } from 'vitest'
import { commuteSeconds, distanceToNearestVertex, pathLength, pointAlong, shouldCommute, visibleTarget } from './visibleMovement'

const assignments = [
  { type: 'home', tileEntityId: 'home-1' },
  { type: 'work', tileEntityId: 'work-1' },
]

describe('visible movement', () => {
  it('walks for a time that grows with distance but stays bounded', () => {
    expect(commuteSeconds(0)).toBe(4)
    expect(commuteSeconds(160)).toBe(20)
    expect(commuteSeconds(5000)).toBe(90)
  })

  it('only commutes when the place really changes', () => {
    expect(shouldCommute({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false)
    expect(shouldCommute({ x: 0, y: 0 }, { x: 40, y: 0 })).toBe(true)
    expect(shouldCommute(null, { x: 40, y: 0 })).toBe(false)
  })

  it('places people by activity: work, home, asleep, stroll', () => {
    expect(visibleTarget('working', null, assignments)).toEqual({ kind: 'work', tileEntityId: 'work-1' })
    expect(visibleTarget('resting', null, assignments)).toEqual({ kind: 'home', tileEntityId: 'home-1' })
    expect(visibleTarget('resting', 'sleep', assignments).kind).toBe('asleep')
    expect(visibleTarget('idle', null, assignments)).toEqual({ kind: 'stroll', tileEntityId: 'home-1' })
    expect(visibleTarget('socialising', null, assignments).kind).toBe('stroll')
  })

  it('does not send someone without a workplace to work', () => {
    expect(visibleTarget('working', null, [{ type: 'home', tileEntityId: 'home-1' }]).kind).toBe('stroll')
  })

  it('measures and walks along a polyline', () => {
    const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    expect(pathLength(path)).toBe(20)
    expect(pointAlong(path, 15)).toEqual({ x: 10, y: 5 })
    expect(pointAlong(path, 99)).toEqual({ x: 10, y: 10 })
    expect(distanceToNearestVertex(path, { x: 9, y: 1 })).toBe(10)
  })
})
