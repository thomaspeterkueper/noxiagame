import { describe, expect, it } from 'vitest'
import type { ChronicleEntry } from './buildingChronicle'
import { chronicleGapLine, chronicleLine } from './buildingChronicleText'
import { timeSliderRange, SLIDER_DAY_MS } from './timeSliderRange'

const entry = (kind: ChronicleEntry['kind'], extra: Partial<ChronicleEntry> = {}): ChronicleEntry => ({ id: 'x', kind, at: '2026-10-01T00:00:00Z', authority: 'event', sourceId: 'x', subjectId: 'b', sourceRef: null, own: null, authorized: true, detail: {}, ...extra })

describe('Verlaufstexte und Zeitregler', () => {
  it('beschreibt jede Art auf Deutsch', () => {
    expect(chronicleLine(entry('built'))).toBe('Gebaut')
    expect(chronicleLine(entry('owner_changed', { own: true }))).toBe('Eigentümer gewechselt (von dir)')
    expect(chronicleLine(entry('demolished'))).toBe('Abgerissen')
  })
  it('nennt eine Löschung ohne Berechtigungsbeleg nicht „Abriss“', () => {
    expect(chronicleLine(entry('demolished', { authorized: false }))).toBe('Entfernt, ohne Abrissbeleg')
  })
  it('benennt beide Lücken', () => {
    expect(chronicleGapLine({ code: 'deleted_without_receipt', subjectId: 'b', sourceRef: null, note: '' })).toMatch(/Beleg/)
    expect(chronicleGapLine({ code: 'tombstone_unlinked', subjectId: null, sourceRef: 'r', note: '' })).toMatch(/zuordnen/)
  })
  it('Zeitregler erscheint nur, wenn es einen datierten Abriss gibt', () => {
    expect(timeSliderRange([])).toBeNull()
    expect(timeSliderRange([{ clearedAt: undefined }])).toBeNull()
    const range = timeSliderRange([{ clearedAt: '2026-10-05T00:00:00Z' }, { clearedAt: '2026-10-10T00:00:00Z' }], Date.parse('2026-10-31T00:00:00Z'))!
    expect(range.min).toBe(Date.parse('2026-10-05T00:00:00Z') - SLIDER_DAY_MS)
    expect(range.max).toBe(Date.parse('2026-10-31T00:00:00Z'))
  })
})
