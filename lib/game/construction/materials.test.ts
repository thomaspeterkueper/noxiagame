import { describe, expect, it } from 'vitest'
import { billOfMaterials, billText, buildFormFor, costSplit, materialValue } from './materials'

describe('Baustoffe (NOXIA-MAT-0001)', () => {
  it('wählt die Bauform nach Typ und Ort', () => {
    expect(buildFormFor('cafe')).toBe('massiv')
    expect(buildFormFor('warehouse_storage')).toBe('halle')
    expect(buildFormFor('solar')).toBe('feld')
    expect(buildFormFor('habitat', 'mars')).toBe('habitat')
    expect(buildFormFor('cafe', 'moon')).toBe('habitat')
  })
  it('rechnet die Stückliste aus der Geschossfläche', () => {
    const bill = billOfMaterials('cafe', 120)
    expect(bill).toEqual([
      { material: 'beton', amount: 72 }, { material: 'ziegel', amount: 48 },
      { material: 'schnittholz', amount: 8.4 }, { material: 'stahl', amount: 4 },
    ])
    expect(billOfMaterials('cafe', 120, 2)[0].amount).toBe(144)
    expect(billOfMaterials('habitat', 100, 1, 'mars').map(line => line.material)).toEqual(['regolith', 'stahl'])
  })
  it('teilt den Baupreis in Material und Arbeit, Summe bleibt', () => {
    const bill = billOfMaterials('cafe', 120)
    const split = costSplit(900, bill)
    expect(split.material + split.labor).toBe(900)
    expect(split.material).toBe(Math.round(materialValue(bill)))
    expect(costSplit(100, bill).material).toBe(80)
  })
  it('beschreibt die größten Posten', () => {
    expect(billText(billOfMaterials('cafe', 120))).toBe('72 t Beton, 48 t Ziegel, 4 t Stahl')
  })
})
