import { describe, expect, it } from 'vitest'
import { buildingLabel, earthBuildingName } from './earthNames'

describe('Gebäudenamen auf der Erde (W-8)', () => {
  it('Habitat heißt auf der Erde Wohnhaus', () => expect(earthBuildingName('habitat', 'Habitat')).toBe('Wohnhaus'))
  it('Wohnblock', () => expect(earthBuildingName('residential_block', 'Wohnblock-Modul')).toBe('Wohnblock'))
  it('sonst der allgemeine Name', () => expect(earthBuildingName('bank', 'Bank')).toBe('Bank'))
})

describe('Schildname', () => {
  it('Art · Name', () => expect(buildingLabel('bar', 'Bar', 'Metropol')).toBe('Bar · Metropol'))
  it('nicht doppelt', () => expect(buildingLabel('travel_agency', 'Reisebüro', 'Reisebüro · Hauptstraße 47')).toBe('Reisebüro · Hauptstraße 47'))
  it('ohne Namen die Art', () => expect(buildingLabel('bank', 'Bank', null)).toBe('Bank'))
  it('gekauftes Haus nur mit Namen', () => expect(buildingLabel('acquired_building', 'Gekauftes Gebäude', 'Hauptstraße 3')).toBe('Hauptstraße 3'))
})
