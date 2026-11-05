import { describe, expect, it } from 'vitest'
import { KIESEL_POSES, kieselAnimated, kieselDirFrom, kieselLookFor, kieselSVG, type KieselPose } from './kiesel'

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
  it('draws every pose in every direction and frame without broken numbers', () => {
    for (const pose of Object.keys(KIESEL_POSES) as KieselPose[]) for (const dir of ['se', 'sw', 'ne', 'nw'] as const) for (let f = 0; f < 4; f++) {
      const svg = kieselSVG({ ...look, verletzt: true }, dir, pose, f, true)
      expect(svg.includes('NaN') || svg.includes('undefined')).toBe(false)
      expect(svg.split('<g').length).toBe(svg.split('</g>').length)
    }
  })
  it('animates dance, work and fight, and carries a tray only while walking', () => {
    expect(kieselSVG(look, 'se', 'tanzen', 0)).not.toBe(kieselSVG(look, 'se', 'tanzen', 1))
    expect(kieselSVG(look, 'se', 'haemmern', 0)).not.toBe(kieselSVG(look, 'se', 'haemmern', 2))
    expect(kieselAnimated('tragen')).toBe(false); expect(kieselAnimated('tragen', true)).toBe(true)
    expect(kieselAnimated('liegen')).toBe(false); expect(kieselAnimated('zuschlagen')).toBe(true)
  })
  it('shows injury only when marked', () => {
    expect(kieselSVG(look, 'se', 'liegen').includes('#efd9b4')).toBe(false)
    expect(kieselSVG({ ...look, verletzt: true }, 'se', 'liegen').includes('#efd9b4')).toBe(true)
  })
})
