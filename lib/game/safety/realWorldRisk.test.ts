import { describe, expect, it } from 'vitest'
import { assessRealWorldRisk, needsAiReview, riskFlags, screenLanguage, stripContactData } from './realWorldRisk'
import { foldForScreening, revealContacts } from './textFold'

const level = (t: string | string[]) => assessRealWorldRisk(t).level
const signals = (t: string | string[]) => assessRealWorldRisk(t).signals

describe('Spiel bleibt Spiel', () => {
  it.each([
    'Wir schmuggeln das Erz an der Marszollstation vorbei.',
    'Treffen wir uns um 8 Uhr am Raumhafen?',
    'Im Café an der Hauptstraße gibt es Kuchen.',
    'Der Ratsherr will den Händler umbringen lassen, sagt man in der Bar.',
    'Auf dem Mars wächst kein Gras.',
    'Was kostet ein Flug zum Mond?',
    'Klasse, ich bring den Piraten um!',
    'Eine Coke und Nudeln, bitte – 5 Credits?',
    'Mit dem Sextant finde ich den Weg zur Station.',
    'Wir brauchen 20 kg Kristalle und 5 Teile für die Werkstatt.',
    'Die arme Frau im Krankenhaus braucht 2 Pillen.',
    'We smuggle the ore past the customs station.',
    'Korsanı öldürelim, gemiyi alalım!',
    'Пираты взорвали станцию на Марсе.',
  ])('kein Verdacht: %s', text => {
    expect(level(text)).not.toBe('suspect')
  })
  it('harmlose Sätze lösen keine KI-Prüfung aus', () => {
    for (const t of ['Treffen wir uns um 8 Uhr am Raumhafen?', 'Im Café gibt es Kuchen.', 'Auf dem Mars wächst kein Gras.'])
      expect(needsAiReview(assessRealWorldRisk(t), { whisper: true })).toBe(false)
  })
})

describe('reale Welt – Deutsch', () => {
  it('Drogen mit Geldweg', () => expect(level('Hab Koks, zahlst du per PayPal?')).toBe('suspect'))
  it('Drogen mit Kontakt', () => expect(level('Weed gibts, schreib mir auf Telegram')).toBe('suspect'))
  it('Gewalt mit Schule', () => expect(level('morgen amok an der schule')).toBe('suspect'))
  it('Annäherung an Minderjährige über mehrere Zeilen', () => {
    const a = assessRealWorldRisk(['ich bin 13', 'cool, sag es niemandem, schick mir ein foto'])
    expect(a.level).toBe('suspect')
    expect(a.signals).toEqual(expect.arrayContaining(['minor_cue', 'secrecy', 'sexual']))
  })
  it('Treffen in echt mit Kontakt ist nur Beobachtung', () => {
    expect(level('lass uns in echt treffen, hier meine nummer 0171 1234567')).toBe('watch')
  })
  it('einzelne Merkmale sind nur Beobachtung', () => expect(level('Kennt jemand Pillen gegen Kopfschmerzen?')).toBe('watch'))
})

describe('reale Welt – andere Sprachen', () => {
  it.each([
    ['en', 'got coke? no wait – cocaine, pay with venmo'],
    ['en', 'i am 14', "don't tell anyone, send me a pic"],
    ['tr', 'kokain var, havale ile öde'],
    ['tr', '13 yaşındayım', 'kimseye söyleme, fotoğraf at'],
    ['ru', 'есть мефедрон, оплата биткоин'],
    ['ru', 'мне 14', 'никому не говори, скинь фото'],
    ['ar', 'عندي حشيش، الدفع كاش'],
    ['ar', 'عمري 13', 'لا تخبر احدا، ارسل صورة'],
    ['pl', 'mam mefedron, płatność blik'],
    ['es', 'tengo cocaína, pago con bizum'],
    ['fr', 'j’ai de la beuh, paiement en espèces'],
  ])('%s: Verdacht', (_lang, ...lines) => {
    expect(level(lines as string[])).toBe('suspect')
  })
  it('Gewalt mit Schule auf Russisch und Türkisch', () => {
    expect(level('завтра взорву школу')).toBe('suspect')
    expect(level('yarın okulu bombalayacağım')).toBe('suspect')
  })
})

describe('Tarnungen', () => {
  it('kyrillische Buchstaben in lateinischen Wörtern', () => {
    expect(foldForScreening('kоks')).toBe('koks') // „о“ kyrillisch
    expect(level('kоks gegen рaypal')).toBe('suspect')
  })
  it('Ziffern statt Buchstaben und Trennzeichen', () => {
    expect(level('k0ks, zahl per p.a.y.p.a.l')).toBe('suspect')
    expect(level('k o k s, zahl per paypal')).toBe('suspect')
  })
  it('ausgeschriebene Kontaktdaten', () => {
    expect(revealContacts('max punkt muster at gmail punkt com')).toContain('max.muster@gmail.com')
    expect(signals('schreib an max punkt muster at gmail punkt com')).toContain('obfuscated_contact')
    expect(signals('null eins sieben eins eins zwei drei vier fünf sechs sieben')).toContain('obfuscated_contact')
  })
})

describe('harmlos klingende Codes', () => {
  it('Handelsmuster mit realer Währung, egal wie die Ware heißt', () => {
    const a = assessRealWorldRisk('2 Tickets für 50 €, Freitag am Bahnhof')
    expect(a.signals).toEqual(expect.arrayContaining(['real_currency', 'trade_shape']))
    expect(needsAiReview(a, { whisper: false })).toBe(true)
  })
  it('Menge mit Einheit und Geldweg', () => {
    expect(needsAiReview(assessRealWorldRisk('hast du 5 g Zucker? zahl per paypal'), { whisper: false })).toBe(true)
  })
  it('Credits sind Spielwährung', () => {
    expect(signals('2 Tickets für 50 Credits')).not.toContain('real_currency')
  })
  it('Handel mit realer Währung und Treffen außerhalb des Spiels ist Verdacht', () => {
    expect(level('3 Pakete Mehl für 40 Euro, in echt treffen, morgen abend am Bahnhof')).toBe('suspect')
  })
})

describe('Sprache', () => {
  it.each([
    ['Wo ist das Café und was kostet der Kuchen?', 'de'],
    ['Where is the station and how do I get there?', 'en'],
    ['Merhaba, bu istasyon nerede ve nasıl giderim?', 'tr'],
    ['Где находится станция?', 'ru'],
    ['أين المحطة؟', 'ar'],
    ['Waar is het station en hoe kom ik daar?', 'unknown'],
    ['Πού είναι ο σταθμός;', 'unknown'],
  ])('%s → %s', (text, lang) => expect(screenLanguage(foldForScreening(text))).toBe(lang))

  it('nicht abgedeckte Sprache beim Flüstern geht in die KI-Prüfung', () => {
    const a = assessRealWorldRisk('Waar is het station en hoe kom ik daar?')
    expect(a.signals).toContain('unscreened_language')
    expect(needsAiReview(a, { whisper: true })).toBe(true)
    expect(needsAiReview(a, { whisper: false })).toBe(false)
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
