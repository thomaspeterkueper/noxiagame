// lib/game/landmarks/readAloud.ts
// Vorlesen in der Leseecke (Thomas, 03.11.2026): Abschnitt für Abschnitt, an Satzenden geteilt.
import { READING_TEXTS } from './readingTexts'
import type { LibraryBook } from './libraryCatalogue'

/** Der nächste Abschnitt ab `offset`: höchstens `max` Zeichen, endet an einem Satzende. */
export function nextReadingChunk(text: string, offset: number, max = 520): { chunk: string; next: number; done: boolean } {
  const rest = text.slice(offset).replace(/^\s+/, '')
  const start = text.length - text.slice(offset).length + (text.slice(offset).length - rest.length)
  if (!rest) return { chunk: '', next: text.length, done: true }
  if (rest.length <= max) return { chunk: rest.trim(), next: text.length, done: true }
  const window = rest.slice(0, max)
  const end = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '), window.lastIndexOf('.\n'))
  const cut = end > max * 0.4 ? end + 1 : (window.lastIndexOf(' ') > 0 ? window.lastIndexOf(' ') : max)
  return { chunk: rest.slice(0, cut).trim(), next: start + cut, done: false }
}

/** Was vorgelesen wird: die freie Lesefassung, sonst der Klappentext. */
export function readingSource(book: Pick<LibraryBook, 'id' | 'title' | 'genre' | 'teaser'>): { text: string; kind: 'manuscript' | 'blurb' } {
  const doc = READING_TEXTS[book.id]
  if (doc) return { text: doc.sections.map(section => `${section.heading}. ${section.text}`).join('\n\n'), kind: 'manuscript' }
  return { text: `${book.title}. ${book.genre}. ${book.teaser}`, kind: 'blurb' }
}
