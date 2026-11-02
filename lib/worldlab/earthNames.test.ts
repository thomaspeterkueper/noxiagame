import { describe, expect, it } from 'vitest'
import { earthBuildingName } from './earthNames'

describe('Gebäudenamen auf der Erde (W-8)', () => {
  it('Habitat heißt auf der Erde Wohnhaus', () => expect(earthBuildingName('habitat', 'Habitat')).toBe('Wohnhaus'))
  it('Wohnblock', () => expect(earthBuildingName('residential_block', 'Wohnblock-Modul')).toBe('Wohnblock'))
  it('sonst der allgemeine Name', () => expect(earthBuildingName('bank', 'Bank')).toBe('Bank'))
})
