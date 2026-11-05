// lib/game/readings/buecherwelten.server.ts
// Liest Texte und Werke aus dem privaten Repository buecherwelten – der einzigen Quelle
// für den Wortlaut (05.11.2026). Zugang über BUECHERWELTEN_TOKEN (GitHub, nur Lesen,
// nur dieses Repository). Antworten werden 15 Minuten zwischengespeichert; „Neu laden“
// im Adminbereich leert den Zwischenspeicher (Tag BUECHERWELTEN_CACHE_TAG).

import 'server-only'
import { parse as parseYaml } from 'yaml'
import type { ReadingKind } from './types'

const OWNER = 'thomaspeterkueper'
const REPO = 'buecherwelten'
const REF = 'main'
export const BUECHERWELTEN_CACHE_TAG = 'buecherwelten'
const REVALIDATE_SECONDS = 900

export class BuecherweltenUnavailable extends Error {}

export function buecherweltenConfigured() {
  return Boolean(process.env.BUECHERWELTEN_TOKEN)
}

async function github(path: string, accept: string) {
  const token = process.env.BUECHERWELTEN_TOKEN
  if (!token) throw new BuecherweltenUnavailable('BUECHERWELTEN_TOKEN fehlt')
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'noxiagame-readings' },
    next: { revalidate: REVALIDATE_SECONDS, tags: [BUECHERWELTEN_CACHE_TAG] },
  })
  if (!response.ok) throw new BuecherweltenUnavailable(`buecherwelten antwortet mit ${response.status} für ${path}`)
  return response
}

export async function readFile(path: string): Promise<string> {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return (await github(`contents/${encoded}?ref=${REF}`, 'application/vnd.github.raw+json')).text()
}

async function readYaml(path: string): Promise<Record<string, unknown>> {
  const parsed = parseYaml(await readFile(path))
  return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
}

async function listPaths(): Promise<string[]> {
  const json = await (await github(`git/trees/${REF}?recursive=1`, 'application/vnd.github+json')).json() as { tree?: Array<{ path: string; type: string }> }
  return (json.tree ?? []).filter(entry => entry.type === 'blob').map(entry => entry.path)
}

/** Ein Text oder Werk aus buecherwelten, wie der Adminbereich es zur Freigabe anbietet. */
export type CatalogEntry = {
  slug: string
  kind: ReadingKind
  title: string
  subtitle: string | null
  genre: string
  /** Pfad des lesbaren Wortlauts im Repository, sonst null (noch kein Manuskript). */
  manuscriptPath: string | null
  version: string | null
  /** Vollständiger Wortlaut laut buecherwelten (content_role full_text / completeness full). */
  complete: boolean
  note: string | null
}

const str = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null

const WORK_KIND_LABEL: Record<string, string> = { nonfiction: 'Sachbuch', book: 'Buch', research_project: 'Forschungsprojekt', research_paper: 'Studie' }

export async function loadCatalog(): Promise<CatalogEntry[]> {
  const [paths, textsYaml, itemsYaml] = await Promise.all([listPaths(), readYaml('catalog/texts.yaml'), readYaml('catalog/items.yaml')])
  const pathSet = new Set(paths)
  const entries: CatalogEntry[] = []

  for (const raw of (Array.isArray(textsYaml.texts) ? textsYaml.texts : []) as Array<Record<string, unknown>>) {
    const slug = str(raw.slug)
    if (!slug) continue
    const path = `texts/${slug}/text.md`
    entries.push({
      slug, kind: 'text',
      title: str(raw.title) ?? slug,
      subtitle: null,
      genre: str(raw.source_type) ?? 'Text',
      manuscriptPath: pathSet.has(path) ? path : null,
      version: null,
      complete: raw.content_role === 'full_text' && pathSet.has(path),
      note: raw.content_role === 'full_text' ? null : `Inhalt: ${String(raw.content_role ?? 'unbekannt')}`,
    })
  }

  const items = new Map<string, Record<string, unknown>>()
  for (const raw of (Array.isArray(itemsYaml.items) ? itemsYaml.items : []) as Array<Record<string, unknown>>) {
    const slug = str(raw.slug)
    if (slug) items.set(slug, raw)
  }
  const workSlugs = [...new Set(paths.filter(path => /^works\/[^/]+\/work\.yaml$/.test(path)).map(path => path.split('/')[1]))]
  const withManuscript = new Set(paths.filter(path => /^works\/[^/]+\/manuscript\//.test(path)).map(path => path.split('/')[1]))
  const works = await Promise.all(workSlugs.map(async slug => {
    const item = items.get(slug) ?? {}
    // Nur Werke mit Manuskriptordner brauchen ihre work.yaml (Pfad und Fassung des Wortlauts).
    const work = withManuscript.has(slug) ? await readYaml(`works/${slug}/work.yaml`).catch(() => ({} as Record<string, unknown>)) : {}
    const manuscript = (work.manuscript && typeof work.manuscript === 'object' ? work.manuscript : {}) as Record<string, unknown>
    const current = str(manuscript.current)
    const path = current ? `works/${slug}/${current}` : null
    const kind = str(work.kind) ?? str(item.kind) ?? 'book'
    return {
      slug, kind: 'work' as const,
      title: str(work.title) ?? str(item.title) ?? slug,
      subtitle: str(work.subtitle),
      genre: WORK_KIND_LABEL[kind] ?? kind,
      manuscriptPath: path && pathSet.has(path) ? path : null,
      version: str(manuscript.version),
      complete: Boolean(path && pathSet.has(path) && manuscript.completeness === 'full'),
      note: str(manuscript.completeness_note) ?? (path ? null : 'Noch kein lesbares Manuskript in buecherwelten'),
    }
  }))
  entries.push(...works)
  return entries.sort((a, b) => a.title.localeCompare(b.title, 'de'))
}
