import { describe, expect, it } from 'vitest'
import { assessByRules, clusterKeyFrom, decideWish, looksLikeDistress, looksLikeWish, SUPPORT_NEEDED, type WishAssessment } from './rules'

const base: WishAssessment = { realLife: false, distress: false, harmful: false, realPerson: false, selfish: false, category: 'gemeinschaft', summary: 'Ein Fest im Ort', clusterKey: 'fest-ort', sense: 0.8 }

describe('deciding wishes', () => {
  it('fulfils small, sensible wishes at once', () => {
    expect(decideWish(base, 1).status).toBe('erfuellt')
  })
  it('lets big wishes gather support first', () => {
    const big = { ...base, category: 'versorgung' as const }
    expect(decideWish(big, 1).status).toBe('sammelt')
    expect(decideWish(big, SUPPORT_NEEDED).status).toBe('erfuellt')
    expect(decideWish({ ...base, category: 'ort' }, SUPPORT_NEEDED).status).toBe('in_arbeit')
  })
  it('keeps real-life prayers private and rejects harm, real persons and selfishness', () => {
    expect(decideWish({ ...base, realLife: true }, 9).status).toBe('privat')
    expect(decideWish({ ...base, distress: true }, 9).status).toBe('privat')
    expect(decideWish({ ...base, harmful: true }, 9).status).toBe('abgelehnt')
    expect(decideWish({ ...base, realPerson: true }, 9).status).toBe('abgelehnt')
    expect(decideWish({ ...base, selfish: true }, 9).status).toBe('abgelehnt')
  })
  it('accepts inner wishes without doing anything and waits on senseless ones', () => {
    expect(decideWish({ ...base, category: 'innerlich' }, 1).status).toBe('angenommen')
    expect(decideWish({ ...base, sense: 0.2 }, 9).status).toBe('sammelt')
  })
})

describe('recognising wishes in words', () => {
  it('finds wishes and prayers in conversation', () => {
    expect(looksLikeWish('Ich wünsche mir eine Bäckerei hier')).toBe(true)
    expect(looksLikeWish('Hoffentlich gibt es bald mehr Wasser')).toBe(true)
    expect(looksLikeWish('Wo ist der Bahnhof?')).toBe(false)
  })
  it('notices distress', () => {
    expect(looksLikeDistress('Ich halte es nicht mehr aus, ich will sterben')).toBe(true)
    expect(looksLikeDistress('Ich will ein Fest')).toBe(false)
  })
  it('sorts by rules carefully', () => {
    const a = assessByRules('Ich bete für meine Mutter im Krankenhaus')
    expect(a.realLife).toBe(true)
    expect(decideWish(a, 1).status).toBe('privat')
    const b = assessByRules('Hoffentlich gibt es bald mehr Wasser auf dem Mars')
    expect(b).toMatchObject({ category: 'versorgung', resource: 'water' })
    expect(decideWish(b, 9).status).toBe('sammelt')
    expect(assessByRules('Ich will 10000 Credits').selfish).toBe(true)
  })
  it('bundles similar wishes', () => {
    expect(clusterKeyFrom('Eine Bäckerei in Sundern wäre schön')).toBe(clusterKeyFrom('Bäckerei Sundern!'))
  })
})
