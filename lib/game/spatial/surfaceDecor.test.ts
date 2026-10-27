import { describe, expect, it } from 'vitest'
import { buildSurfaceDecor, clearanceM } from './surfaceDecor'

const keepOut = {
  buildings: [{ center: { xM: 0, yM: 0 }, widthM: 26, depthM: 20 }, { center: { xM: 220, yM: -100 }, widthM: 70, depthM: 55 }],
  paths: [{ points: [{ xM: 0, yM: 0 }, { xM: 220, yM: -100 }] }],
}

describe('surface decor around a local scene', () => {
  it('is the same for the same place and different for another', () => {
    const a = buildSurfaceDecor({ body: 'phobos', seedKey: 'stickney', extentM: 500, keepOut })
    const b = buildSurfaceDecor({ body: 'phobos', seedKey: 'stickney', extentM: 500, keepOut })
    const c = buildSurfaceDecor({ body: 'phobos', seedKey: 'other', extentM: 500, keepOut })
    expect(a).toEqual(b)
    expect(a.craters[0]).not.toEqual(c.craters[0])
  })

  it('keeps craters and boulders off buildings and paths', () => {
    const decor = buildSurfaceDecor({ body: 'phobos', seedKey: 'stickney', extentM: 500, keepOut })
    expect(decor.craters.length).toBeGreaterThan(30)
    for (const crater of decor.craters) expect(clearanceM(crater, keepOut)).toBeGreaterThanOrEqual(crater.rM + 6)
    for (const boulder of decor.boulders) expect(clearanceM(boulder, keepOut)).toBeGreaterThanOrEqual(boulder.rM + 3)
  })

  it('draws grooves on Phobos only', () => {
    expect(buildSurfaceDecor({ body: 'phobos', seedKey: 's', extentM: 500, keepOut }).grooves.length).toBeGreaterThan(5)
    expect(buildSurfaceDecor({ body: 'moon', seedKey: 's', extentM: 500, keepOut }).grooves).toHaveLength(0)
  })
})
