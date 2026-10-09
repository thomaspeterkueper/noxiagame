import { describe, expect, it } from 'vitest'
import { acceptedInflow, BASE_STORAGE_T, locationStorageCapacity, tierFactor } from './storageCapacity'

describe('locationStorageCapacity', () => {
  it('addiert Grundlager und aktive Lagergebäude je Gut', () => {
    const cap = locationStorageCapacity([
      { entity_id: 'warehouse', status: 'active' },
      { entity_id: 'battery_storage', status: 'active' },
      { entity_id: 'habitat', status: 'active' },
      { entity_id: 'warehouse', status: 'under_construction' },
    ])
    expect(cap.water).toBe(BASE_STORAGE_T + 1000)
    expect(cap.metal).toBe(BASE_STORAGE_T + 1500)
    expect(cap.energy).toBe(BASE_STORAGE_T + 1500)
  })
  it('verdoppelt je Ausbaustufe', () => {
    expect(tierFactor(1)).toBe(1)
    expect(tierFactor(3)).toBe(4)
    const cap = locationStorageCapacity([{ entity_id: 'tank' }], () => 2)
    expect(cap.water).toBe(BASE_STORAGE_T + 4000)
  })
})

describe('acceptedInflow', () => {
  it('lässt Produktion ungekürzt, solange Platz ist', () => {
    expect(acceptedInflow({ stock: 0, inflow: 7, consumption: 5, capacity: 300 })).toBe(7)
    expect(acceptedInflow({ stock: 100, inflow: 7, consumption: 5, capacity: 300 })).toBe(7)
  })
  it('füllt nur bis zur Kapazität auf; der Verbrauch schafft Platz', () => {
    expect(acceptedInflow({ stock: 298, inflow: 7, consumption: 5, capacity: 300 })).toBe(7)
    expect(acceptedInflow({ stock: 300, inflow: 7, consumption: 5, capacity: 300 })).toBe(5)
    expect(acceptedInflow({ stock: 300, inflow: 7, consumption: 0, capacity: 300 })).toBe(0)
  })
  it('nimmt über der Kapazität nichts an, vernichtet aber auch nichts', () => {
    expect(acceptedInflow({ stock: 48619, inflow: 108, consumption: 3, capacity: 300 })).toBe(0)
  })
})
