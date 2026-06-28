// app/dashboard/SchoolOverlay.tsx
// Aktualisiert: 28.06.2026 — SSF direkt in Akademie integriert
'use client'

import React, { useEffect, useRef, useState } from 'react'

interface ColonyContext {
  locationName: string
  population: number
  waterStock: number
  waterCons: number
  credits: number
}

interface SchoolOverlayProps {
  locationSlug: string
  colonyContext: ColonyContext
  onClose: () => void
  onKnowledgeEarned: (pts: number, newTotal: number) => void
}

type CalcTask = { kind: 'calc'; question: string; answer: number; explanation: string; points: number; topic: string }
type QuizTask = { kind: 'quiz'; question: string; options: string[]; correct: number; explanation: string; points: number; topic: string }
type Task = CalcTask | QuizTask

type SsfModule = {
  id: string
  title?: string
  name?: string
  description?: string
  subject?: string
  durationMinutes?: number
  difficulty?: number
  reward?: string
  unlocks?: string[]
}

const MONO = "'Courier Prime', monospace"
const C = {
  bg: 'rgba(248,245,238,0.94)',
  bgAlt: 'rgba(242,237,228,0.96)',
  border: '#ddd6c8',
  text: '#1a1a18',
  textMuted: '#6b6357',
  textFaint: '#9e9485',
  accent: '#2a4e7a',
  gold: '#8a6a00',
  goldLight: '#faf3e0',
  green: '#1a7a4a',
  greenLight: '#e8f7ef',
  red: '#b52a2a',
  redLight: '#faeaea',
}

const ACADEMY_BG: Record<string, { src: string; label: string }> = {
  earth: { src: '/images/building-backgrounds/school-back-earth.png', label: 'Erde · Universität' },
  mars: { src: '/images/building-backgrounds/school-back-mars.png', label: 'Mars · Tharsis Hub' },
  prometheus: { src: '/images/building-backgrounds/school-back-prometheus.png', label: 'Prometheus Station · L5' },
}

const MANUAL_SECTIONS = [
  { id: 'ziel', title: 'Dein Ziel', content: 'Du bist Pilot und Händler im Sonnensystem. Kolonien brauchen Wasser, Energie, Metall und Bauteile.' },
  { id: 'wissen', title: 'Wissen & SSF', content: 'Die Solar Science Foundation liefert Lernmodule. Abgeschlossene Module können NOXIA-Freischaltungen auslösen.' },
  { id: 'bauen', title: 'Bauen & Industrie', content: 'Mine erzeugt Metall. Fabrik verbraucht Metall und produziert Bauteile. Bauteile werden später für größere Gebäude benötigt.' },
  { id: 'handel', title: 'Handel', content: 'Kaufe Ressourcen günstig, transportiere sie und verkaufe dort, wo Knappheit herrscht.' },
]

function fallbackTask(): Task {
  const tasks: Task[] = [
    { kind: 'calc', question: 'Ein Frachter kauft 80 Tonnen Wasser für 95 Cr/t und verkauft sie für 155 Cr/t. Wie viel Gewinn macht er?', answer: 4800, explanation: '80 × (155 − 95) = 4.800 Cr', points: 15, topic: 'Handel' },
    { kind: 'quiz', question: 'Warum kostet Erde→Mond mehr Energie als Mond→Erde?', options: ['Mond ist weiter weg', 'Erdgravitation muss überwunden werden', 'Mond hat stärkere Gravitation', 'Wasser ist schwerer'], correct: 1, explanation: 'Die Erde besitzt den tieferen Gravitationsbrunnen.', points: 20, topic: 'Physik' },
    { kind: 'calc', question: 'Eine Mine produziert 5 Metall/Tick. Wie viel Metall entsteht in 6 Ticks?', answer: 30, explanation: '5 × 6 = 30 Metall.', points: 10, topic: 'Ressourcen' },
  ]
  return tasks[Math.floor(Math.random() * tasks.length)]
}

