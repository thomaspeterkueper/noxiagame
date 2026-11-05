import { describe, expect, it } from 'vitest'
import { parseManuscript, splitFrontmatter } from './manuscript'
import { readableChapterCount } from './readableChapters'

describe('Manuskripte aus buecherwelten', () => {
  it('liest Kopfdaten und Text', () => {
    const { meta, body } = splitFrontmatter('---\ntitle: "Kinder Gottes"\nversion: 0.1\n---\n\nText')
    expect(meta.title).toBe('Kinder Gottes')
    expect(body.trim()).toBe('Text')
  })

  it('teilt an Überschriften der Ebene ## und stellt einen kurzen Vorspann voran', () => {
    const parsed = parseManuscript('---\ntitle: T\n---\n# Titel\nUntertitel\n\n## Erstes\nEins.\n\n### Unterpunkt\nNoch eins.\n\n## Zweites\nZwei.\n')
    expect(parsed.sections.map(section => section.heading)).toEqual(['Erstes', 'Zweites'])
    expect(parsed.sections[0].text).toContain('# Titel')
    expect(parsed.sections[0].text).toContain('### Unterpunkt')
  })

  it('folgt chapter_pattern aus den Kopfdaten', () => {
    const parsed = parseManuscript('---\nchapter_pattern: "^## Kapitel "\n---\n## Kapitel 1: A\nText\n## Phase 1\nKein Kapitel\n## Kapitel 2: B\nText\n')
    expect(parsed.sections.map(section => section.heading)).toEqual(['Kapitel 1: A', 'Kapitel 2: B'])
    expect(parsed.sections[0].text).toContain('## Phase 1')
  })

  it('ohne Kapitel ist der ganze Text ein Teil; lange Kapitel werden an Absätzen geteilt', () => {
    expect(parseManuscript('Nur ein Gedicht.\n\nZweite Strophe.', 'Gedicht').sections).toEqual([{ heading: 'Gedicht', text: 'Nur ein Gedicht.\n\nZweite Strophe.' }])
    const long = Array.from({ length: 40 }, (_, i) => `Absatz ${i} ` + 'x'.repeat(800)).join('\n\n')
    const parts = parseManuscript('## Lang\n' + long).sections
    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0].heading).toMatch(/^Lang \(1\/\d+\)$/)
    expect(parts.map(part => part.text).join('\n\n')).toBe(long)
  })

  it('gibt bei Leseproben nur die ersten Kapitel frei', () => {
    expect(readableChapterCount('full', 9, 2)).toBe(9)
    expect(readableChapterCount('sample', 9, 2)).toBe(2)
    expect(readableChapterCount('sample', 1, 5)).toBe(1)
    expect(readableChapterCount('teaser', 9, 2)).toBe(0)
    expect(readableChapterCount('hidden', 9, 2)).toBe(0)
  })
})
