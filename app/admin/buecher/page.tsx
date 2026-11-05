'use client'

// app/admin/buecher/page.tsx
// Adminbereich: Bücherliste (Thomas, 05.11.2026). Alle Texte und Werke aus buecherwelten –
// der einzigen Quelle für den Wortlaut – und was davon in der Begegnungsstätte lesbar ist:
// frei, als Leseprobe (die ersten Kapitel, z. B. bei Kaufexemplaren), nur Klappentext oder gar nicht.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { READING_MODES, READING_MODE_LABEL, READING_RUBRICS, rubricLabel, type ReadingMode } from '@/lib/game/readings/types'

type Release = { mode: ReadingMode; rubric: string | null; sampleChapters: number; sort: number; purchaseNote: string | null; updatedAt: string | null; readable: number }
type Entry = {
  slug: string; kind: 'text' | 'work'; title: string; subtitle: string | null; genre: string
  manuscriptPath: string | null; version: string | null; complete: boolean; note: string | null
  chapters: string[]; release: Release | null
}
type Draft = { mode: ReadingMode; rubric: string; sampleChapters: number; sort: number; purchaseNote: string }
type Filter = 'alle' | 'im-spiel' | 'nicht-im-spiel' | 'ohne-manuskript'

const key = (entry: Pick<Entry, 'kind' | 'slug'>) => `${entry.kind}:${entry.slug}`
const draftOf = (entry: Entry): Draft => ({
  mode: entry.release?.mode ?? 'hidden',
  rubric: entry.release?.rubric ?? '',
  sampleChapters: entry.release?.sampleChapters ?? 1,
  sort: entry.release?.sort ?? 100,
  purchaseNote: entry.release?.purchaseNote ?? '',
})
const same = (a: Draft, b: Draft) => a.mode === b.mode && a.rubric === b.rubric && a.sampleChapters === b.sampleChapters && a.sort === b.sort && a.purchaseNote === b.purchaseNote

