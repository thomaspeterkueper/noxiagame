import { describe, expect, it } from 'vitest'
import { DAVARU_TEMPLE_DESTINATION, resolveSharedTempleEntrance } from './sharedTempleAccess'

describe('single shared DaVaRu temple', () => {
  it('resolves all entrances to one shared destination', () => {
    for (const channel of ['world_map', 'endia', 'adventure_park'] as const) {
      expect(resolveSharedTempleEntrance({channel,destinationKey:DAVARU_TEMPLE_DESTINATION,mode:channel==='world_map'?'physical':'remote',authenticated:true,accessGranted:true})).toEqual({allowed:true,destinationKey:DAVARU_TEMPLE_DESTINATION,mode:channel==='world_map'?'physical':'remote'})
    }
  })
  it('does not grant access or turn remote visits into physical teleportation', () => {
    expect(resolveSharedTempleEntrance({channel:'endia',destinationKey:DAVARU_TEMPLE_DESTINATION,mode:'physical',authenticated:true,accessGranted:true})).toEqual({allowed:false,reason:'access-denied'})
    expect(resolveSharedTempleEntrance({channel:'endia',destinationKey:DAVARU_TEMPLE_DESTINATION,mode:'remote',authenticated:false,accessGranted:true})).toEqual({allowed:false,reason:'authentication-required'})
    expect(resolveSharedTempleEntrance({channel:'endia',destinationKey:DAVARU_TEMPLE_DESTINATION,mode:'remote',authenticated:true,accessGranted:false})).toEqual({allowed:false,reason:'access-denied'})
    expect(resolveSharedTempleEntrance({channel:'endia',destinationKey:'other',mode:'remote',authenticated:true,accessGranted:true})).toEqual({allowed:false,reason:'unknown-destination'})
  })
})
