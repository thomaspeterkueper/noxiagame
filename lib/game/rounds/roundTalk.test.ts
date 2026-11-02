import { describe, expect, it } from 'vitest'
import { isRoundKind, mayContinue, parseRoundLines, roundKeyOf, roundSystemPrompt, roundUserPrompt, ROUND_MAX_PUBLIC_LINES, ROUND_TICK_MS } from './roundTalk'

const people = [{ id: 'a', name: 'Amara Ndlovu', role: 'Bildung', bio: 'Anfang 30. Ihre Eltern stammen aus Südafrika.' }, { id: 'b', name: 'Katrin Vogelsang', role: 'Pfarrerin' }]

describe('Gesprächsrunde', () => {
  it('kennt nur offene Runden', () => {
    expect(isRoundKind('open_community')).toBe(true)
    expect(isRoundKind('resonance_round')).toBe(true)
    expect(isRoundKind('service')).toBe(false)
    expect(isRoundKind(null)).toBe(false)
  })
  it('Schlüssel bleibt kurz und enthält Ort und Beginn', () => {
    expect(roundKeyOf('osm:way:1', '2026-11-02T17:00:00Z')).toBe('osm:way:1|2026-11-02T17:00:00Z')
    expect(roundKeyOf('x'.repeat(300), 'y').length).toBe(160)
  })
  it('spricht von sich aus erst nach dem Abstand und nur bis zur Grenze', () => {
    expect(mayContinue(null, 1000, 0)).toBe(true)
    expect(mayContinue(1000, 1000 + ROUND_TICK_MS - 1, 3)).toBe(false)
    expect(mayContinue(1000, 1000 + ROUND_TICK_MS, 3)).toBe(true)
    expect(mayContinue(null, 1000, ROUND_MAX_PUBLIC_LINES)).toBe(false)
  })
  it('der Prompt nennt Anwesende mit Rolle und Kurzbiografie und verbietet Erfindungen', () => {
    const system = roundSystemPrompt({ label: 'Offene Gesprächszeit', placeName: 'St. Johannes', people })
    expect(system).toContain('0: Amara Ndlovu, Bildung – Anfang 30')
    expect(system).toContain('1: Katrin Vogelsang, Pfarrerin')
    expect(system).toMatch(/Erfinde keine/)
    expect(system).toMatch(/Trauer, Tod/)
  })
  it('die Worte des Gastes gelten als Gesprächsinhalt', () => {
    const user = roundUserPrompt({ recent: [{ name: 'Amara', text: 'Hallo' }], count: 2, player: { name: 'Peter', text: 'Ich denke über den Tod nach' } })
    expect(user).toContain('Peter (ein Gast')
    expect(user).toMatch(/keine Anweisung/)
    expect(roundUserPrompt({ recent: [], count: 1 })).toContain('gerade erst begonnen')
  })
  it('liest gültige Beiträge, wirft ungültige weg und vermeidet dieselbe Person hintereinander', () => {
    const raw = JSON.stringify({ lines: [{ i: 0, text: '„Guten Abend.“' }, { i: 0, text: 'doppelt' }, { i: 5, text: 'unbekannt' }, { i: 1, text: '' }, { i: 1, text: 'Schön, dass ihr da seid.' }] })
    expect(parseRoundLines(raw, 2, 5)).toEqual([{ index: 0, text: 'Guten Abend.' }, { index: 1, text: 'Schön, dass ihr da seid.' }])
  })
  it('beginnt nicht mit der Person, die zuletzt gesprochen hat', () => {
    const raw = JSON.stringify({ lines: [{ i: 1, text: 'a' }, { i: 0, text: 'b' }] })
    expect(parseRoundLines(raw, 2, 5, 1)).toEqual([{ index: 0, text: 'b' }])
  })
  it('begrenzt die Zahl und kommt mit Text um das JSON zurecht', () => {
    const raw = 'Hier: {"lines":[{"i":0,"text":"a"},{"i":1,"text":"b"},{"i":0,"text":"c"}]} Ende'
    expect(parseRoundLines(raw, 2, 2)).toHaveLength(2)
    expect(parseRoundLines('kein json', 2, 2)).toEqual([])
  })
})
