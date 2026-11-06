import { describe, expect, it } from 'vitest'
import { dreamAffectDelta, dreamConversationLines, dreamForNight, dreamRecallAbility, insightFromDream, newsMotifs, openProblemFromNeeds, type NightDream } from './nightDreams'

const day = { encounters: [{ name: 'Mira Brandt', kind: 'interaction' as const, salience: 0.7, valence: 0.3 }], workedAs: 'Verwaltung' }
const news = [{ id: 'n1', title: 'Hochwasserschutz an der Röhr wird ausgebaut', sourceName: 'WDR', dreamOk: true }]

describe('nightDreams', () => {
  it('drops consecutive capitalised names from news motifs', () => {
    expect(newsMotifs('Friedrich Merz besucht Hochwasserschutz in Sundern')).not.toContain('Friedrich')
    expect(newsMotifs('Friedrich Merz besucht Hochwasserschutz in Sundern')).not.toContain('Merz')
    expect(newsMotifs('Friedrich Merz besucht Hochwasserschutz in Sundern')[0]).toBe('Hochwasserschutz')
  })

  it('everyone dreams, most dreams stay subconscious', () => {
    const dreams = Array.from({ length: 400 }, (_, i) => dreamForNight({ personId: 'p' + i, nightKey: '2026-11-06', day, news }))
    expect(dreams.every(d => d.intensity > 0 && d.motifs.length > 0)).toBe(true)
    const none = dreams.filter(d => d.recall === 'none').length
    const clear = dreams.filter(d => d.recall === 'clear').length
    expect(none / dreams.length).toBeGreaterThan(0.7)
    expect(clear / dreams.length).toBeLessThan(0.12)
    expect(clear).toBeGreaterThan(0)
    expect(dreams.every(d => d.tellable === (d.recall !== 'none'))).toBe(true)
  })

  it('is reproducible per night and varies between nights', () => {
    const a = dreamForNight({ personId: 'x', nightKey: '2026-11-06', day, news })
    expect(dreamForNight({ personId: 'x', nightKey: '2026-11-06', day, news })).toEqual(a)
    const intensities = new Set(['01', '02', '03', '04', '05'].map(d => dreamForNight({ personId: 'x', nightKey: '2026-11-' + d, day, news }).intensity))
    expect(intensities.size).toBeGreaterThan(1)
  })

  it('ignores news that is not dream material', () => {
    const blocked = [{ ...news[0], dreamOk: false }]
    const all = Array.from({ length: 50 }, (_, i) => dreamForNight({ personId: 'q' + i, nightKey: 'n', day, news: blocked }))
    expect(all.every(d => d.newsItemId === null)).toBe(true)
  })

  it('a trait overrides recall ability', () => {
    expect(dreamRecallAbility('any', { dream_recall: 0.9 })).toBe(0.9)
    expect(dreamForNight({ personId: 'z', nightKey: 'n', traits: { dream_recall: 0 }, day: { encounters: [] }, news: [] }).recall).toBe('none')
  })

  it('only remembered dreams reach the conversation', () => {
    expect(dreamConversationLines({ recall: 'none', motifs: ['x'] })).toEqual([])
    expect(dreamConversationLines({ recall: 'fragment', motifs: ['ein Gespräch mit Mira Brandt', 'Hochwasserschutz'] })[0]).toContain('Bruchstück')
    const clear = dreamConversationLines({ recall: 'clear', motifs: ['Hochwasserschutz'], newsTitle: 'Hochwasserschutz an der Röhr', newsSource: 'WDR' })
    expect(clear.some(l => l.includes('belegt'))).toBe(true)
  })

  it('every dream tints the mood a little, conflicts darker than help', () => {
    const conflict = dreamForNight({ personId: 'c', nightKey: 'n', day: { encounters: [{ name: 'A', kind: 'conflict', salience: 0.9, valence: -0.8 }] }, news: [] })
    const help = dreamForNight({ personId: 'c', nightKey: 'n', day: { encounters: [{ name: 'A', kind: 'assistance', salience: 0.9, valence: 0.8 }] }, news: [] })
    expect(conflict.tone).toBeLessThan(help.tone)
    const d = dreamAffectDelta({ intensity: 1, tone: -1 })
    expect(d.joy).toBe(0)
    expect(d.fear + d.sadness).toBeLessThanOrEqual(0.12 + 1e-9)
  })

  it('finds the most pressing unmet need', () => {
    expect(openProblemFromNeeds([{ needCode: 'variety', satisfaction: 0.3 }, { needCode: 'social', satisfaction: 0.2 }])?.code).toBe('social')
    expect(openProblemFromNeeds([{ needCode: 'rest', satisfaction: 0.8 }])).toBeNull()
  })

  it('enlightenment is rare: only clear dreams with an open problem, behind a cooldown', () => {
    const now = new Date('2026-11-07T06:00:00Z')
    const strong: NightDream = { intensity: 1, tone: 0.9, recall: 'clear', tellable: true, motifs: ['ein Gespräch mit Mira Brandt'], newsItemId: null, sources: { encounters: ['Mira Brandt'], work: false, news: null } }
    const problem = { code: 'variety' as const, severity: 1 }
    const traits = { creativity: 1 }
    const insight = insightFromDream({ dream: strong, problem, traits, expertise: 1, now })
    expect(insight?.canonical).toBe(false)
    expect(insight?.hypothesis).toContain('Mira Brandt')
    expect(insightFromDream({ dream: { ...strong, recall: 'fragment' }, problem, traits, expertise: 1, now })).toBeNull()
    expect(insightFromDream({ dream: strong, problem: null, traits, expertise: 1, now })).toBeNull()
    expect(insightFromDream({ dream: strong, problem, traits, expertise: 1, now, lastInsightAt: new Date('2026-11-04T06:00:00Z') })).toBeNull()
    const ordinary = Array.from({ length: 300 }, (_, i) => dreamForNight({ personId: 'o' + i, nightKey: 'n', day, news }))
      .map(dream => insightFromDream({ dream, problem: { code: 'variety', severity: 0.6 }, now }))
      .filter(Boolean)
    expect(ordinary.length).toBeLessThan(15)
  })
})
