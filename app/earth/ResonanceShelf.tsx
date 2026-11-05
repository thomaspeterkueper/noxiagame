'use client'

// app/earth/ResonanceShelf.tsx
// Das Regal der Begegnungsstätte (05.11.2026): Fächer statt flacher Liste, Lesezeichen,
// Leseproben mit Bezugshinweis. Wortlaut aus buecherwelten über /api/game/readings;
// was im Regal steht, entscheidet der Adminbereich (Bücher & Texte).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { READING_RUBRICS, rubricLabel, type ReadingDocument, type ReadingListEntry } from '@/lib/game/readings/types'

const bookKey = (entry: Pick<ReadingListEntry, 'kind' | 'slug'>) => `${entry.kind}:${entry.slug}`
const BOOKMARK_PREFIX = 'noxia:lesezeichen:'

function readBookmark(id: string): number | null {
  try {
    const value = window.localStorage.getItem(BOOKMARK_PREFIX + id)
    return value === null ? null : Math.max(0, Number(value) || 0)
  } catch { return null }
}
function writeBookmark(id: string, part: number) {
  try { window.localStorage.setItem(BOOKMARK_PREFIX + id, String(part)) } catch { /* ohne Speicher kein Lesezeichen */ }
}

async function api<T>(query = ''): Promise<T> {
  const { token } = await getSessionInfo()
  const response = await fetch('/api/game/readings' + query, { headers: { Authorization: 'Bearer ' + token } })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(json.error ?? 'Die Schriften sind gerade nicht erreichbar.'))
  return json as T
}

