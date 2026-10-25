import { describe, expect, it } from 'vitest'
import { parseAddressQuery } from './address'

describe('parseAddressQuery', () => {
  it('reads street and house number', () => {
    expect(parseAddressQuery('Hauptstraße 102')).toEqual({ kind: 'address', street: 'Hauptstraße', number: '102' })
    expect(parseAddressQuery(' Bogenstraße  25a ')).toEqual({ kind: 'address', street: 'Bogenstraße', number: '25a' })
    expect(parseAddressQuery('Hauptstr. 7')).toEqual({ kind: 'address', street: 'Hauptstraße', number: '7' })
  })
  it('reads a street alone and coordinates', () => {
    expect(parseAddressQuery('Lockweg')).toEqual({ kind: 'address', street: 'Lockweg', number: null })
    expect(parseAddressQuery('51.3407, 8.0015')).toEqual({ kind: 'coordinates', lat: 51.3407, lon: 8.0015 })
  })
  it('refuses empty input and pattern characters', () => {
    expect(parseAddressQuery('  ')).toBeNull()
    expect(parseAddressQuery('%str')).toBeNull()
  })
})
