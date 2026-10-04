import { describe, expect, it } from 'vitest'
import { THARSIS_HUB_SURFACE_CORRIDORS, tharsisRoadStats } from './tharsisHubSurfaceCorridors'

describe('Tharsis Hub surface corridors',()=>{
  it('projects the canonical road seed into connected metric segments',()=>{
    const stats=tharsisRoadStats()
    expect(stats.cells).toBeGreaterThan(50)
    expect(stats.corridors).toBeGreaterThan(40)
    expect(stats.hardened).toBeGreaterThan(0)
    expect(stats.prepared).toBeGreaterThan(0)
  })

  it('keeps all corridor points inside the shared Tharsis local frame',()=>{
    for(const corridor of THARSIS_HUB_SURFACE_CORRIDORS){
      for(const point of corridor.points){
        expect(point.xM).toBeGreaterThanOrEqual(-320)
        expect(point.xM).toBeLessThanOrEqual(320)
        expect(point.yM).toBeGreaterThanOrEqual(-240)
        expect(point.yM).toBeLessThanOrEqual(240)
      }
    }
  })
})
