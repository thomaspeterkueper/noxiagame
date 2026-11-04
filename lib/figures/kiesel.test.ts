import { describe, expect, it } from 'vitest'
import { kieselDirFrom, kieselLookFor, kieselSVG } from './kiesel'

describe('kiesel', () => {
  const look = kieselLookFor({ id: 'p1', appearance: { genderPresentation: 'masculine', bodyFrame: 'broad', skinToneCode: 'skin_4', hairStyleCode: 'short', hairColorCode: 'dark', facialHairCode: 'full', visibleAgeBand: 'adult' } }, 'bar')
  it('maps the stored appearance and dresses by work', () => {
    expect(look).toMatchObject({ build: 'kraeftig', hair: 'kurz', beard: 'vollbart', age: 'erwachsen', clothes: 'bar' })
  })
  it('is stable for a person without stored appearance', () => {
    expect(kieselLookFor({ id: 'x9' })).toEqual(kieselLookFor({ id: 'x9' }))
  })
  it('children by life stage or known age, never bearded women', () => {
    expect(kieselLookFor({ id: 'k', lifeStage: 'child' }).age).toBe('kind')
    expect(kieselLookFor({ id: 'o', knownAgeYears: 80 }).age).toBe('alt')
    expect(kieselLookFor({ id: 'f', appearance: { genderPresentation: 'feminine', facialHairCode: 'full' } }).beard).toBe('ohne')
  })
  it('draws valid markup, mirrored to the left, without face from behind', () => {
    const front = kieselSVG(look, 'se', 'gehen', 1)
    expect(front).toContain('<ellipse')
    expect(kieselSVG(look, 'sw')).toMatch(/^<g transform="translate\(64 0\) scale\(-1 1\)">/)
    expect(kieselSVG(look, 'ne').includes('#1d1714')).toBe(false)
    expect(front.includes('NaN')).toBe(false)
  })
  it('turns with the movement', () => {
    expect(kieselDirFrom(5, 3)).toBe('se'); expect(kieselDirFrom(-5, 3)).toBe('sw')
    expect(kieselDirFrom(2, -6)).toBe('ne'); expect(kieselDirFrom(-2, -6)).toBe('nw')
    expect(kieselDirFrom(0, 0, 'nw')).toBe('nw')
  })
})
