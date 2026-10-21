'use client'

import React, { useMemo, useState } from 'react'

type Module = {
  id: string
  title?: string
  name?: string
  summary?: string
  description?: string
  domain?: string
  subject?: string
  difficulty?: number
  durationMinutes?: number
  ssfUrl?: string
}

type Props = {
  modules: Module[]
  completedModules: string[]
  onBrowse: () => void
  onTasks: () => void
  onCourses: () => void
}

const COLORS = ['#2a4e7a', '#2a7864', '#926b2f', '#694d8e', '#9b5555', '#397f91']
const C = { ink: '#1f2933', muted: '#625f59', border: '#ddd6c8', gold: '#876000' }
const groupOf = (m: Module) => (m.domain || m.subject || 'Weitere Themen').trim()
const titleOf = (m: Module) => m.title || m.name || m.id

export default function AcademyHome({ modules, completedModules, onBrowse, onTasks, onCourses }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const completed = useMemo(() => new Set(completedModules), [completedModules])
  const groups = useMemo(() => {
    const grouped = new Map<string, Module[]>()
    for (const m of modules) {
      const group = groupOf(m)
      grouped.set(group, [...(grouped.get(group) ?? []), m])
    }
    return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'))
  }, [modules])
  const recommended = modules.filter(m => !completed.has(m.id))
    .filter(m => !query || [titleOf(m), groupOf(m), m.summary || ''].join(' ').toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')))
    .slice(0, 4)
  const detail = modules.find(m => m.id === selected)
  const button = { border: '1px solid #c9ba9f', borderRadius: 9, background: '#fff', padding: '0.7rem 0.85rem', cursor: 'pointer', color: '#2a4e7a', fontWeight: 700 as const }

  return <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', color: C.ink }}>
    <header style={{ marginBottom: 18 }}>
      <div style={{ color: C.gold, letterSpacing: '0.14em', fontSize: 11, fontWeight: 800 }}>NOχ¹ᐃ · AKADEMIE</div>
      <h2 style={{ margin: '0.3rem 0', fontSize: '1.45rem', color: '#233c52' }}>Dein Wissensuniversum</h2>
      <p style={{ margin: 0, color: C.muted, lineHeight: 1.6, fontSize: 13 }}>Erkunde Zusammenhänge, finde deinen nächsten Lernpfad und besuche die SSF-Bibliothek. Prüfungen gibt es erst bei qualifizierenden Freischaltungen.</p>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 9, marginBottom: 18 }}>
      {[
        { label: 'Abgeschlossene Module', value: completedModules.length },
        { label: 'SSF-Fachgebiete', value: groups.length },
        { label: 'Entdeckbare Module', value: modules.filter(m => !completed.has(m.id)).length },
      ].map(item => <div key={item.label} style={{ background: '#fff', border: '1px solid ' + C.border, borderRadius: 10, padding: 13 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#2a4e7a' }}>{item.value}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{item.label}</div>
      </div>)}
    </div>
    <section style={{ background: '#fff', border: '1px solid ' + C.border, borderRadius: 12, padding: 15, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: '#2a4e7a' }}>Dein Wissensbaum</h3>
        <small style={{ color: C.muted }}>Aus echten SSF-Modulen und Abschlüssen</small>
      </div>
      {groups.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', alignItems: 'center', margin: '22px 0' }}>
        {groups.map(([group, items], i) => {
          const done = items.filter(m => completed.has(m.id)).length
          return <button key={group} onClick={() => { setQuery(group); setSelected(items[0]?.id ?? null) }}
            aria-label={group + ': ' + done + ' von ' + items.length + ' Modulen abgeschlossen'}
            style={{ width: 118, height: 118, borderRadius: '50%', border: '3px solid ' + COLORS[i % COLORS.length], background: '#f4f7f7', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 9, gap: 5 }}>
            <strong style={{ fontSize: 12, color: '#233c52', wordBreak: 'break-word' }}>{group}</strong>
            <span style={{ fontSize: 11, color: C.muted }}>{done} / {items.length}</span>
          </button>
        })}
      </div> : <p style={{ lineHeight: 1.6, color: C.muted }}>Noch keine SSF-Module synchronisiert. Der Wissensbaum wächst, sobald Inhalte verfügbar sind. Deine bisher abgeschlossenen Module bleiben erhalten.</p>}
      <small style={{ color: C.muted }}>Die Fachgebiete sind eine erste Kartenansicht; kanonische KG-Verbindungen werden erst nach Abgleich mit dem Knowledge Graph angezeigt.</small>
    </section>
    <section style={{ marginBottom: 17 }}>
      <h3 style={{ margin: '0 0 9px', color: '#2a4e7a' }}>Als Nächstes entdecken</h3>
      <input aria-label="Lernmodule durchsuchen" placeholder="Thema oder Begriff suchen …" value={query} onChange={e => setQuery(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: 11, borderRadius: 9, border: '1px solid ' + C.border, marginBottom: 10, color: C.ink, background: '#fff' }}/>
      {recommended.length ? recommended.map(m => <button key={m.id} onClick={() => setSelected(m.id)}
        style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8, padding: 12, borderRadius: 9, border: '1px solid ' + C.border, background: '#fff', cursor: 'pointer' }}>
        <strong style={{ display: 'block', color: '#2a4e7a' }}>{titleOf(m)}</strong>
        <small style={{ color: C.muted }}>{groupOf(m)} · Noch nicht abgeschlossen</small>
        {m.summary && <p style={{ margin: '6px 0 0', color: C.muted, fontSize: 12 }}>{m.summary}</p>}
      </button>) : <p style={{ fontSize: 13, color: C.muted }}>{query ? 'Keine passenden offenen Module gefunden.' : 'Aktuell keine weiteren offenen SSF-Module verfügbar.'}</p>}
      {detail && <aside style={{ background: '#f0f4f6', padding: 14, borderRadius: 9, border: '1px solid ' + C.border }}>
        <strong>{titleOf(detail)}</strong>
        <p style={{ fontSize: 12, lineHeight: 1.6 }}>{detail.description || detail.summary || 'Details findest du in der SSF-Bibliothek.'}</p>
        {detail.ssfUrl && <a href={detail.ssfUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2a4e7a', fontWeight: 700 }}>Dieses Modul in SSF öffnen ↗</a>}
      </aside>}
    </section>
    <section style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button style={button} onClick={onBrowse}>SSF-Bibliothek öffnen →</button>
      <button style={button} onClick={onCourses}>Lernpfade und Kurse →</button>
      <button style={button} onClick={onTasks}>Freiwillige Aufgaben →</button>
    </section>
  </div>
}
