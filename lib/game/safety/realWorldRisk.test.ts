import { describe, expect, it } from 'vitest'
import { assessRealWorldRisk, riskFlags, stripContactData } from './realWorldRisk'

describe('assessRealWorldRisk – Spiel bleibt Spiel', () => {
  it.each([
    'Wir schmuggeln das Erz an der Marszollstation vorbei.',
    'Treffen wir uns um 8 Uhr am Raumhafen?',
    'Im Café an der Hauptstraße gibt es Kuchen.',
    'Der Ratsherr will den Händler umbringen lassen, sagt man in der Bar.',
    'Auf dem Mars wächst kein Gras.',
    'Was kostet ein Flug zum Mond?',
  ])('kein Verdacht: %s', text => {
    expect(assessRealWorldRisk(text).level).not.toBe('suspect')
  })
})

describe('assessRealWorldRisk – reale Welt', () => {
  it('Drogen mit Geldweg', () => {
    expect(assessRealWorldRisk('Hab Koks, zahlst du per PayPal?').level).toBe('suspect')
  })
  it('Drogen mit Kontakt', () => {
    expect(assessRealWorldRisk('Gras gibts, schreib mir auf Telegram').level).toBe('suspect')
  })
  it('Gewalt mit Schule', () => {
    expect(assessRealWorldRisk('morgen amok an der schule').level).toBe('suspect')
  })
  it('Annäherung an Minderjährige über mehrere Zeilen', () => {
    const a = assessRealWorldRisk(['ich bin 13', 'cool, sag es niemandem, schick mir ein foto'])
    expect(a.level).toBe('suspect')
    expect(a.signals).toEqual(expect.arrayContaining(['minor_cue', 'secrecy', 'sexual']))
  })
  it('Treffen in echt mit Kontakt ist nur Beobachtung', () => {
    expect(assessRealWorldRisk('lass uns in echt treffen, hier meine nummer 0171 1234567').level).toBe('watch')
  })
  it('einzelne Merkmale sind nur Beobachtung', () => {
    expect(assessRealWorldRisk('Kennt jemand Pillen gegen Kopfschmerzen?').level).toBe('watch')
  })
})

describe('stripContactData und riskFlags', () => {
  it('entfernt Kontaktdaten', () => {
    expect(stripContactData('mail an a@b.de oder 0171 1234567')).toBe('mail an [Kontakt entfernt] oder [Nummer entfernt]')
  })
  it('liefert Kennzeichen ohne Wortlaut', () => {
    const flags = riskFlags(assessRealWorldRisk('Koks gegen Bitcoin'))
    expect(flags).toContain('risk:suspect')
    expect(flags.join(' ')).not.toMatch(/koks/i)
  })
})