export default function BooksAdminPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [source, setSource] = useState<{ ok: boolean; message: string | null } | null>(null)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [filter, setFilter] = useState<Filter>('alle')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const { token } = await getSessionInfo()
    const response = await fetch('/api/admin/readings', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) return { error: String(json.error ?? 'Nicht erreichbar') }
    return { entries: json.entries as Entry[], source: json.source as { ok: boolean; message: string | null } }
  }, [])
  const apply = useCallback((result: Awaited<ReturnType<typeof fetchData>>) => {
    if ('error' in result) { setError(result.error ?? ''); return }
    setError('')
    setEntries(result.entries)
    setSource(result.source)
    setDrafts(Object.fromEntries(result.entries.map(entry => [key(entry), draftOf(entry)])))
  }, [])
  useEffect(() => {
    let live = true
    void fetchData().then(result => { if (live) apply(result) })
    return () => { live = false }
  }, [fetchData, apply])

  async function post(body: Record<string, unknown>) {
    const { token } = await getSessionInfo()
    const response = await fetch('/api/admin/readings', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(String(json.error ?? 'Fehlgeschlagen'))
  }

  async function save(entry: Entry) {
    const draft = drafts[key(entry)]
    setBusy(key(entry)); setSaved(null)
    try {
      await post({ kind: entry.kind, slug: entry.slug, ...draft, rubric: draft.rubric || null })
      apply(await fetchData())
      setSaved(key(entry))
    } catch (err) { setError(err instanceof Error ? err.message : 'Fehlgeschlagen') } finally { setBusy(null) }
  }

  async function refresh() {
    setBusy('refresh')
    try { await post({ action: 'refresh' }); apply(await fetchData()) } catch (err) { setError(err instanceof Error ? err.message : 'Fehlgeschlagen') } finally { setBusy(null) }
  }

  const shown = useMemo(() => (entries ?? []).filter(entry => {
    const mode = entry.release?.mode ?? 'hidden'
    if (filter === 'im-spiel' && mode === 'hidden') return false
    if (filter === 'nicht-im-spiel' && (mode !== 'hidden' || !entry.manuscriptPath)) return false
    if (filter === 'ohne-manuskript' && entry.manuscriptPath) return false
    const q = query.trim().toLowerCase()
    return !q || entry.title.toLowerCase().includes(q) || entry.slug.includes(q) || entry.genre.toLowerCase().includes(q)
  }), [entries, filter, query])

  const counts = useMemo(() => {
    const list = entries ?? []
    return {
      alle: list.length,
      'im-spiel': list.filter(entry => (entry.release?.mode ?? 'hidden') !== 'hidden').length,
      'nicht-im-spiel': list.filter(entry => (entry.release?.mode ?? 'hidden') === 'hidden' && entry.manuscriptPath).length,
      'ohne-manuskript': list.filter(entry => !entry.manuscriptPath).length,
    } satisfies Record<Filter, number>
  }, [entries])

  return <main className="admin">
    <header>
      <h1>Bücher und Texte</h1>
      <p>Alles, was in buecherwelten liegt, und was davon in der Begegnungsstätte im Regal steht. Den Wortlaut änderst du nur in buecherwelten – hier entscheidest du, ob ein Text frei lesbar ist, als Leseprobe (die ersten Kapitel, danach dein Bezugshinweis), nur mit Klappentext oder gar nicht.</p>
    </header>
    {error && <p className="error">{error}</p>}
    {source && <p className={source.ok ? 'source ok' : 'source bad'}>
      {source.ok ? 'Verbunden mit buecherwelten (Stand bis zu 15 Minuten alt).' : `buecherwelten nicht erreichbar: ${source.message}`}
      <button disabled={busy === 'refresh'} onClick={() => void refresh()}>{busy === 'refresh' ? 'Lädt …' : 'Jetzt neu laden'}</button>
    </p>}
    {!entries && !error && <p>Lädt …</p>}
    {entries && <>
      <section className="filters">
        {(['alle', 'im-spiel', 'nicht-im-spiel', 'ohne-manuskript'] as Filter[]).map(id => <button key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
          <b>{counts[id]}</b> {id === 'alle' ? 'alle' : id === 'im-spiel' ? 'im Spiel' : id === 'nicht-im-spiel' ? 'nicht im Spiel' : 'noch ohne Manuskript'}
        </button>)}
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Suchen …"/>
      </section>
      <section className="list">
        {shown.map(entry => {
          const id = key(entry)
          const draft = drafts[id] ?? draftOf(entry)
          const dirty = !same(draft, draftOf(entry))
          const set = (patch: Partial<Draft>) => setDrafts(current => ({ ...current, [id]: { ...draft, ...patch } }))
          const modes = entry.manuscriptPath ? READING_MODES : (['hidden', 'teaser'] as const)
          const readable = draft.mode === 'full' ? entry.chapters.length : draft.mode === 'sample' ? Math.min(entry.chapters.length, draft.sampleChapters) : 0
          return <article key={id} className={'entry ' + draft.mode + (dirty ? ' dirty' : '')}>
            <div className="head">
              <div>
                <b>{entry.title}</b>{entry.subtitle && <span className="sub"> – {entry.subtitle}</span>}
                <p className="muted">
                  {entry.kind === 'work' ? 'Werk' : 'Text'} · {entry.genre}{entry.version ? ` · ${entry.version}` : ''}
                  {entry.manuscriptPath ? ` · ${entry.chapters.length} ${entry.chapters.length === 1 ? 'Teil' : 'Kapitel/Teile'}` : ''}
                  {entry.manuscriptPath && (entry.complete ? ' · vollständig' : ' · unvollständig')}
                </p>
                {entry.note && <p className="note">{entry.note}</p>}
              </div>
              <span className={'badge ' + (entry.release?.mode ?? 'hidden')}>{READING_MODE_LABEL[entry.release?.mode ?? 'hidden']}{entry.release?.rubric ? ` · ${rubricLabel(entry.release.rubric)}` : ''}</span>
            </div>
            <div className="controls">
              <label>Im Spiel<select value={draft.mode} onChange={event => set({ mode: event.target.value as ReadingMode })}>
                {modes.map(mode => <option key={mode} value={mode}>{READING_MODE_LABEL[mode]}</option>)}
              </select></label>
              {draft.mode !== 'hidden' && <label>Fach im Regal<select value={draft.rubric} onChange={event => set({ rubric: event.target.value })}>
                <option value="">– wählen –</option>
                {READING_RUBRICS.map(rubric => <option key={rubric.id} value={rubric.id}>{rubric.label}</option>)}
              </select></label>}
              {draft.mode === 'sample' && <label>Frei lesbare Kapitel<input type="number" min={0} max={Math.max(0, entry.chapters.length)} value={draft.sampleChapters} onChange={event => set({ sampleChapters: Math.max(0, Number(event.target.value) || 0) })}/></label>}
              {draft.mode !== 'hidden' && <label>Reihenfolge<input type="number" min={0} max={9999} step={10} value={draft.sort} onChange={event => set({ sort: Number(event.target.value) || 0 })}/></label>}
              {(draft.mode === 'sample' || draft.mode === 'teaser') && <label className="wide">Bezugshinweis<input value={draft.purchaseNote} maxLength={280} onChange={event => set({ purchaseNote: event.target.value })} placeholder="z. B. Als Buch erhältlich bei … / im Buchhandel"/></label>}
              <button className="save" disabled={!dirty || busy === id} onClick={() => void save(entry)}>{busy === id ? 'Speichert …' : saved === id && !dirty ? 'Gespeichert' : 'Speichern'}</button>
            </div>
            {draft.mode === 'sample' && entry.chapters.length > 0 && <ol className="chapters">
              {entry.chapters.map((heading, index) => <li key={index} className={index < readable ? 'open' : 'closed'}>{heading}</li>)}
            </ol>}
          </article>
        })}
        {shown.length === 0 && <p className="muted">Nichts gefunden.</p>}
      </section>
    </>}
    <style jsx>{`
      .admin{max-width:1100px;margin:0 auto;padding:24px 16px;font-family:system-ui;color:#1d2a30;background:#f6f4ee;min-height:100vh}
      h1{margin:0 0 4px}
      header p,.muted{color:#5d6b70;font-size:13px;margin:2px 0}
      .error{color:#a3271f}
      .source{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;padding:8px 10px;border-radius:6px}
      .source.ok{background:#e8f2ef;color:#24584a} .source.bad{background:#f8e6e3;color:#8a2a20}
      button{border:1px solid #c9c2b0;background:#fff;border-radius:6px;padding:5px 9px;cursor:pointer;font-size:12px;color:#1d2a30}
      button:disabled{opacity:.5;cursor:default}
      .filters{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}
      .filters button.on{background:#1f4f54;color:#fff;border-color:#1f4f54}
      .filters input{flex:1;min-width:160px;padding:5px 8px;border:1px solid #c9c2b0;border-radius:6px;font:inherit;font-size:13px}
      .entry{background:#fff;border:1px solid #e6e1d4;border-left:4px solid #c9c2b0;border-radius:8px;padding:10px 12px;margin-bottom:8px}
      .entry.full{border-left-color:#3c8a5a} .entry.sample{border-left-color:#c9a447} .entry.teaser{border-left-color:#3a6ea5}
      .entry.dirty{box-shadow:0 0 0 2px #f0d58a}
      .head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .sub{color:#5d6b70;font-size:13px}
      .note{font-size:12px;color:#8a5a20;margin:2px 0}
      .badge{font-size:11px;white-space:nowrap;padding:2px 7px;border-radius:10px;background:#eee9dc;color:#5d6b70}
      .badge.full{background:#e1f0e6;color:#2f6e48} .badge.sample{background:#f6ecd0;color:#7a5c12} .badge.teaser{background:#e2ebf5;color:#2d5888}
      .controls{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:8px}
      label{display:grid;gap:2px;font-size:11px;color:#5d6b70}
      label.wide{flex:1;min-width:220px}
      select,input{padding:5px 7px;border:1px solid #c9c2b0;border-radius:5px;font:inherit;font-size:12px;color:#1d2a30;background:#fff}
      input[type=number]{width:90px}
      .save{background:#1f4f54;color:#fff;border-color:#1f4f54}
      .chapters{margin:8px 0 0;padding-left:20px;font-size:12px;columns:2;column-gap:24px}
      .chapters li.open{color:#2f6e48} .chapters li.closed{color:#9aa3a6}
      @media (max-width:640px){.chapters{columns:1}.head{flex-direction:column}}
    `}</style>
  </main>
}
