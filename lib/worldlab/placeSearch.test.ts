import { describe, expect, it } from 'vitest'
import { findPlace, placeKey } from './placeSearch'

const regions = [
  { slug: 'a', label: 'Seelenberg, Schmitten im Taunus, Hochtaunuskreis, Hessen, Deutschland', center_lat: 50.26, center_lon: 8.41 },
  { slug: 'b', label: 'Dvārakā (Dwarka), Devbhumi Dwarka, Gujarat, Indien', center_lat: 22.23, center_lon: 68.96 },
  { slug: 'c', label: 'dvaraka, Atmakur ( N ) Main road, Atmakuru ( N ) Urban, Andhra Pradesh, 524322, Indien', center_lat: 14.62, center_lon: 79.62 },
  { slug: 'd', label: 'Vuiteboeuf, District du Jura-Nord vaudois, Waadt, 1445, Schweiz', center_lat: 46.8, center_lon: 6.54 },
]

describe('Ortssuche', () => {
  it('findet Seelenberg und Vuiteboeuf', () => {
    expect(findPlace(regions, 'Seelenberg')?.slug).toBe('a')
    expect(findPlace(regions, 'vuiteboeuf')?.slug).toBe('d')
  })
  it('Dvaraka, Dvārakā und Dwarka führen nach Gujarat, nicht zur Straße in Atmakur', () => {
    for (const q of ['dvaraka', 'Dvārakā', 'Dwarka']) expect(findPlace(regions, q)?.slug).toBe('b')
  })
  it('Anfang genügt, zu kurze oder unbekannte Eingaben nicht', () => {
    expect(findPlace(regions, 'seelen')?.slug).toBe('a')
    expect(findPlace(regions, 'se')).toBeNull()
    expect(findPlace(regions, 'Hauptstraße')).toBeNull()
  })
  it('Schlüssel ohne Akzente', () => { expect(placeKey('Dvārakā')).toBe('dvaraka') })
})
