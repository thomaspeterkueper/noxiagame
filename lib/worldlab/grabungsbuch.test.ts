import { describe, expect, it } from 'vitest'
import { bookToMarkdown, campNear, emptyBook, noteAnalysis, noteFind, parseBook } from './grabungsbuch'
import { CAMP } from './dvarakaGrabung'

describe('Grabungsbuch', () => {
  it('trägt Fundstellen nur einmal und nur bekannte ein', () => {
    let book = noteFind(emptyBook(), 'G4')
    book = noteFind(book, 'G4')
    book = noteFind(book, 'X99')
    expect(book.finds).toEqual(['G4'])
  })
  it('ersetzt eine Messung derselben Art an derselben Probe', () => {
    let book = noteAnalysis(emptyBook(), { sampleId: 'P-G4', source: 'G4', analysisId: 'geo', measurement: 'a' })
    book = noteAnalysis(book, { sampleId: 'P-G4', source: 'G4', analysisId: 'geo', measurement: 'b' })
    book = noteAnalysis(book, { sampleId: 'P-G4', source: 'G4', analysisId: 'basic', measurement: 'c' })
    expect(book.analyses.map(item => item.measurement)).toEqual(['b', 'c'])
  })
  it('liest aus dem Speicher nur Passendes', () => {
    expect(parseBook(null)).toEqual(emptyBook())
    const book = parseBook({ finds: ['G1', 'G1', 'nope', 3], analyses: [{ sampleId: 'P', source: 'G4', analysisId: 'geo', measurement: 'm' }, { bad: true }] })
    expect(book.finds).toEqual(['G1'])
    expect(book.analyses).toHaveLength(1)
  })
  it('Markdown trennt Messung und Deutung', () => {
    const md = bookToMarkdown(noteAnalysis(noteFind(emptyBook(), 'G4'), { sampleId: 'P-G4', source: 'G4', analysisId: 'geo', measurement: 'm', interpretation: 'd' }))
    expect(md).toContain('Messung: m')
    expect(md).toContain('Deutung: d')
    expect(md).toContain('G4')
  })
  it('Camp in Reichweite', () => {
    expect(campNear(CAMP)).toBe(true)
    expect(campNear({ x: CAMP.x + 100, y: CAMP.y })).toBe(false)
  })
})
