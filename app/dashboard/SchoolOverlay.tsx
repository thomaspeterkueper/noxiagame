// app/dashboard/SchoolOverlay.tsx
// Aktualisiert: 15.07.2026 — NOX-0007: hardcodierte ECO-Module entfernt, academy_completions
// Version:      4.4.1
'use client'

import React, { useEffect, useRef, useState } from 'react'
import KursRenderer from './KursRenderer'

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
  summary?: string        // Fix: war in Interface nicht deklariert
  subject?: string
  domain?: string         // Fix: war in Interface nicht deklariert
  durationMinutes?: number
  difficulty?: number
  reward?: string
  unlocks?: string[]
  ssfUrl?: string         // Fix: war in Interface nicht deklariert
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
    <div style={{ padding: '1.4rem', overflowY: 'auto' as const, flex: 1 }}>
      {MANUAL_SECTIONS.map(s => (
        <div key={s.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          <button onClick={() => setOpen(open === s.id ? '' : s.id)} style={{ width: '100%', textAlign: 'left' as const, background: open === s.id ? '#e8eef6' : C.bgAlt, border: 'none', padding: '0.7rem 1rem', cursor: 'pointer', color: open === s.id ? C.accent : C.text, fontFamily: MONO, fontWeight: 700 }}>
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
    <div style={{ padding: '1.25rem', overflowY: 'auto' as const, flex: 1 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.62rem', color: C.gold, letterSpacing: '0.18em', textTransform: 'uppercase' as const, fontFamily: MONO, fontWeight: 700 }}>Solar Science Foundation</div>
        <h3 style={{ margin: '0.35rem 0 0.4rem', color: C.accent, fontSize: '1.05rem' }}>SSF-Lernmodule</h3>
        <p style={{ margin: 0, color: C.textMuted, fontSize: '0.82rem', lineHeight: 1.6 }}>Lerne Grundlagen und schalte später NOXIA-Technologien frei.</p>
        <a href="/ssf" style={{ display: 'inline-block', marginTop: '0.75rem', color: C.gold, fontWeight: 700, textDecoration: 'none', fontSize: '0.8rem' }}>Große SSF-Ansicht öffnen →</a>
      </div>
      {loading && <div style={{ color: C.textMuted, fontFamily: MONO }}>Lade Module …</div>}
      {error && <div style={{ color: C.red, fontFamily: MONO }}>{error}</div>}
      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {modules.map(m => (
            <a key={m.id} href={m.ssfUrl ?? '#'} target="_blank" rel="noopener noreferrer"
              style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.75rem 0.9rem', textDecoration: 'none', display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 700, color: C.text, fontSize: '0.85rem' }}>{m.title ?? m.name ?? m.id}</div>
                <span style={{ fontSize: '0.6rem', color: C.textFaint, fontFamily: MONO, marginLeft: 8, flexShrink: 0 }}>↗</span>
              </div>
              <div style={{ color: C.textFaint, fontSize: '0.62rem', marginTop: 3, fontFamily: MONO }}>{m.domain ?? ''} · Schwierigkeit {m.difficulty ?? '?'}</div>
              <div style={{ color: C.textMuted, fontSize: '0.72rem', marginTop: 6, lineHeight: 1.5 }}>{m.summary ?? m.description ?? 'SSF-Grundlagenmodul.'}</div>
              {(m.unlocks?.length ?? 0) > 0 && <div style={{ marginTop: 6, color: C.gold, fontSize: '0.68rem', fontWeight: 700 }}>🔓 Freischaltet: {m.unlocks![0]}</div>}
            </a>
          ))}
          {modules.length === 0 && <div style={{ color: C.textMuted, fontSize: '0.8rem', fontFamily: MONO }}>Keine Module verfügbar.</div>}
        </div>
      )}
    </div>
  )
}

function RightPanel({ topic, kind, modules }: { topic: string | null; kind: Task['kind'] | null; modules: SsfModule[] }) {
  const TOPIC_DOMAIN: Record<string, string> = {
    'Handel': 'economics', 'Ressourcen': 'economics',
    'Navigation': 'physics', 'Physik': 'physics', 'Sonnensystem': 'physics',
    'Energie': 'physics', 'Bevölkerung': 'biology', 'Geschichte': 'history',
  }
  // Calc tasks test arithmetic regardless of their trade-flavoured topic
  // label ("Handel", "Ressourcen", ...) - route to mathematics first.
  // See NOX-0007: this used to fall through to TOPIC_DOMAIN, which has no
  // mathematics entry at all, so a pure addition/subtraction task never
  // matched any SSF module.
  const domain = kind === 'calc' ? 'mathematics' : topic ? TOPIC_DOMAIN[topic] : null
  const relevant = domain
    ? modules.filter(m => (m.domain ?? '').toLowerCase().includes(domain))
    : modules.slice(0, 3)

  if (!topic) return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', height: '100%', color: C.textFaint, textAlign: 'center' as const, padding: '2rem' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.35 }}>📖</div>
      <div style={{ fontFamily: MONO, fontSize: '0.75rem' }}>Lernmaterial erscheint<br/>passend zur Aufgabe</div>
    </div>
  )

  return (
    <div style={{ padding: '1rem', overflowY: 'auto' as const, height: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, color: C.gold, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '0.75rem', fontFamily: MONO }}>
        📚 {topic} · SSF-Material
      </div>
      {relevant.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {relevant.map(m => (
            <a key={m.id} href={m.ssfUrl ?? '#'} target="_blank" rel="noopener noreferrer"
              style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.7rem 0.85rem', textDecoration: 'none', display: 'block' }}>
              <div style={{ fontWeight: 700, color: C.accent, fontSize: '0.82rem' }}>{m.title ?? m.name ?? m.id}</div>
              <div style={{ color: C.textFaint, fontSize: '0.62rem', marginTop: 2, fontFamily: MONO }}>{m.domain ?? ''} · {m.durationMinutes ?? '?'} Min.</div>
              <div style={{ color: C.textMuted, fontSize: '0.72rem', marginTop: 5, lineHeight: 1.5 }}>{m.summary ?? m.description ?? ''}</div>
              {(m.unlocks?.length ?? 0) > 0 && <div style={{ marginTop: 5, color: C.gold, fontSize: '0.65rem', fontWeight: 700 }}>🔓 {m.unlocks![0]}</div>}
            </a>
          ))}
        </div>
      ) : (
        <div style={{ color: C.textMuted, fontSize: '0.8rem', fontFamily: MONO }}>
          Kein passendes SSF-Modul gefunden.
          <a href="https://solarsciencefoundation.vercel.app" target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 8, color: C.gold, fontWeight: 700, textDecoration: 'none', fontSize: '0.75rem' }}>
            SSF öffnen →
          </a>
        </div>
      )}
    </div>
  )
}


