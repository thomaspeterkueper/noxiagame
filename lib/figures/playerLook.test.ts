import { describe, expect, it } from 'vitest'
import { AVATAR_LOOKS, cleanPlayerLook, defaultPlayerLook, lookAtWork } from './playerLook'

describe('playerLook', () => {
  it('keeps allowed values and drops the rest', () => {
    const l = cleanPlayerLook({ age: 'alt', hair: 'dutt', skin: '#5E3B25', clothes: 'fest', beard: 'vollbart', robot: true, extra: '<script>' }, 'u1')
    expect(l).toMatchObject({ age: 'alt', hair: 'dutt', skin: '#5e3b25', clothes: 'fest', beard: 'vollbart', robot: false })
    expect(Object.keys(l)).not.toContain('extra')
  })
  it('never a child, never a robot, unknown colours fall back', () => {
    expect(cleanPlayerLook({ age: 'kind', skin: '#123456' }, 'u2').age).not.toBe('kind')
    expect(cleanPlayerLook({ skin: '#123456' }, 'u2').skin).not.toBe('#123456')
    expect(defaultPlayerLook('x').robot).toBe(false)
  })
  it('work clothes over the own look during a shift', () => {
    const l = cleanPlayerLook({ clothes: 'fest' }, 'u3')
    expect(lookAtWork(l, 'u3', 'bar').clothes).toBe('bar')
    expect(lookAtWork(l, 'u3', null).clothes).toBe('fest')
  })
})

describe('Startfigur zum Dienstfoto', () => {
  it('kennt alle zwölf Dienstfotos aus dem Onboarding', () => {
    for (let i = 1; i <= 12; i++) expect(AVATAR_LOOKS[`pilot_${String(i).padStart(2, '0')}`]).toBeTruthy()
  })
  it('Männer auf dem Foto bekommen keine Frauenfrisur, Frauen keinen Bart', () => {
    for (const id of ['pilot_01', 'pilot_03', 'pilot_06', 'pilot_10']) {
      const l = defaultPlayerLook('x-' + id, id)
      expect(['kurz', 'glatze', 'locken']).toContain(l.hair)
      expect(l.beard).not.toBe('ohne')
      expect(l.clothes).not.toBe('kleid')
    }
    for (const id of ['pilot_02', 'pilot_05', 'pilot_11', 'pilot_12']) expect(defaultPlayerLook('y-' + id, id).beard).toBe('ohne')
  })
  it('Rawdiums Foto (pilot_01): kurze dunkelbraune Haare mit Stoppeln – egal, was die Kennung sonst ergäbe', () => {
    const l = defaultPlayerLook('9d27396a-5c49-43fd-9fb9-a69ed2e3c788', 'pilot_01')
    expect([l.hair, l.hairColor, l.beard]).toEqual(['kurz', '#5b3a24', 'stoppeln'])
  })
  it('ohne Foto bleibt die Vorgabe aus der Kennung; ungültige Werte fallen auf das Foto zurück', () => {
    expect(defaultPlayerLook('abc', null)).toEqual(defaultPlayerLook('abc'))
    expect(cleanPlayerLook({ hair: 'irokese' }, 'abc', 'pilot_08').hair).toBe('glatze')
  })
})
