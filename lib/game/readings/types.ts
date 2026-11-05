// lib/game/readings/types.ts
// Schriften in NOXIA (05.11.2026): Der Wortlaut kommt ausschließlich aus buecherwelten
// (thomaspeterkueper/buecherwelten); was davon im Spiel lesbar ist, entscheidet die
// Freigabe im Adminbereich (Tabelle reading_releases).

/** Fächer im Regal der Begegnungsstätte, in dieser Reihenfolge. */
export const READING_RUBRICS = [
  { id: 'omnizedenz', label: 'Omnizedenz' },
  { id: 'bewusstsein', label: 'Bewusstsein und Seele' },
  { id: 'ethik', label: 'Ethik und Gesellschaft' },
  { id: 'theologie', label: 'Theologie und Bibelauslegung' },
  { id: 'tiefenwoerter', label: 'Tiefenwörter' },
  { id: 'stille', label: 'Stille und Gesang' },
] as const
export type ReadingRubric = typeof READING_RUBRICS[number]['id']

/**
 * hidden – nicht im Spiel; full – frei lesbar; sample – Leseprobe (die ersten Kapitel,
 * danach Bezugshinweis); teaser – nur Titel, Kurztext und Bezugshinweis.
 */
export const READING_MODES = ['hidden', 'full', 'sample', 'teaser'] as const
export type ReadingMode = typeof READING_MODES[number]
export const READING_MODE_LABEL: Record<ReadingMode, string> = {
  hidden: 'nicht im Spiel',
  full: 'frei lesbar',
  sample: 'Leseprobe',
  teaser: 'nur Klappentext',
}

export const READING_PLACES = ['resonance'] as const
export type ReadingPlace = typeof READING_PLACES[number]

export type ReadingKind = 'text' | 'work'

/** Ein Eintrag in der Liste, die das Spiel bekommt (ohne Wortlaut). */
export type ReadingListEntry = {
  slug: string
  kind: ReadingKind
  title: string
  subtitle: string | null
  genre: string
  version: string | null
  rubric: ReadingRubric | null
  mode: Exclude<ReadingMode, 'hidden'>
  chapters: number
  readableChapters: number
}

export type ReadingSection = { heading: string; text: string }

/** Ein geöffnetes Buch: Kapitel, soweit freigegeben. */
export type ReadingDocument = ReadingListEntry & {
  sections: ReadingSection[]
  teaser: string | null
  purchaseNote: string | null
}

export function rubricLabel(id: string | null | undefined) {
  return READING_RUBRICS.find(rubric => rubric.id === id)?.label ?? 'Weitere Schriften'
}
