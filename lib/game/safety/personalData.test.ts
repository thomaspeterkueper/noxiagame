import { describe, expect, it } from 'vitest'
import { maskPersonalData, stripContactData } from './personalData'
import { assessRealWorldRisk, retainUntilFor } from './realWorldRisk'

describe('maskPersonalData – wird geixxt', () => {
  it.each([
    ['schreib an max.muster@gmail.com', 'schreib an xxx'],
    ['ruf an: 0171 1234567', 'ruf an: xxx'],
    ['+49 171 1234567 abends', 'xxx abends'],
    ['mein insta ist @maxi_2010', 'mein insta ist @xxx'],
    ['schau auf www.example.com/profil', 'schau auf xxx'],
    ['IBAN DE89 3704 0044 0532 0130 00 bitte', 'IBAN xxx bitte'],
    ['Karte 4111 1111 1111 1111', 'Karte xxx'],
  ])('%s', (input, out) => expect(maskPersonalData(input)).toBe(out))

  it('Wohnadresse, Geburtsdatum, echter Name, Schule, Postleitzahl', () => {
    expect(maskPersonalData('ich wohne in der Hauptstraße 12 bei meiner Mutter')).toBe('ich wohne in der xxx')
    expect(maskPersonalData('geboren am 12.03.2011')).toBe('geboren am xxx')
    expect(maskPersonalData('mein echter Name ist Max Mustermann')).toBe('mein echter Name ist xxx')
    expect(maskPersonalData('ich gehe auf die Grundschule Sundern')).toBe('ich gehe auf die xxx')
    expect(maskPersonalData('Paket nach 57368 Sundern')).toBe('Paket nach xxx Sundern')
    expect(maskPersonalData('I live at 221B Baker Street')).toBe('I live at xxx')
  })
})

describe('maskPersonalData – bleibt stehen', () => {
  it.each([
    'Ich heiße Thomas.',
    'Das Startcafé ist in der Hauptstraße 72 in Sundern.',
    'Das kostet 1.500.000 Credits.',
    'Wir fliegen um 08:30 zum Mars.',
    'Im Jahr 2026 kamen 120 Siedler.',
    'Ein Kaffee kostet 0.99 Credits.',
    'Treffen wir uns am Raumhafen Tharsis?',
  ])('%s', text => expect(maskPersonalData(text)).toBe(text))
})

describe('stripContactData', () => {
  it('nur Kontaktdaten, keine Selbstauskünfte', () => {
    expect(stripContactData('ich wohne in der Hauptstraße 12, mail a@b.de')).toBe('ich wohne in der Hauptstraße 12, mail xxx')
  })
})

describe('retainUntilFor – Gespräche über echtes Geld verwahren', () => {
  const now = Date.parse('2026-11-06T00:00:00Z')
  it.each([
    'zahl mir 50 Euro',
    'hast du Bitcoin?',
    'per PayPal geht auch',
    'kannst du per Revolut überweisen',
  ])('%s → ein Jahr', text => {
    expect(retainUntilFor(assessRealWorldRisk(text), now)).toBe('2027-11-06T00:00:00.000Z')
  })
  it.each(['Das kostet 50 Credits.', 'Treffen wir uns am Raumhafen?'])('%s → normale Frist', text => {
    expect(retainUntilFor(assessRealWorldRisk(text), now)).toBeNull()
  })
})
