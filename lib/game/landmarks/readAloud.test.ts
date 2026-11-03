import { describe, expect, it } from 'vitest'
import { nextReadingChunk, readingSource } from './readAloud'

describe('Vorlesen', () => {
  const text = 'Erster Satz hier. Zweiter Satz folgt gleich. Dritter Satz kommt danach. Vierter Satz beendet alles.'
  it('liest in Abschnitten an Satzenden bis zum Ende, ohne Text zu verlieren', () => {
    let offset = 0, out = '', guard = 0
    for (;;) {
      const part = nextReadingChunk(text, offset, 40)
      out += (out ? ' ' : '') + part.chunk
      offset = part.next
      if (part.done || ++guard > 20) break
    }
    expect(out).toBe(text)
  })
  it('ein kurzer Text ist ein einziger Abschnitt', () => {
    expect(nextReadingChunk('Kurz.', 0)).toEqual({ chunk: 'Kurz.', next: 5, done: true })
  })
  it('ohne Lesefassung wird der Klappentext gelesen', () => {
    expect(readingSource({ id: 'x:y', title: 'Titel', genre: 'Roman', teaser: 'Ein Satz.' })).toEqual({ text: 'Titel. Roman. Ein Satz.', kind: 'blurb' })
  })
})
