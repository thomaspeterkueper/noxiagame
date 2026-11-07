import { describe, expect, it } from 'vitest'
import { maskFeedbackDraft } from './feedbackMask'
import type { FeedbackDraft } from './playerFeedback'

const base: FeedbackDraft = {
  category: 'idea', destination: 'development', visibility: 'private', consentToPublish: false,
  title: 'Mehr Bänke am Marktplatz', description: 'Am Marktplatz fehlen Sitzplätze für ältere Bewohner.',
}

describe('maskFeedbackDraft', () => {
  it('lässt unbedenkliche Texte unverändert', () => {
    expect(maskFeedbackDraft(base)).toMatchObject({ title: base.title, description: base.description })
  })
  it('maskiert E-Mail, Telefonnummer und Ortshinweis', () => {
    const out = maskFeedbackDraft({
      ...base,
      description: 'Meldet euch gern unter max.muster@example.com oder +49 170 1234567 bei mir.',
      locationRef: 'Schreibt an hans@example.org',
    })
    expect(out?.description).not.toMatch(/@|1234567/)
    expect(out?.description).toContain('xxx')
    expect(out?.locationRef).not.toMatch(/@/)
  })
  it('maskiert Selbstauskünfte zur Herkunft', () => {
    const out = maskFeedbackDraft({ ...base, description: 'Ich wohne in der Hauptstraße 5 und finde den Weg gefährlich.' })
    expect(out?.description).not.toMatch(/Hauptstra/)
  })
  it('lehnt ab, wenn ein Text nach dem Maskieren zu kurz wäre', () => {
    expect(maskFeedbackDraft({ ...base, title: 'a@b.de' })).toBeNull()
  })
  it('bewahrt Kategorie, Ziel und Sichtbarkeit', () => {
    expect(maskFeedbackDraft({ ...base, category: 'problem', destination: 'world_initiative' }))
      .toMatchObject({ category: 'problem', destination: 'world_initiative', visibility: 'private' })
  })
})