/** Überschriften im Wortlaut (#, ##, ###) hervorheben, sonst Text wie geschrieben. */
function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n(?=#{1,6}\s)/)
  return <>{blocks.map((block, index) => {
    const match = /^(#{1,6})\s+(.*)(?:\n([\s\S]*))?$/.exec(block)
    if (!match) return <p key={index} className="prose">{block}</p>
    return <div key={index}><p className={'heading h' + match[1].length}>{match[2]}</p>{match[3] && <p className="prose">{match[3]}</p>}</div>
  })}</>
}

type Props = {
  /** Die Figur steht am Regal oder am Bereich „Lesen & Denken“. */
  atShelf: boolean
  /** Meldet, ob gerade die Liste oder ein Buch offen ist (die Seitenleiste blendet dann ihren Hinweis aus). */
  onActiveChange?: (active: boolean) => void
}

export default function ResonanceShelf({ atShelf, onActiveChange }: Props) {
  const [books, setBooks] = useState<ReadingListEntry[] | null>(null)
  const [listError, setListError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [doc, setDoc] = useState<ReadingDocument | null>(null)
  const [docError, setDocError] = useState('')
  const [part, setPart] = useState<number | null>(null)
  const [large, setLarge] = useState(false)
  const [rubric, setRubric] = useState<string | null>(null)

  const active = Boolean(openId) || atShelf
  useEffect(() => { onActiveChange?.(active) }, [active, onActiveChange])

  // Die Liste erst laden, wenn jemand ans Regal tritt.
  useEffect(() => {
    if (!atShelf || books) return
    let live = true
    api<{ books: ReadingListEntry[] }>()
      .then(json => { if (live) { setBooks(json.books); setListError('') } })
      .catch(error => { if (live) setListError(error instanceof Error ? error.message : String(error)) })
    return () => { live = false }
  }, [atShelf, books])

  useEffect(() => {
    if (!openId) return
    let live = true
    api<{ document: ReadingDocument }>('?book=' + encodeURIComponent(openId))
      .then(json => {
        if (!live) return
        setDoc(json.document); setDocError('')
        const mark = readBookmark(openId)
        setPart(mark !== null && mark < json.document.sections.length ? mark : null)
      })
      .catch(error => { if (live) setDocError(error instanceof Error ? error.message : String(error)) })
    return () => { live = false }
  }, [openId])

  const goTo = useCallback((index: number | null) => {
    setPart(index)
    if (openId && index !== null) writeBookmark(openId, index)
  }, [openId])

  const grouped = useMemo(() => {
    const groups = new Map<string, ReadingListEntry[]>()
    for (const entry of books ?? []) {
      const id = entry.rubric ?? 'weitere'
      groups.set(id, [...(groups.get(id) ?? []), entry])
    }
    const order = [...READING_RUBRICS.map(item => item.id as string), 'weitere']
    return [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
  }, [books])

  const close = () => { setOpenId(null); setDoc(null); setPart(null); setDocError(''); setLarge(false) }

  if (!active) return null

  if (openId) {
    const section = doc && part !== null ? doc.sections[part] : null
    const locked = doc ? doc.chapters - doc.sections.length : 0
    const reader = <div className={'shelf book' + (large ? ' large' : '')}>
      {!doc && !docError && <p>Du ziehst das Buch heraus …</p>}
      {docError && <p>{docError}</p>}
      {doc && <>
        <span>{rubricLabel(doc.rubric).toUpperCase()}</span>
        <b>{doc.title}</b>
        {doc.subtitle && <i>{doc.subtitle}</i>}
        <i>{doc.genre}{doc.version ? ` · ${doc.version}` : ''} · Thomas Peter Küper</i>
        {doc.mode === 'teaser' && <>
          {doc.teaser && <p>{doc.teaser}</p>}
          {doc.purchaseNote && <p className="purchase">{doc.purchaseNote}</p>}
        </>}
        {doc.mode !== 'teaser' && section === null && <>
          {doc.mode === 'sample' && <p className="muted">Leseprobe: {doc.sections.length} von {doc.chapters} Kapiteln frei lesbar.</p>}
          {readBookmark(openId) !== null && readBookmark(openId)! < doc.sections.length && <button className="act" onClick={() => goTo(readBookmark(openId))}>Beim Lesezeichen weiterlesen: {doc.sections[readBookmark(openId)!]?.heading}</button>}
          <div className="toc">
            {doc.sections.map((item, index) => <button key={index} onClick={() => goTo(index)}>{item.heading}</button>)}
            {locked > 0 && <p className="locked">… und {locked} weitere {locked === 1 ? 'Kapitel' : 'Kapitel'} im vollständigen Buch.</p>}
          </div>
          {locked > 0 && doc.purchaseNote && <p className="purchase">{doc.purchaseNote}</p>}
        </>}
        {section && part !== null && <>
          <div className="row nav">
            <button className="act quiet" onClick={() => setPart(null)}>← Inhalt</button>
            <span>{part + 1} / {doc.sections.length}{locked > 0 ? ` (von ${doc.chapters})` : ''}</span>
            <button className="act quiet" onClick={() => setLarge(value => !value)}>{large ? 'Kleiner' : 'Groß lesen'}</button>
          </div>
          <p className="heading h2">{section.heading}</p>
          <article><Prose text={section.text}/></article>
          <div className="row nav">
            <button className="act quiet" disabled={part === 0} onClick={() => goTo(Math.max(0, part - 1))}>← Vorheriges</button>
            <button className="act" disabled={part + 1 >= doc.sections.length} onClick={() => goTo(Math.min(doc.sections.length - 1, part + 1))}>Weiter →</button>
          </div>
          {part + 1 >= doc.sections.length && locked > 0 && <p className="purchase">Hier endet die Leseprobe.{doc.purchaseNote ? ' ' + doc.purchaseNote : ''}</p>}
        </>}
      </>}
      <button className="act" onClick={close}>← Zurück zum Regal</button>
    </div>
    return <div className="rshelf">{large ? <div className="overlay" onClick={event => { if (event.target === event.currentTarget) setLarge(false) }}>{reader}</div> : reader}<ShelfStyle/></div>
  }

  return <div className="rshelf"><div className="shelf book">
    <b>Lesen &amp; Denken</b>
    <p>Schriften zu Philosophie, Bewusstsein, Ethik und Theologie – frei zum Lesen, ohne Credits.</p>
    {listError && <p className="muted">{listError}</p>}
    {!books && !listError && <p className="muted">Du schaust die Regale entlang …</p>}
    {books && books.length === 0 && <p className="muted">Die Regale sind gerade leer.</p>}
    {books && books.length > 0 && <>
      <div className="tabs">
        <button className={rubric === null ? 'on' : ''} onClick={() => setRubric(null)}>Alle</button>
        {grouped.map(([id]) => <button key={id} className={rubric === id ? 'on' : ''} onClick={() => setRubric(id)}>{rubricLabel(id)}</button>)}
      </div>
      <div className="books">
        {grouped.filter(([id]) => rubric === null || rubric === id).map(([id, entries]) => <section key={id}>
          <h4>{rubricLabel(id).toUpperCase()}</h4>
          {entries.map(entry => {
            const mark = readBookmark(bookKey(entry))
            return <button key={bookKey(entry)} onClick={() => { setOpenId(bookKey(entry)); setDoc(null) }}>
              <b>{entry.title}</b>
              <span>{entry.genre}{entry.chapters > 1 ? ` · ${entry.chapters} Teile` : ''}{entry.mode === 'sample' ? ' · Leseprobe' : entry.mode === 'teaser' ? ' · Klappentext' : ''}{mark !== null ? ' · Lesezeichen' : ''}</span>
            </button>
          })}
        </section>)}
      </div>
    </>}
  </div><ShelfStyle/></div>
}


function ShelfStyle() {
  return <style jsx global>{`
.rshelf .book{display:grid;gap:5px;padding:10px;border:1px solid #5d4428;border-radius:6px;background:#efe6d2;color:#2b2118}
.rshelf .book > span{font:800 8px monospace;letter-spacing:.1em;color:#7a5a36}
.rshelf .book > b{font-size:14px;line-height:1.2}
.rshelf .book > i{font-size:10px;color:#6b5a48}
.rshelf .book > p{margin:2px 0 4px;color:#2b2118;line-height:1.5}
.rshelf .muted{color:#6b5a48 !important;font-size:10px}
.rshelf .purchase{border-left:3px solid #b58a3a;padding-left:7px;color:#4a3820 !important}
.rshelf .row{display:flex;gap:6px;align-items:center}
.rshelf .nav{justify-content:space-between}
.rshelf .nav span{font:800 9px monospace;color:#7a5a36}
.rshelf .act{border:1px solid #6e7d55;border-radius:5px;background:#273d24;color:#edf3dd;padding:7px 9px;font:800 9px monospace;cursor:pointer;text-align:left}
.rshelf .act.quiet{border-color:#476476;background:#102b3c;color:#dce9ee}
.rshelf .act:disabled{opacity:.45;cursor:default}
.rshelf .tabs{display:flex;flex-wrap:wrap;gap:3px}
.rshelf .tabs button{border:1px solid #b9a888;background:#f7f0e2;color:#4a3820;border-radius:10px;padding:2px 7px;font-size:9px;cursor:pointer}
.rshelf .tabs button.on{background:#5d4428;color:#f7f0e2;border-color:#5d4428}
.rshelf .books{display:grid;gap:10px;max-height:320px;overflow:auto;padding-right:4px}
.rshelf .books section{display:grid;gap:3px}
.rshelf .books h4{margin:4px 0 2px;font:800 8px monospace;letter-spacing:.1em;color:#7a5a36}
.rshelf .books button,.rshelf .toc button{display:grid;gap:1px;text-align:left;border:0;border-left:3px solid #8a5a3a;border-radius:2px;background:#16302f;color:#eef2ed;padding:5px 8px;cursor:pointer}
.rshelf .books button:hover,.rshelf .toc button:hover{background:#1d3d3c}
.rshelf .books button b{font-size:11px}
.rshelf .books button span{font-size:9px;color:#8ea4a6}
.rshelf .toc{display:grid;gap:3px;max-height:300px;overflow:auto}
.rshelf .toc button{font-size:11px}
.rshelf .locked{font-size:10px;color:#7a6a58;margin:2px 0}
.rshelf article{max-height:55vh;overflow-y:auto;padding:6px 2px 10px;line-height:1.65;font-size:12px}
.rshelf .prose{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 8px}
.rshelf .heading{margin:10px 0 4px;font-weight:800;color:#3d2c18}
.rshelf .heading.h1{font-size:15px}
.rshelf .heading.h2{font-size:13px}
.rshelf .heading.h3,.rshelf .heading.h4,.rshelf .heading.h5,.rshelf .heading.h6{font-size:12px}
.rshelf .overlay{position:fixed;inset:0;z-index:3000;background:#0b1415cc;display:flex;justify-content:center;align-items:flex-start;padding:4vh 16px;overflow:auto}
.rshelf .large{width:min(720px,100%);font-size:13px}
.rshelf .large article{max-height:70vh;font-size:15px;line-height:1.75;padding:8px 6px 14px}
  `}</style>
}
