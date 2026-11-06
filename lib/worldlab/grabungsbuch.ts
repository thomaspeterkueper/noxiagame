// lib/worldlab/grabungsbuch.ts
// Grabungsbuch der Dvārakā-Grabung: was die Spielerin besucht und im Labor gemessen hat.
// Es hält nur fest, was im Spiel tatsächlich geschah (Fundzettel gelesen, Analyse gelaufen),
// und trennt wie überall Messung und Deutung sowie belegt (R) und erschlossen (S).

import { CAMP, FINDS, LABEL_TEXT, type Pt } from './dvarakaGrabung'

export interface BookAnalysis { sampleId: string; source: string; analysisId: string; measurement: string; interpretation?: string }
export interface Grabungsbuch { finds: string[]; analyses: BookAnalysis[] }

export const emptyBook = (): Grabungsbuch => ({ finds: [], analyses: [] })

export function campNear(p: Pt, radius = 14): boolean { return Math.hypot(CAMP.x - p.x, CAMP.y - p.y) <= radius }

/** Fundstelle besucht (nur bekannte Kennungen, jede einmal, in Reihenfolge des Besuchs). */
export function noteFind(book: Grabungsbuch, id: string): Grabungsbuch {
  if (book.finds.includes(id) || !FINDS.some(find => find.id === id)) return book
  return { ...book, finds: [...book.finds, id] }
}

/** Analyse festgehalten; eine neue Messung derselben Art an derselben Probe ersetzt die alte. */
export function noteAnalysis(book: Grabungsbuch, entry: BookAnalysis): Grabungsbuch {
  const rest = book.analyses.filter(item => !(item.sampleId === entry.sampleId && item.analysisId === entry.analysisId))
  return { ...book, analyses: [...rest, entry] }
}

/** Aus dem Speicher lesen; alles Unpassende wird verworfen, nichts wird erfunden. */
export function parseBook(raw: unknown): Grabungsbuch {
  if (!raw || typeof raw !== 'object') return emptyBook()
  const data = raw as { finds?: unknown; analyses?: unknown }
  const known = new Set(FINDS.map(find => find.id))
  const finds = Array.isArray(data.finds) ? [...new Set(data.finds.filter((id): id is string => typeof id === 'string' && known.has(id)))] : []
  const analyses = Array.isArray(data.analyses)
    ? data.analyses.flatMap((item): BookAnalysis[] => {
      const v = item as Partial<BookAnalysis> | null
      return v && typeof v.sampleId === 'string' && typeof v.source === 'string' && typeof v.analysisId === 'string' && typeof v.measurement === 'string'
        ? [{ sampleId: v.sampleId, source: v.source, analysisId: v.analysisId, measurement: v.measurement, ...(typeof v.interpretation === 'string' ? { interpretation: v.interpretation } : {}) }]
        : []
    })
    : []
  return { finds, analyses }
}

/** Das Buch als Markdown (zum Kopieren): Fundstellen mit Kennzeichnung, Analysen mit Messung und Deutung getrennt. */
export function bookToMarkdown(book: Grabungsbuch): string {
  const lines = ['# Grabungsbuch Dvārakā', '']
  lines.push(`## Fundstellen (${book.finds.length} von ${FINDS.length})`, '')
  if (!book.finds.length) lines.push('Noch keine besucht.')
  for (const id of book.finds) {
    const find = FINDS.find(item => item.id === id)
    if (find) lines.push(`- **${find.id} – ${find.title}** (${LABEL_TEXT[find.label]}; Buchstelle: ${find.ref})`)
  }
  lines.push('', '## Laborbefunde', '')
  if (!book.analyses.length) lines.push('Noch keine Analyse.')
  for (const item of book.analyses) {
    lines.push(`- **${item.source} / ${item.analysisId}**`, `  - Messung: ${item.measurement}`)
    if (item.interpretation) lines.push(`  - Deutung: ${item.interpretation}`)
  }
  return lines.join('\n') + '\n'
}
