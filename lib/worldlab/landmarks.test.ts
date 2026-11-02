import { describe, expect, it } from 'vitest'
import { landmarkFacts, landmarkLabel, effectivePlaceKind, isTravelPlace } from './landmarks'

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

describe('Bahnhof und Hotel (Vuiteboeuf, 02.11.2026)', () => {
  it('ein Lokal mit tourism=hotel zählt als Hotel', () => {
    expect(effectivePlaceKind('restaurant', { amenity: 'restaurant', tourism: 'hotel' })).toBe('hotel')
    expect(effectivePlaceKind('restaurant', { amenity: 'restaurant' })).toBe('restaurant')
  })
  it('Bahnhof und Hotel sind Reiseorte, ein Café nicht', () => {
    expect(isTravelPlace('station')).toBe(true)
    expect(isTravelPlace('restaurant', { tourism: 'hotel' })).toBe(true)
    expect(isTravelPlace('cafe')).toBe(false)
  })
})
