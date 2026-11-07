import { describe, expect, it } from 'vitest'
import { rankActions, SYNTHETIC_SEEDS, validateSeed } from './personalitySeedLab'
describe('isolated personality-seed research fixtures',()=>{
  it('validates all anonymous fixtures',()=>{for(const seed of SYNTHETIC_SEEDS)expect(validateSeed(seed)).toEqual([])})
  it('favors exploration for curious seed in safe setting',()=>{
    const r=rankActions(SYNTHETIC_SEEDS[0],{familiarity:.3,perceivedRisk:0,sharedGoal:false})
    expect(r[0].action).toBe('explore')
  })
  it('favors observation for cautious seed in risky setting',()=>{
    const r=rankActions(SYNTHETIC_SEEDS[1],{familiarity:0,perceivedRisk:1,sharedGoal:false})
    expect(r[0].action).toBe('observe')
  })
  it('favors assistance for cooperative seed with shared goal',()=>{
    const r=rankActions(SYNTHETIC_SEEDS[2],{familiarity:.3,perceivedRisk:0,sharedGoal:true})
    expect(r[0].action).toBe('assist')
  })
  it('rejects values outside 0..1',()=>{
    expect(validateSeed({...SYNTHETIC_SEEDS[0],curiosity:1.5})).toContain('invalid_curiosity')
  })
})
