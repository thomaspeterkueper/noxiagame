import { describe, expect, it } from 'vitest'
import { DAVARU_TEMPLE_INTERIOR } from './templates/davaruTemple'
import { getInteriorTemplateForBuildingType } from './registry'
import { createInteriorInstance, validateInteriorInstance } from './instances'
import { findInteriorRoute } from './navigation'
import { resolveSharedTempleEntrance, DAVARU_TEMPLE_DESTINATION } from '../../temple/sharedTempleAccess'

describe('DaVaRu shared temple interior', () => {
  const template = DAVARU_TEMPLE_INTERIOR
  const instance = createInteriorInstance(template, {
    id: 'davaru-interior-singleton',
    buildingInstanceId: 'verified-physical-building-id-required',
  })
  it('uses existing registered interior system', () => {
    expect(getInteriorTemplateForBuildingType('davaru_temple')?.id).toBe(template.id)
    expect(validateInteriorInstance(template, instance)).toEqual([])
    expect(template.rooms).toHaveLength(4)
  })
  it('routes from entrance to the library and garden', () => {
    expect(findInteriorRoute(template, instance, 'entrance', 'library')?.rooms).toEqual(['entrance', 'conversation', 'library'])
    expect(findInteriorRoute(template, instance, 'entrance', 'garden')?.rooms).toEqual(['entrance', 'conversation', 'garden'])
  })
  it('never turns remote sessions into physical room occupancy', () => {
    for (const channel of ['endia', 'adventure_park'] as const) {
      expect(resolveSharedTempleEntrance({
        channel, destinationKey: DAVARU_TEMPLE_DESTINATION,
        mode: 'remote', authenticated: true, accessGranted: true,
      })).toEqual({allowed: true, destinationKey: DAVARU_TEMPLE_DESTINATION, mode: 'remote'})
    }
    expect(Object.values(instance.roomStates).every(room => room.presentCount === 0)).toBe(true)
  })
})
