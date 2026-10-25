import { describe, expect, it } from 'vitest'
import { landmarkFacts, landmarkLabel } from './landmarks'

describe('landmarks', () => {
  it('names churches by religion', () => {
    expect(landmarkLabel('place_of_worship', { religion: 'christian' })).toBe('Kirche')
    expect(landmarkLabel('library')).toBe('Bibliothek')
    expect(landmarkLabel('unknown')).toBe('Wahrzeichen')
    expect(landmarkLabel('shop', { shop: 'bakery' })).toBe('Bäckerei')
    expect(landmarkLabel('cafe')).toBe('Café')
  })
  it('lists only known facts', () => {
    expect(landmarkFacts({ 'addr:street': 'Hauptstraße', 'addr:housenumber': '2', denomination: 'catholic' }))
      .toEqual([{ label: 'Adresse', value: 'Hauptstraße 2' }, { label: 'Konfession', value: 'catholic' }])
  })
})
