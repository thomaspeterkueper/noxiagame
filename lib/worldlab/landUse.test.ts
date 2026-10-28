import { describe, expect, it } from 'vitest'
import { landUse, landUseKind } from './landUse'
import { parcelKey, parseUsePieces, usesByParcel } from './alkis'
import { toUtm32 } from './utm'

describe('land use (NOXIA-MAT-0001)', () => {
  it('classifies cadastre usages', () => {
    expect(landUseKind('Wald', 'Nadelholz')).toBe('forest')
    expect(landUseKind('Gehölz')).toBe('forest')
    expect(landUseKind('Landwirtschaft', 'Grünland')).toBe('grassland')
    expect(landUseKind('Landwirtschaft', 'Ackerland')).toBe('farmland')
    expect(landUseKind('Tagebau, Grube, Steinbruch')).toBe('quarry')
    expect(landUseKind('Wohnbaufläche')).toBe('building')
    expect(landUseKind('Fließgewässer')).toBe('water')
    expect(landUseKind(null)).toBe('other')
  })
  it('estimates what a parcel yields', () => {
    const forest = landUse('Wald', 'Nadelholz', 40_000)
    expect(forest.potential[0]).toContain('1.400 m³')
    expect(forest.potential[1]).toContain('40 m³')
    expect(forest.activity).toContain('Holzeinschlag')
    expect(landUse('Landwirtschaft', 'Ackerland', 20_000).potential[0]).toContain('15 t')
    expect(landUse('Wohnbaufläche', null, 600).activity).toBeNull()
  })
  it('reads usage pieces and sums them per parcel', () => {
    const square = (e: number, n: number, size: number) => [[e, n], [e + size, n], [e + size, n + size], [e, n + size], [e, n]].map(([x, y]) => `${x} ${y}`).join(' ')
    const { e, n } = toUtm32(51.32, 7.99)
    const piece = (id: string, art: string, bez: string, size: number) => `<NutzungFlurstueck gml:id="${id}"><flstkennz>051028</flstkennz><nutzart>${art}</nutzart><bez>${bez}</bez><geometrie><exterior><LinearRing><posList>${square(e, n, size)}</posList></LinearRing></exterior></geometrie></NutzungFlurstueck>`
    const pieces = parseUsePieces(piece('a', 'Wald', 'Nadelholz', 100) + piece('b', 'Landwirtschaft', 'Grünland', 50) + piece('c', 'Wald', 'Nadelholz', 10))
    expect(pieces).toHaveLength(3)
    const uses = usesByParcel(pieces).get(parcelKey('051028'))!
    expect(uses[0]).toMatchObject({ art: 'Wald', bez: 'Nadelholz', m2: 10_100 })
    expect(uses[1]).toMatchObject({ art: 'Landwirtschaft', m2: 2_500 })
  })
})

describe('Kennzeichen vereinheitlichen', () => {
  it('Füllzeichen und führende Nullen zählen nicht', () => {
    expect(parcelKey('060460011000100007__')).toBe(parcelKey('60460011000100007'))
    expect(parcelKey('06046001100010/0007')).toBe(parcelKey('060460011000100007'))
  })
})
