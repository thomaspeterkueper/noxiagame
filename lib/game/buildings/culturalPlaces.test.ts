import { describe, expect, it } from 'vitest'
import { BUILDINGS, BUILDABLE } from './index'

const CULTURAL_PLACE_IDS = [
  'resonance_centre',
  'community_hall',
  'archive_library',
  'sacred_space',
] as const

describe('cultural place building foundation', () => {
  it('exposes the initial cultural places as service buildings', () => {
    for (const id of CULTURAL_PLACE_IDS) {
      expect(BUILDINGS[id]).toBeDefined()
      expect(BUILDINGS[id].category).toBe('service')
      expect(BUILDABLE[id]).toBeDefined()
    }
  })

  it('does not turn cultural places into production or generic population modifiers', () => {
    for (const id of CULTURAL_PLACE_IDS) {
      expect(BUILDINGS[id].produces).toBeUndefined()
      expect(BUILDINGS[id].populationBonus).toBeUndefined()
    }
  })

  it('keeps sacred-space tradition outside the physical building definition', () => {
    expect(BUILDINGS.sacred_space.description).toContain('Institution')
    expect(BUILDINGS.sacred_space.id).toBe('sacred_space')
  })

  it('allows off-world cultural places on the currently inhabited core worlds', () => {
    expect(BUILDINGS.resonance_centre.allowedLocations).toEqual(
      expect.arrayContaining(['earth', 'moon', 'mars', 'phobos', 'deimos']),
    )
  })
})