function ManualTab({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState('ziel')
  return (
    <div style={{ padding: '1.4rem', overflowY: 'auto', flex: 1 }}>
      {MANUAL_SECTIONS.map(s => (
        <div key={s.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          <button onClick={() => setOpen(open === s.id ? '' : s.id)} style={{ width: '100%', textAlign: 'left', background: open === s.id ? '#e8eef6' : C.bgAlt, border: 'none', padding: '0.7rem 1rem', cursor: 'pointer', color: open === s.id ? C.accent : C.text, fontFamily: MONO, fontWeight: 700 }}>
            {s.title}
          </button>
          {open === s.id && <div style={{ padding: '0.85rem 1rem', background: '#fff', fontSize: '0.84rem', lineHeight: 1.7, color: C.text }}>{s.content}</div>}
        </div>
      ))}
      <button onClick={onClose} style={{ marginTop: 12, background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, padding: '0.5rem 1.2rem', borderRadius: 8, cursor: 'pointer', fontFamily: MONO }}>Schließen</button>
    </div>
  )
}

function SsfTab() {
  const [modules, setModules] = useState<SsfModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/ssf/modules', { cache: 'no-store' })
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.modules ?? data.items ?? [])
        if (!cancelled) setModules(list)
      } catch {
        if (!cancelled) setError('SSF-Module konnten nicht geladen werden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.62rem', color: C.gold, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: MONO, fontWeight: 700 }}>Solar Science Foundation</div>
        <h3 style={{ margin: '0.35rem 0 0.4rem', color: C.accent, fontSize: '1.05rem' }}>SSF-Lernmodule</h3>
        <p style={{ margin: 0, color: C.textMuted, fontSize: '0.82rem', lineHeight: 1.6 }}>Lerne Grundlagen und schalte später NOXIA-Technologien frei.</p>
        <a href="/ssf" style={{ display: 'inline-block', marginTop: '0.75rem', color: C.gold, fontWeight: 700, textDecoration: 'none', fontSize: '0.8rem' }}>Große SSF-Ansicht öffnen →</a>
      </div>

      {loading && <div style={{ color: C.textMuted, fontFamily: MONO }}>Lade Module …</div>}
      {error && <div style={{ color: C.red, fontFamily: MONO }}>{error}</div>}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
          {modules.map(m => {
            const title = m.title ?? m.name ?? m.id
            const unlock = m.reward ?? m.unlocks?.[0]
            return (
              <div key={m.id} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.85rem 0.95rem' }}>
                <div style={{ fontWeight: 800, color: C.text, fontSize: '0.82rem' }}>{title}</div>
                <div style={{ color: C.textFaint, fontSize: '0.65rem', marginTop: 4, fontFamily: MONO }}>{m.id}</div>
                <div style={{ color: C.textMuted, fontSize: '0.72rem', marginTop: 7, lineHeight: 1.5 }}>{m.description ?? 'SSF-Grundlagenmodul.'}</div>
                {unlock && <div style={{ marginTop: 8, color: C.gold, fontSize: '0.68rem', fontWeight: 700 }}>Unlock: {unlock}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SchoolOverlay({ locationSlug, colonyContext, onClose, onKnowledgeEarned }: SchoolOverlayProps) {
  const [tab, setTab] = useState<'akademie' | 'ssf' | 'handbuch'>('akademie')
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bg = ACADEMY_BG[locationSlug]

  useEffect(() => { loadKnowledge(); generateTask() }, [])
  useEffect(() => { if (task?.kind === 'calc' && !loading && result === null) setTimeout(() => inputRef.current?.focus(), 80) }, [task, loading, result])

  async function jwt() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const { data: { session } } = await createClient().auth.getSession()
      return session?.access_token ?? ''
    } catch { return '' }
  }

  async function loadKnowledge() {
    try {
      const token = await jwt()
      const data = await (await fetch('/api/game/knowledge', { headers: { Authorization: `Bearer ${token}` } })).json()
      setTotal(data.knowledge_points ?? 0)
    } catch {}
  }

  async function generateTask() {
    setLoading(true); setResult(null); setAnswer(''); setSelected(null)
    try {
      const res = await fetch('/api/game/school', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 1, colonyContext }) })
      const data = await res.json()
      setTask(data.task ?? fallbackTask())
    } catch { setTask(fallbackTask()) }
    setLoading(false)
  }

  async function check(opt?: number) {
    if (!task || result) return
    let ok = false
    if (task.kind === 'calc') ok = Number(answer.trim()) === task.answer
    else { setSelected(opt ?? null); ok = opt === task.correct }
    setResult(ok ? 'correct' : 'wrong')
    if (ok) {
      try {
        const token = await jwt()
        const data = await (await fetch(`/api/game/knowledge?action=award&points=${task.points}&reason=school_task&location=${locationSlug}`, { headers: { Authorization: `Bearer ${token}` } })).json()
        if (data.knowledge_points != null) { setTotal(data.knowledge_points); onKnowledgeEarned(task.points, data.knowledge_points) }
      } catch {}
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
      {bg && <img src={bg.src} alt={bg.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} onError={e => { e.currentTarget.style.display = 'none' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,18,28,0.52)' }} />
      <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', zIndex: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: C.textMuted }}>✕</button>
      {bg && <div style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', zIndex: 10, fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(248,245,238,0.85)', fontFamily: MONO }}>{bg.label}</div>}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0.9rem 1.5rem 0', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end' }}>
            {(['akademie','ssf','handbuch'] as const).map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: '0.5rem 1.25rem', border: `1px solid ${tab === t ? C.border : 'transparent'}`, borderBottom: tab === t ? `1px solid ${C.bg}` : `1px solid ${C.border}`, borderRadius: '6px 6px 0 0', cursor: 'pointer', fontFamily: MONO, fontSize: '0.78rem', fontWeight: 700, background: tab === t ? C.bg : C.bgAlt, color: tab === t ? C.accent : C.textMuted }}>{t === 'akademie' ? 'Akademie' : t === 'ssf' ? 'SSF' : 'Handbuch'}</button>)}
            <div style={{ marginLeft: 'auto', paddingBottom: '0.5rem' }}>{total !== null && <span style={{ fontSize: '0.72rem', padding: '2px 10px', borderRadius: 20, background: C.goldLight, color: C.gold, fontWeight: 700, fontFamily: MONO }}>{total} Pkt.</span>}</div>
          </div>
        </div>

        {tab === 'handbuch' && <ManualTab onClose={onClose} />}
        {tab === 'ssf' && <SsfTab />}
        {tab === 'akademie' && <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem 1.25rem' }}>
          {loading && <div style={{ textAlign: 'center', padding: '2.5rem', color: C.textMuted, fontFamily: MONO }}>Aufgabe wird generiert …</div>}
          {!loading && task && <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: 20, background: '#e8eef6', color: C.accent, fontWeight: 700, fontFamily: MONO }}>{task.topic}</span><span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: 20, background: C.bgAlt, color: C.textMuted, fontFamily: MONO }}>{task.kind === 'quiz' ? 'Wissensfrage' : 'Rechenaufgabe'}</span></div>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accent}`, borderRadius: '0 8px 8px 0', padding: '1rem 1.25rem', marginBottom: '1rem', fontSize: '0.95rem', lineHeight: 1.7 }}>{task.question}</div>
            {result === null && task.kind === 'calc' && <><input ref={inputRef} type="number" placeholder="Deine Antwort …" value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} style={{ width: '100%', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '1rem', fontFamily: MONO }} /><button onClick={() => check()} disabled={!answer.trim()} style={{ width: '100%', marginTop: 12, padding: '0.7rem', background: answer.trim() ? C.accent : C.border, color: answer.trim() ? '#fff' : C.textFaint, border: 'none', borderRadius: 8, fontWeight: 700, cursor: answer.trim() ? 'pointer' : 'not-allowed', fontFamily: MONO }}>Prüfen →</button></>}
            {result === null && task.kind === 'quiz' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{task.options.map((o, i) => <button key={i} onClick={() => check(i)} style={{ padding: '0.75rem 1rem', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 8, color: C.text, textAlign: 'left', cursor: 'pointer', fontFamily: MONO }}><strong style={{ color: C.textFaint, marginRight: 10 }}>{['A','B','C','D'][i]}</strong>{o}</button>)}</div>}
            {result === 'correct' && <div style={{ background: C.greenLight, border: '1px solid #a0dcb8', borderRadius: 8, padding: '0.85rem 1.1rem' }}><div style={{ color: C.green, fontWeight: 700, marginBottom: 6, fontFamily: MONO }}>Richtig! +{task.points} Punkte</div><div style={{ lineHeight: 1.65 }}>{task.explanation}</div></div>}
            {result === 'wrong' && <div style={{ background: C.redLight, border: '1px solid #f0a0a0', borderRadius: 8, padding: '0.85rem 1.1rem' }}><div style={{ color: C.red, fontWeight: 700, marginBottom: 6, fontFamily: MONO }}>Nicht ganz.</div><div style={{ lineHeight: 1.65 }}>{task.explanation}</div></div>}
            {result !== null && <button onClick={generateTask} style={{ width: '100%', marginTop: 12, padding: '0.68rem', background: '#fff', border: `1.5px solid ${C.accent}`, color: C.accent, borderRadius: 8, fontFamily: MONO, fontWeight: 700, cursor: 'pointer' }}>Nächste Aufgabe →</button>}
            <div style={{ fontSize: '0.65rem', color: C.textFaint, textAlign: 'center', marginTop: 10, fontFamily: MONO }}>{task.points} Punkte</div>
          </>}
        </div>}
      </div>
    </div>
  )
}
