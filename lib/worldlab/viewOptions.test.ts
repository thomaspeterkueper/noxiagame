import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW, showPlace } from './viewOptions'

describe('Beschriftung nach Funktion', () => {
  const off = { ...DEFAULT_VIEW, osmPlaces: false }
  it('alles an: jeder Ort', () => {
    expect(showPlace(DEFAULT_VIEW, { kind: 'monument' })).toBe(true)
    expect(showPlace(DEFAULT_VIEW, { kind: 'cafe', poi: true })).toBe(true)
  })
  it('OSM aus: nur Orte mit Raum im Spiel', () => {
    expect(showPlace(off, { kind: 'library' })).toBe(true)
    expect(showPlace(off, { kind: 'place_of_worship', tags: { religion: 'christian' } })).toBe(true)
    expect(showPlace(off, { kind: 'monument' })).toBe(false)
    expect(showPlace(off, { kind: 'cafe', poi: true })).toBe(false)
  })
})
