import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW, showPlace } from './viewOptions'

describe('Beschriftung nach Funktion', () => {
  const off = DEFAULT_VIEW
  const on = { streetNames: true, osmPlaces: true }
  it('Vorgabe: Straßennamen an, OSM-Orte aus', () => expect(DEFAULT_VIEW).toEqual({ streetNames: true, osmPlaces: false }))
  it('alles an: jeder Ort', () => {
    expect(showPlace(on, { kind: 'monument' })).toBe(true)
    expect(showPlace(on, { kind: 'cafe', poi: true })).toBe(true)
  })
  it('OSM aus: nur Orte mit Raum im Spiel', () => {
    expect(showPlace(off, { kind: 'library' })).toBe(true)
    expect(showPlace(off, { kind: 'place_of_worship', tags: { religion: 'christian' } })).toBe(true)
    expect(showPlace(off, { kind: 'monument' })).toBe(false)
    expect(showPlace(off, { kind: 'cafe', poi: true })).toBe(false)
  })
})
