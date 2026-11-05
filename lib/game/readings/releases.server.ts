// lib/game/readings/releases.server.ts
// Freigaben (reading_releases) mit dem Katalog aus buecherwelten zusammenführen.
// Wortlaut nur aus buecherwelten; Leseproben werden hier, auf dem Server, gekürzt –
// gesperrte Kapitel verlassen den Server nie.

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { loadCatalog, readFile, type CatalogEntry } from './buecherwelten.server'
import { parseManuscript } from './manuscript'
import { readableChapterCount } from './readableChapters'
import { READING_RUBRICS, type ReadingDocument, type ReadingListEntry, type ReadingMode, type ReadingPlace, type ReadingRubric } from './types'

export type ReleaseRow = {
  slug: string
  kind: 'text' | 'work'
  place: ReadingPlace
  mode: ReadingMode
  rubric: ReadingRubric | null
  sample_chapters: number
  sort: number
  purchase_note: string | null
  updated_at: string | null
}

export async function loadReleases(place: ReadingPlace = 'resonance'): Promise<ReleaseRow[]> {
  const { data, error } = await createServiceClient().from('reading_releases')
    .select('slug,kind,place,mode,rubric,sample_chapters,sort,purchase_note,updated_at').eq('place', place)
  if (error) throw new Error(error.message)
  return (data ?? []) as ReleaseRow[]
}

const rubricOrder = (rubric: string | null) => {
  const index = READING_RUBRICS.findIndex(entry => entry.id === rubric)
  return index < 0 ? READING_RUBRICS.length : index
}

export { readableChapterCount }

async function sectionsOf(entry: CatalogEntry) {
  if (!entry.manuscriptPath) return null
  return parseManuscript(await readFile(entry.manuscriptPath), entry.title)
}

function listEntry(entry: CatalogEntry, release: ReleaseRow, chapters: number, version: string | null): ReadingListEntry {
  return {
    slug: entry.slug, kind: entry.kind, title: entry.title, subtitle: entry.subtitle, genre: entry.genre,
    version, rubric: release.rubric, mode: release.mode as ReadingListEntry['mode'],
    chapters, readableChapters: readableChapterCount(release.mode, chapters, release.sample_chapters),
  }
}

/** Was im Regal steht: alle freigegebenen Schriften, nach Fach und Reihenfolge. */
export async function releasedList(place: ReadingPlace = 'resonance'): Promise<ReadingListEntry[]> {
  const [catalog, releases] = await Promise.all([loadCatalog(), loadReleases(place)])
  const bySlug = new Map(catalog.map(entry => [`${entry.kind}:${entry.slug}`, entry]))
  const visible = releases.filter(release => release.mode !== 'hidden')
    .map(release => ({ release, entry: bySlug.get(`${release.kind}:${release.slug}`) }))
    .filter((item): item is { release: ReleaseRow; entry: CatalogEntry } => Boolean(item.entry && (item.release.mode === 'teaser' || item.entry.manuscriptPath)))
  const listed = await Promise.all(visible.map(async ({ release, entry }) => {
    const parsed = release.mode === 'teaser' ? null : await sectionsOf(entry).catch(() => null)
    if (release.mode !== 'teaser' && !parsed) return null
    const version = entry.version ?? (typeof parsed?.meta.version === 'string' ? parsed.meta.version : null)
    return { entry: listEntry(entry, release, parsed?.sections.length ?? 0, version), sort: release.sort }
  }))
  return listed.filter((item): item is { entry: ReadingListEntry; sort: number } => Boolean(item))
    .sort((a, b) => rubricOrder(a.entry.rubric) - rubricOrder(b.entry.rubric) || a.sort - b.sort || a.entry.title.localeCompare(b.entry.title, 'de'))
    .map(item => item.entry)
}

/** Ein Buch öffnen: nur freigegebene Kapitel. null, wenn nicht freigegeben. */
export async function releasedDocument(kind: 'text' | 'work', slug: string, place: ReadingPlace = 'resonance'): Promise<ReadingDocument | null> {
  const { data, error } = await createServiceClient().from('reading_releases')
    .select('slug,kind,place,mode,rubric,sample_chapters,sort,purchase_note,updated_at').eq('place', place).eq('kind', kind).eq('slug', slug).maybeSingle()
  if (error) throw new Error(error.message)
  const release = data as ReleaseRow | null
  if (!release || release.mode === 'hidden') return null
  const entry = (await loadCatalog()).find(item => item.kind === kind && item.slug === slug)
  if (!entry) return null
  const parsed = await sectionsOf(entry)
  if (!parsed && release.mode !== 'teaser') return null
  const sections = parsed?.sections ?? []
  const readable = readableChapterCount(release.mode, sections.length, release.sample_chapters)
  const version = entry.version ?? (typeof parsed?.meta.version === 'string' ? parsed.meta.version : null)
  return {
    ...listEntry(entry, release, sections.length, version),
    sections: sections.slice(0, readable),
    teaser: parsed?.teaser ?? null,
    purchaseNote: release.purchase_note,
  }
}