// ── ModuleCard — eigene Komponente damit useState legal ist ──────────────────
type ModuleItem = {
  id: string
  name: string
  level: string
  duration: string
  unlocks: string
  content: string
  requires?: string
  quiz: {
    question: string
    options: string[]
    correct: number
    explanation: string
  }
}

function ModuleCard({
  mod, done, requiresDone, moduleLoading, onComplete
}: {
  mod: ModuleItem
  done: boolean
  requiresDone: boolean
  moduleLoading: boolean
  onComplete: (id: string) => void
  key?: string
}) {
  const [showContent, setShowContent] = React.useState(false)
  const [quizAnswer,  setQuizAnswer]  = React.useState<number | null>(null)
  const [quizResult,  setQuizResult]  = React.useState<boolean | null>(null)

  return (
    <div style={{ background: done ? C.greenLight : '#fff', border: `1px solid ${done ? '#a0dcb8' : C.border}`, borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.6rem', opacity: requiresDone ? 1 : 0.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.6rem', color: done ? C.green : C.accent, fontWeight: 700, fontFamily: MONO, letterSpacing: '2px', marginBottom: 3 }}>
            {mod.level} · {mod.duration} {done ? '✓ Abgeschlossen' : ''}
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text }}>{mod.name}</div>
          <div style={{ fontSize: '0.68rem', color: C.textMuted, marginTop: 3 }}>🔓 {mod.unlocks}</div>
          {mod.requires && !requiresDone && (
            <div style={{ fontSize: '0.62rem', color: C.red, marginTop: 3 }}>Voraussetzung: vorheriges Modul abschließen</div>
          )}
        </div>
        {!done && requiresDone && (
          <button onClick={() => setShowContent(v => !v)} style={{ fontSize: '0.7rem', padding: '4px 10px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: MONO, flexShrink: 0 }}>
            {showContent ? 'Schließen' : 'Lernen →'}
          </button>
        )}
      </div>
      {showContent && !done && (
        <div style={{ marginTop: '0.75rem', borderTop: `1px solid ${C.border}`, paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.82rem', lineHeight: 1.75, color: C.text, marginBottom: '1rem' }}>{mod.content}</div>
          <div style={{ background: C.bgAlt, borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>{mod.quiz.question}</div>
            {mod.quiz.options.map((opt, i) => (
              <button key={i} disabled={quizResult !== null}
                onClick={() => { setQuizAnswer(i); setQuizResult(i === mod.quiz.correct) }}
                style={{ display: 'block', width: '100%', textAlign: 'left' as const, padding: '6px 10px', marginBottom: 4, background: quizAnswer === i ? (i === mod.quiz.correct ? C.greenLight : C.redLight) : '#fff', border: `1px solid ${quizAnswer === i ? (i === mod.quiz.correct ? '#a0dcb8' : '#f0a0a0') : C.border}`, borderRadius: 6, cursor: quizResult !== null ? 'default' : 'pointer', fontSize: '0.75rem', fontFamily: MONO }}>
                {['A','B','C','D'][i]}. {opt}
              </button>
            ))}
            {quizResult !== null && (
              <div style={{ marginTop: 8, fontSize: '0.75rem', color: quizResult ? C.green : C.red, lineHeight: 1.6 }}>
                {quizResult ? '✓ Richtig! ' : '✗ Nicht ganz. '}{mod.quiz.explanation}
              </div>
            )}
            {quizResult === true && (
              <button disabled={moduleLoading} onClick={() => onComplete(mod.id)}
                style={{ width: '100%', marginTop: 10, padding: '0.65rem', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: MONO }}>
                {moduleLoading ? '…' : 'Modul abschließen (+50 Pkt.) →'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ── KursListe — zeigt alle verfügbaren Kurse ─────────────────────────────────
function KursListe({ onSelect, jwt }: { onSelect: (id: string) => void; jwt: () => Promise<string> }) {
  const [kurse, setKurse] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const token = await jwt()
        const res = await fetch('/api/game/kurse', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        const data = await res.json() as Record<string, unknown>
        setKurse((data.kurse as any[]) ?? [])
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center' as const, color: C.textMuted, fontFamily: MONO }}>
      Kurse werden geladen …
    </div>
  )

  return (
    <div style={{ padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: '0.65rem', color: C.textMuted, lineHeight: 1.7, marginBottom: '1rem' }}>
        Interaktive Lernkurse mit Folien und Quiz. Jeder abgeschlossene Kurs gibt Wissenspunkte.
      </div>
      {kurse.length === 0 && (
        <div style={{ color: C.textMuted, fontFamily: MONO, fontSize: '0.8rem' }}>
          Keine Kurse verfügbar.
        </div>
      )}
      {kurse.map((k: any) => (
        <div key={k.id} style={{
          background: k.abgeschlossen ? C.greenLight : '#fff',
          border: `1px solid ${k.abgeschlossen ? '#a0dcb8' : C.border}`,
          borderLeft: `3px solid ${k.thema_farbe ?? C.accent}`,
          borderRadius: 8,
          padding: '0.85rem 1rem',
          marginBottom: '0.6rem',
          opacity: k.freigeschaltet === false ? 0.5 : 1,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.6rem', color: C.textMuted, fontFamily: MONO, letterSpacing: '2px', marginBottom: 3 }}>
                {k.thema ?? 'Grundlagen'} · {k.dauer_min ?? '?'} Min · {k.punkte ?? 0} Pkt
                {k.abgeschlossen ? ' · ✓ Abgeschlossen' : ''}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.text }}>{k.titel}</div>
              {k.untertitel && (
                <div style={{ fontSize: '0.72rem', color: C.textMuted, marginTop: 2 }}>{k.untertitel}</div>
              )}
            </div>
            {(k.freigeschaltet !== false) && !k.abgeschlossen && (
              <button
                onClick={() => onSelect(k.kurs_id)}
                style={{ fontSize: '0.7rem', padding: '4px 10px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: MONO, flexShrink: 0, marginLeft: 8 }}
              >
                Starten →
              </button>
            )}
            {k.abgeschlossen && (
              <button
                onClick={() => onSelect(k.kurs_id)}
                style={{ fontSize: '0.7rem', padding: '4px 10px', background: 'transparent', color: C.green, border: `1px solid ${C.green}`, borderRadius: 6, cursor: 'pointer', fontFamily: MONO, flexShrink: 0, marginLeft: 8 }}
              >
                Wiederholen
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SchoolOverlay({ locationSlug, colonyContext, onClose, onKnowledgeEarned }: SchoolOverlayProps) {
  const [tab, setTab]               = useState<'akademie' | 'kurse' | 'module' | 'ssf' | 'handbuch'>('akademie')
  const [completedModules, setCompleted] = useState<string[]>([])
  const [moduleLoading, setModuleLoading] = useState(false)
  const [activeKursId, setActiveKursId] = useState<string | null>(null)
  const [ssfModules, setSsfModules] = useState<SsfModule[]>([])
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bg = ACADEMY_BG[locationSlug]

  useEffect(() => {
    loadKnowledge()
    generateTask()
    loadCompletedModules()
    fetch('/api/ssf/modules').then(r => r.json()).then((d: unknown) => {
      const list = Array.isArray(d) ? d : ((d as Record<string,unknown>).modules ?? [])
      setSsfModules(list as SsfModule[])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (task?.kind === 'calc' && !loading && result === null)
      setTimeout(() => inputRef.current?.focus(), 80)
  }, [task, loading, result])

  async function jwt() {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const { data: { session } } = await createClient().auth.getSession()
      return session?.access_token ?? ''
    } catch { return '' }
  }

  async function loadCompletedModules() {
    try {
      const token = await jwt()
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      const { data } = await sb.from('academy_completions')
        .select('module_id').eq('profile_id', (await sb.auth.getUser()).data.user?.id ?? '')
      setCompleted((data ?? []).map((r: any) => r.module_id))
    } catch {}
  }

  async function loadKnowledge() {
    try {
      const token = await jwt()
      const data = await (await fetch('/api/game/knowledge', { headers: { Authorization: `Bearer ${token}` } })).json() as Record<string,unknown>
      setTotal((data.knowledge_points as number) ?? 0)
    } catch {}
  }

  async function generateTask() {
    setLoading(true); setResult(null); setAnswer(''); setSelected(null)
    try {
      const res = await fetch('/api/game/school', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 1, colonyContext }) })
      const data = await res.json() as Record<string,unknown>
      setTask((data.task as Task) ?? fallbackTask())
    } catch { setTask(fallbackTask()) }
    setLoading(false)
  }

  async function completeModule(moduleId: string) {
    setModuleLoading(true)
    try {
      const token = await jwt()
      const data = await (await fetch(
        `/api/game/knowledge?action=complete_module&module_id=${encodeURIComponent(moduleId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )).json() as Record<string, unknown>
      if (data.ok && !data.already_completed) {
        setCompleted(prev => [...prev, moduleId])
        if (data.knowledge_points != null) {
          setTotal(data.knowledge_points as number)
          onKnowledgeEarned((data.points_awarded as number) ?? 50, data.knowledge_points as number)
        }
      }
    } catch {}
    setModuleLoading(false)
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
        const data = await (await fetch(`/api/game/knowledge?action=award&points=${task.points}&reason=school_task&location=${locationSlug}`, { headers: { Authorization: `Bearer ${token}` } })).json() as Record<string,unknown>
        if (data.knowledge_points != null) {
          setTotal(data.knowledge_points as number)
          onKnowledgeEarned(task.points, data.knowledge_points as number)
        }
      } catch {}
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
      {bg && <img src={bg.src} alt={bg.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,18,28,0.52)' }} />
      <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', zIndex: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: C.textMuted }}>✕</button>
      {bg && <div style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', zIndex: 10, fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'rgba(248,245,238,0.85)', fontFamily: MONO }}>{bg.label}</div>}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: C.bg, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

        {/* LINKE SEITE — 40% Aufgaben */}
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ padding: '0.9rem 1.5rem 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end' }}>
              {(['akademie', 'kurse', 'module', 'ssf', 'handbuch'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '0.5rem 1.25rem', border: `1px solid ${tab === t ? C.border : 'transparent'}`, borderBottom: tab === t ? `1px solid ${C.bg}` : `1px solid ${C.border}`, borderRadius: '6px 6px 0 0', cursor: 'pointer', fontFamily: MONO, fontSize: '0.78rem', fontWeight: 700, background: tab === t ? C.bg : C.bgAlt, color: tab === t ? C.accent : C.textMuted }}>
                  {t === 'akademie' ? 'Aufgaben' : t === 'kurse' ? 'Kurse' : t === 'module' ? 'Module' : t === 'ssf' ? 'SSF' : 'Handbuch'}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', paddingBottom: '0.5rem' }}>
                {total !== null && <span style={{ fontSize: '0.72rem', padding: '2px 10px', borderRadius: 20, background: C.goldLight, color: C.gold, fontWeight: 700, fontFamily: MONO }}>{total} Pkt.</span>}
              </div>
            </div>
          </div>

          {tab === 'kurse' && (
            <div style={{ flex: 1, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const }}>
              {activeKursId ? (
                <KursRenderer
                  kursId={activeKursId}
                  onComplete={(punkte) => {
                    setActiveKursId(null)
                    onKnowledgeEarned(punkte, total ?? 0)
                    loadKnowledge()
                  }}
                  onClose={() => setActiveKursId(null)}
                />
              ) : (
                <KursListe onSelect={setActiveKursId} jwt={jwt} />
              )}
            </div>
          )}
          {tab === 'handbuch' && <ManualTab onClose={onClose} />}
          {tab === 'ssf' && <SsfTab />}
          {tab === 'module' && (
            <div style={{ flex: 1, overflowY: 'auto' as const, padding: '1rem 1.25rem 1.25rem' }}>
              <div style={{ fontSize: '0.65rem', color: C.textMuted, lineHeight: 1.7, marginBottom: '1rem' }}>
                Module sind kurze Lerneinheiten (2–4 Min). Jedes Modul schaltet eine Fähigkeit in NOXIA frei.
              </div>
              <div style={{ background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '1rem', color: C.textMuted, fontSize: '0.8rem', lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700, color: C.accent, marginBottom: '0.5rem', fontFamily: MONO }}>
                  Module werden über die Solar Science Foundation bereitgestellt
                </div>
                <p style={{ margin: 0 }}>
                  Wirtschaftsmodule (Kredit, Zinseszins, Bodenwert) sind als KB-REQUEST-0003 bei der SSF beantragt.
                  Sobald sie verfügbar sind, erscheinen sie hier automatisch.
                </p>
                <a href="https://solarsciencefoundation.vercel.app" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: '0.75rem', color: C.gold, fontWeight: 700, textDecoration: 'none', fontSize: '0.78rem' }}>
                  SSF öffnen →
                </a>
              </div>
            </div>
          )}
          {tab === 'akademie' && (
            <div style={{ flex: 1, overflowY: 'auto' as const, padding: '1rem 1.25rem 1.25rem' }}>
              {loading && <div style={{ textAlign: 'center' as const, padding: '2.5rem', color: C.textMuted, fontFamily: MONO }}>Aufgabe wird generiert …</div>}
              {!loading && task && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: 20, background: '#e8eef6', color: C.accent, fontWeight: 700, fontFamily: MONO }}>{task.topic}</span>
                    <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: 20, background: C.bgAlt, color: C.textMuted, fontFamily: MONO }}>{task.kind === 'quiz' ? 'Wissensfrage' : 'Rechenaufgabe'}</span>
                  </div>
                  <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accent}`, borderRadius: '0 8px 8px 0', padding: '1rem 1.25rem', marginBottom: '1rem', fontSize: '0.95rem', lineHeight: 1.7 }}>{task.question}</div>
                  {result === null && task.kind === 'calc' && (
                    <>
                      <input ref={inputRef} type="number" placeholder="Deine Antwort …" value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} style={{ width: '100%', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '1rem', fontFamily: MONO, boxSizing: 'border-box' as const }} />
                      <button onClick={() => check()} disabled={!answer.trim()} style={{ width: '100%', marginTop: 12, padding: '0.7rem', background: answer.trim() ? C.accent : C.border, color: answer.trim() ? '#fff' : C.textFaint, border: 'none', borderRadius: 8, fontWeight: 700, cursor: answer.trim() ? 'pointer' : 'not-allowed', fontFamily: MONO }}>Prüfen →</button>
                    </>
                  )}
                  {result === null && task.kind === 'quiz' && (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                      {task.options.map((o, i) => (
                        <button key={i} onClick={() => check(i)} style={{ padding: '0.75rem 1rem', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 8, color: C.text, textAlign: 'left' as const, cursor: 'pointer', fontFamily: MONO }}>
                          <strong style={{ color: C.textFaint, marginRight: 10 }}>{['A','B','C','D'][i]}</strong>{o}
                        </button>
                      ))}
                    </div>
                  )}
                  {result === 'correct' && <div style={{ background: C.greenLight, border: '1px solid #a0dcb8', borderRadius: 8, padding: '0.85rem 1.1rem' }}><div style={{ color: C.green, fontWeight: 700, marginBottom: 6, fontFamily: MONO }}>Richtig! +{task.points} Punkte</div><div style={{ lineHeight: 1.65 }}>{task.explanation}</div></div>}
                  {result === 'wrong' && <div style={{ background: C.redLight, border: '1px solid #f0a0a0', borderRadius: 8, padding: '0.85rem 1.1rem' }}><div style={{ color: C.red, fontWeight: 700, marginBottom: 6, fontFamily: MONO }}>Nicht ganz.</div><div style={{ lineHeight: 1.65 }}>{task.explanation}</div></div>}
                  {result !== null && <button onClick={generateTask} style={{ width: '100%', marginTop: 12, padding: '0.68rem', background: '#fff', border: `1.5px solid ${C.accent}`, color: C.accent, borderRadius: 8, fontFamily: MONO, fontWeight: 700, cursor: 'pointer' }}>Nächste Aufgabe →</button>}
                  <div style={{ fontSize: '0.65rem', color: C.textFaint, textAlign: 'center' as const, marginTop: 10, fontFamily: MONO }}>{task.points} Punkte</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* RECHTE SEITE — 60% SSF-Lernmaterial */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf7f0', overflow: 'hidden' }}>
          {tab === 'ssf'
            ? <SsfTab />
            : <RightPanel topic={task?.topic ?? null} kind={task?.kind ?? null} modules={ssfModules} />
          }
        </div>

      </div>
    </div>
  )
}
