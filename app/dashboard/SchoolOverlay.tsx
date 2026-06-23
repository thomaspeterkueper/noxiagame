// app/dashboard/SchoolOverlay.tsx
// Erstellt:     15.06.2026
// Aktualisiert: 22.06.2026 — Fehlende Interfaces (ColonyContext, ContextBanner, SchoolOverlayProps) wiederhergestellt
// Version:      4.0.1
'use client'
import KursRenderer from './KursRenderer'

import React, { useState, useEffect, useRef } from 'react'
// react-pdf ersetzt durch nativen iframe (kein package-install nötig)

// Mapping: Aufgaben-Topic → Kurs-PDF in Supabase Storage
// URL-Schema: /api/game/akademie?kurs=XX  (leitet zu Supabase Storage URL weiter, kein CORS-Problem)
// Fallback auf direkte Storage-URL bis Route existiert


interface ColonyContext {
  locationName: string
  population:   number
  waterStock:   number
  waterCons:    number
  credits:      number
}

interface ContextBanner {
  folie: number
  text:  string
  color: string
}

interface SchoolOverlayProps {
  locationSlug:      string
  colonyContext:     ColonyContext
  onClose:           () => void
  onKnowledgeEarned: (pts: number, newTotal: number) => void
}

// ── Konstanten ───────────────────────────────────────────────────────────────

const MONO = "'Courier Prime', monospace"

const C = {
  bg:          'rgba(248,245,238,0.93)',
  bgAlt:       'rgba(242,237,228,0.95)',
  border:      '#ddd6c8',
  text:        '#1a1a18',
  textMuted:   '#6b6357',
  textFaint:   '#9e9485',
  accent:      '#2a4e7a',
  accentLight: '#e8eef6',
  gold:        '#8a6a00',
  goldLight:   '#faf3e0',
  green:       '#1a7a4a',
  greenLight:  '#e8f7ef',
  red:         '#b52a2a',
  redLight:    '#faeaea',
  orange:      '#b54a00',
  orangeLight: '#faeee8',
  white:       '#ffffff',
}

const TOPIC_COLOR: Record<string, string> = {
  'Ressourcen':   '#1a6fa8',
  'Handel':       '#8a6a00',
  'Navigation':   '#1a7a4a',
  'Bevölkerung':  '#6a3ab0',
  'Energie':      '#9a7000',
  'Sonnensystem': '#b54a00',
  'Physik':       '#0a7090',
}

const TOPIC_BG: Record<string, string> = {
  'Ressourcen':   '#e8f2fa',
  'Handel':       '#faf3e0',
  'Navigation':   '#e8f7ef',
  'Bevölkerung':  '#f3eefa',
  'Energie':      '#faf6e0',
  'Sonnensystem': '#faeee8',
  'Physik':       '#e8f5fa',
}

const ACADEMY_BG: Record<string, { src: string; label: string }> = {
  earth:       { src: '/images/building-backgrounds/school-back-earth.png',       label: 'Erde · Universität' },
  mars:        { src: '/images/building-backgrounds/school-back-mars.png',        label: 'Mars · Tharsis Hub' },
  prometheus:  { src: '/images/building-backgrounds/school-back-prometheus.png',  label: 'Prometheus Station · L5' },
  ship:        { src: '/images/building-backgrounds/school-back-ship.png',        label: 'Raumschiff · Unterwegs' },
}

const MANUAL_SECTIONS = [
  { id: 'ziel',     title: 'Dein Ziel',         content: 'Du bist Pilot und Händler im Sonnensystem des Jahres 2100. Kolonien auf Mond, Mars und Phobos brauchen Wasser, Energie und Metall — und du lieferst sie.' },
  { id: 'handel',   title: 'Handel & Auktion',   content: 'Jeder Kauf und Verkauf läuft als Live-Auktion. Beim Kauf: du bietest gegen NPC-Händler. Beim Verkauf: du bist der Verkäufer, NPC-Käufer steigen von unten auf.' },
  { id: 'fliegen',  title: 'Fliegen & Energie',  content: 'Jeder Flug kostet Energie aus deinem Laderaum. Asymmetrisch: Erde→Mond kostet 20t (Erdgravitation), Mond→Erde nur 8t.' },
  { id: 'bauen',    title: 'Bauen & Gebäude',    content: 'Klicke auf eine freie Kachel im Koloniegrid um zu bauen. Mine (+5 Metall/Tick) · Solarfeld (+4 Energie/Tick) · Habitat (+100 max. Bevölkerung)' },
  { id: 'schiffe',  title: 'Schiffe & Werft',    content: 'Du startest mit dem Frachter Mk.I (100t). Auf der Werft (Mond) kannst du aufrüsten: Schnellfrachter (60t, 1.7×) oder Schwerfrachter (200t, 0.77×).' },
  { id: 'bev',      title: 'Bevölkerung',        content: 'Jede Kolonie braucht Wasser, Energie und Metall pro 100 Einwohner/Tick. Fällt der Stock auf null, schrumpft die Bevölkerung.' },
  { id: 'preise',   title: 'Preise & Arbitrage', content: 'Klassische Route: Wasser auf Mond kaufen (günstig) → Mars verkaufen (teuer). Der Preis-Ticker läuft einmal täglich.' },
]

// Task-Typen
interface CalcTask {
  kind: 'calc'; question: string; answer: number; explanation: string; points: number; topic: string
}
interface QuizTask {
  kind: 'quiz'; question: string; options: string[]; correct: number; explanation: string; points: number; topic: string
}
type Task = CalcTask | QuizTask

function buildContextBanners(topic: string | null, colonyContext: ColonyContext): ContextBanner[] {
  if (!topic || !colonyContext) return []
  const credits = colonyContext.credits ?? 0
  const banners: ContextBanner[] = []

  if (topic === 'Handel' || topic === 'Ressourcen') {
    // Folie 2 (Warum wichtig): Live-Koloniekontext
    banners.push({
      folie: 2,
      text: `${colonyContext.locationName}: Wasser-Lager ${colonyContext.waterStock}t · Verbrauch ${colonyContext.waterCons}t/Tick`,
      color: '#1a6fa8',
    })
  }

  if (topic === 'Energie' || topic === 'Physik' || topic === 'Navigation') {
    banners.push({
      folie: 4,
      text: `Dein Kapital: ${credits.toLocaleString('de')} Cr · Solarfeld-Ertrag bei aktuellem Energiepreis in 20 Ticks: ${Math.round(credits * 0.08).toLocaleString('de')} Cr`,
      color: '#1a7a4a',
    })
  }

  if (topic === 'Bevölkerung') {
    const proj5 = Math.round(credits * Math.pow(1.08, 5))
    banners.push({
      folie: 4,
      text: `Dein Kapital ${credits.toLocaleString('de')} Cr bei 8% p.a. → nach 5 Jahren: ${proj5.toLocaleString('de')} Cr`,
      color: '#8a6a00',
    })
    banners.push({
      folie: 5,
      text: `Kolonie ${colonyContext.locationName}: ${colonyContext.population} Einwohner · max. Wachstum mit Habitat: ${colonyContext.population + 100}`,
      color: '#6a3ab0',
    })
  }

  return banners
}

// KursRenderer ist ausgelagert in KursRenderer.tsx
// Hier nur ein Wrapper der topic → kurs_id mappt

const TOPIC_TO_KURS: Record<string, string> = {
  'Handel':       'kurs_05_angebot_nachfrage',
  'Ressourcen':   'kurs_05_angebot_nachfrage',
  'Energie':      'kurs_03_energie_arbeit',
  'Physik':       'kurs_04_kraefte_bewegung',
  'Navigation':   'kurs_04_kraefte_bewegung',
  'Bevölkerung':  'kurs_01_prozentrechnung',
  'Sonnensystem': 'kurs_04_kraefte_bewegung',
  'Geschichte':   'kurs_04_kraefte_bewegung',
}

function KursPanel({ topic, colonyContext, onKnowledgeEarned }: {
  topic: string | null
  colonyContext: any
  onKnowledgeEarned: (pts: number, total: number) => void
}) {
  const kursId = topic ? TOPIC_TO_KURS[topic] : null

  if (!kursId) return <ContextPanel topic={topic} colonyContext={colonyContext} />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' as const }}>
      <KursRenderer
        kursId={kursId}
        onComplete={(punkte) => {
          onKnowledgeEarned(punkte, punkte)
        }}
        onClose={() => {}} // kein Close nötig — Panel bleibt offen
      />
    </div>
  )
}

function ManualTab({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = React.useState<string | null>('ziel')
  return (
    <div style={{ padding: '1.5rem', overflowY: 'auto' as const, flex: 1 }}>
      <div style={{ fontSize: '0.72rem', color: C.textFaint, marginBottom: '1rem', fontFamily: MONO }}>Tippe auf einen Abschnitt.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {MANUAL_SECTIONS.map(s => (
          <div key={s.id} style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(open === s.id ? null : s.id)}
              style={{ width: '100%', textAlign: 'left', background: open === s.id ? C.accentLight : C.bgAlt, border: 'none', padding: '0.65rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: open === s.id ? C.accent : C.text, fontFamily: MONO, fontSize: '0.82rem', fontWeight: 700 }}>
              {s.title}
              <span style={{ color: C.textFaint, fontSize: '0.65rem', fontWeight: 400 }}>{open === s.id ? '▲' : '▼'}</span>
            </button>
            {open === s.id && (
              <div style={{ padding: '0.8rem 1rem', background: '#fff', fontSize: '0.82rem', lineHeight: 1.75, color: C.text, whiteSpace: 'pre-line' as const, borderTop: `1px solid ${C.border}` }}>
                {s.content}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
        <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, padding: '0.5rem 1.5rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: MONO }}>Schließen</button>
      </div>
    </div>
  )
}


function OrbitCalculator() {
  const ENERGY: Record<string, Record<string, number>> = {
    earth:  { moon: 20, mars: 35, phobos: 38 },
    moon:   { earth: 8, mars: 12, phobos: 10 },
    mars:   { earth: 30, moon: 12, phobos: 4 },
    phobos: { earth: 32, moon: 10, mars: 6 },
  }
  const NAMES: Record<string, string> = { earth: '🌍 Erde', moon: '🌙 Mond', mars: '🔴 Mars', phobos: '🪨 Phobos' }
  const [from, setFrom] = React.useState('earth')
  const [to,   setTo]   = React.useState('moon')
  const energy = ENERGY[from]?.[to] ?? '?'
  return (
    <div style={{ background: '#f8f5ee', border: '1px solid #e0d8c8', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <select value={from} onChange={e => setFrom(e.target.value)} style={{ flex: 1, background: '#fff', border: '1px solid #d4c9b0', borderRadius: '6px', padding: '0.3rem', fontSize: '0.75rem', outline: 'none' }}>
          {Object.entries(NAMES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ color: '#8a8a8a' }}>→</span>
        <select value={to} onChange={e => setTo(e.target.value)} style={{ flex: 1, background: '#fff', border: '1px solid #d4c9b0', borderRadius: '6px', padding: '0.3rem', fontSize: '0.75rem', outline: 'none' }}>
          {Object.entries(NAMES).filter(([k]) => k !== from).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div style={{ padding: '0.5rem', background: '#fff', borderRadius: '6px', textAlign: 'center' as const, fontWeight: 700, color: '#2a4e7a', fontSize: '0.85rem' }}>
        ⚡ {energy}t Energie
      </div>
    </div>
  )
}

function ContextPanel({ topic, colonyContext }: { topic: string | null, colonyContext: any }) {
  if (!topic) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#b0b0a0', fontSize: '0.8rem', textAlign: 'center' as const, padding: '2rem' }}>
      <div><div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.3 }}>📖</div>Lernmaterial erscheint<br/>passend zur Aufgabe</div>
    </div>
  )

  const SECTION_STYLE = { background: '#f8f5ee', border: '1px solid #e0d8c8', borderRadius: '8px', padding: '0.75rem', fontSize: '0.7rem', color: '#4a4a3a', lineHeight: 1.7 }
  const HEAD_STYLE = { fontSize: '0.7rem', fontWeight: 700 as const, marginBottom: '0.5rem', color: '#3a3a2a' }
  const C_TOPIC: Record<string, string> = { 'Ressourcen': '#1a6fa8', 'Handel': '#8a6a00', 'Navigation': '#1a7a4a', 'Bevölkerung': '#6a3ab0', 'Energie': '#9a7000', 'Sonnensystem': '#c05a00', 'Physik': '#2a7a8a', 'Geschichte': '#6a4a20' }
  const color = C_TOPIC[topic] ?? '#5a7a9a'

  return (
    <div style={{ padding: '1.25rem', overflowY: 'auto' as const, height: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 700, color, letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '1rem', fontFamily: 'monospace' }}>
        📚 {topic}
      </div>

      {(topic === 'Handel') && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={HEAD_STYLE}>Handelsmarge-Rechner</div>
          <TradeSimulator />
          <p style={{ fontSize: '0.68rem', color: '#6a6a5a', marginTop: '0.6rem', lineHeight: 1.6 }}>
            <strong>Arbitrage:</strong> Kaufe günstig, verkaufe teuer. Preisimpulse (0,3%/t) erschöpfen Routen kausal.
          </p>
        </div>
      )}

      {topic === 'Navigation' && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={HEAD_STYLE}>Orbit-Rechner</div>
          <OrbitCalculator />
          <p style={{ fontSize: '0.68rem', color: '#6a6a5a', marginTop: '0.6rem', lineHeight: 1.6 }}>
            <strong>Asymmetrie:</strong> Erde→Mond 20t (Schwerkraft), Mond→Erde nur 8t. Tiefere Gravitationsbrunnen = mehr Treibstoff.
          </p>
        </div>
      )}

      {topic === 'Energie' && (
        <div style={SECTION_STYLE}>
          <div style={HEAD_STYLE}>⚡ Energieflüsse</div>
          <div>Solarfeld: <strong>+4/Tick</strong></div>
          <div>Erde→Mond: <strong>−20t</strong> · Mond→Mars: <strong>−12t</strong></div>
          <div>Mars→Phobos: <strong>−4t</strong></div>
          <div style={{ marginTop: '0.5rem', color: '#7a7a6a' }}>Energie ist Treibstoff UND Handelsware.</div>
        </div>
      )}

      {topic === 'Ressourcen' && (
        <div style={SECTION_STYLE}>
          <div style={HEAD_STYLE}>📦 Ressourcen-Profil</div>
          <div>💧 Wasser: <strong>Kritisch Mars</strong> (deficit ~7/Tick)</div>
          <div>⚡ Energie: <strong>Ausgeglichen</strong> Mond</div>
          <div>⛏️ Metall: <strong>Überschuss</strong> Mond (+12 base)</div>
          <div>🪨 Phobos: <strong>alles importiert</strong></div>
        </div>
      )}

      {topic === 'Bevölkerung' && (
        <div style={SECTION_STYLE}>
          <div style={HEAD_STYLE}>👥 Wachstums-Formel</div>
          <div>✅ Versorgt: <strong>+1%/Tick</strong></div>
          <div>❌ Unterversorgt: <strong>−2%/Tick</strong></div>
          <div>🏠 Habitat: <strong>+100 Kapazität</strong></div>
          <div style={{ marginTop: '0.4rem' }}>Aktuell: <strong>{Math.ceil((colonyContext?.population ?? 1000)/100)}t Wasser/Tick</strong></div>
        </div>
      )}

      {topic === 'Sonnensystem' && (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
          {[['🌍','Erde','Startpunkt, Werft, günstige Ressourcen'],['🌙','Mond','Metall-Produzent, Eisvorkommen'],['🔴','Mars','Größte Kolonie, Wasser-Defizit'],['🪨','Phobos','Freihafen, reiner Konsument']].map(([icon,name,desc]) => (
            <div key={name} style={{ ...SECTION_STYLE, padding: '0.5rem 0.75rem' }}>
              <div style={{ fontWeight: 700 }}>{icon} {name}</div>
              <div style={{ color: '#7a7a6a', fontSize: '0.65rem' }}>{desc}</div>
            </div>
          ))}
        </div>
      )}

      {(topic === 'Physik' || topic === 'Geschichte') && (
        <div style={SECTION_STYLE}>
          <div style={HEAD_STYLE}>{topic === 'Physik' ? '🔭 Physik' : '🚀 Geschichte'}</div>
          {topic === 'Physik'
            ? 'Escape Velocity Erde: 11,2 km/s · Mond: 2,4 km/s. Tieferer Gravitationsbrunnnen = mehr Treibstoff für den Aufstieg.'
            : 'Sputnik 1957 · Apollo 1969 · ISS 1998 · SpaceX 2020. Jede Epoche baute auf der vorherigen auf.'}
        </div>
      )}

      <div style={{ marginTop: '1rem', padding: '0.5rem 0.75rem', background: '#f0ece3', border: '1px dashed #c8b890', borderRadius: '6px', fontSize: '0.6rem', color: '#9a8a6a', fontFamily: 'monospace' }}>
        📋 Foundation-Dokument folgt · Solar Academy 0.3
      </div>
    </div>
  )
}

function extractYouTubeId(input: string): string {
  const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : input.trim()
}

function TradeSimulator() {
  const [buyPrice,  setBuy]  = React.useState(95)
  const [sellPrice, setSell] = React.useState(155)
  const [amount,    setAmt]  = React.useState(80)
  const profit = (sellPrice - buyPrice) * amount
  const margin = buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice * 100).toFixed(1) : '0'
  const inp = (val: number, set: (v: number) => void, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
      <span style={{ fontSize: '0.7rem', color: '#8a8a8a', minWidth: 90 }}>{label}</span>
      <input type="number" value={val} onChange={e => set(+e.target.value)}
        style={{ width: 80, background: '#fff', border: '1px solid #d4c9b0', borderRadius: '4px', padding: '3px 6px', fontSize: '0.8rem', fontFamily: 'monospace', outline: 'none' }} />
    </div>
  )
  return (
    <div style={{ background: '#f0ece3', border: '1px solid #d4c9b0', borderRadius: '8px', padding: '0.75rem' }}>
      {inp(buyPrice, setBuy, 'Kaufpreis')}
      {inp(sellPrice, setSell, 'Verkaufspreis')}
      {inp(amount, setAmt, 'Menge (t)')}
      <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: profit >= 0 ? '#e8f5e9' : '#fce4e4', borderRadius: '6px', border: `1px solid ${profit >= 0 ? '#6fcf97' : '#e74c3c'}` }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: profit >= 0 ? '#2e7d32' : '#c62828' }}>
          {profit >= 0 ? '📈' : '📉'} {profit.toLocaleString('de')} Cr Gewinn
        </div>
        <div style={{ fontSize: '0.65rem', color: '#8a8a8a', marginTop: '2px' }}>Marge: {margin}% · {amount}t × {(sellPrice - buyPrice)} Cr/t</div>
      </div>
    </div>
  )
}

export default function SchoolOverlay({
  locationSlug, colonyContext, onClose, onKnowledgeEarned
}: SchoolOverlayProps) {
  const [task, setTask]            = useState<Task | null>(null)
  const [loading, setLoading]      = useState(false)
  const [userAnswer, setAnswer]    = useState('')
  const [selectedOption, setOpt]   = useState<number | null>(null)
  const [result, setResult]        = useState<'correct' | 'wrong' | null>(null)
  const [totalKnowledge, setTotal] = useState<number | null>(null)
  const [streak, setStreak]        = useState(0)
  const [earned, setEarned]        = useState<number | null>(null)
  const inputRef                   = useRef<HTMLInputElement>(null)
  const [calcVal, setCalcVal]      = useState('')
  const [showCalc, setShowCalc]    = useState(false)
  const [tab, setTab]              = useState<'akademie' | 'handbuch'>('akademie')
  const [videoUrl, setVideoUrl]    = useState('')
  const [videoInput, setVideoInput] = useState('')
  const [levelInfo, setLevel]      = useState<any>(null)
  const [dailyInfo, setDaily]      = useState<any>(null)
  const [showDaily, setShowDaily]  = useState(false)

  useEffect(() => { loadKnowledge(); generateTask() }, [])
  useEffect(() => {
    if (!loading && task && result === null && task.kind === 'calc')
      setTimeout(() => inputRef.current?.focus(), 100)
  }, [loading, task, result])

  async function getJwt(): Promise<string> {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const { data: { session } } = await createClient().auth.getSession()
      return session?.access_token ?? ''
    } catch { return '' }
  }

  async function loadKnowledge() {
    try {
      const jwt = await getJwt()
      const r = await fetch('/api/game/knowledge', {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      const d = await r.json()
      setTotal(d.knowledge_points ?? 0)
      if (d.level) setLevel(d.level)
      if (d.daily) setDaily(d.daily)
    } catch {}
  }

  async function generateTask() {
    setLoading(true); setResult(null); setAnswer(''); setOpt(null); setEarned(null); setTask(null)
    try {
      const currentLevel = levelInfo?.level ?? 1
      const seed = Math.random().toString(36).slice(2, 8)
      const response = await fetch('/api/game/school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: currentLevel, isDaily: showDaily, seed, colonyContext }),
      })
      const data = await response.json()
      if (!data.task) throw new Error(data.error ?? `HTTP ${response.status}`)
      setTask(data.task)
    } catch (e: any) {
      console.error('School task error:', e?.message ?? e)
      const fallbacks: Task[] = [
        { kind: 'calc', question: 'Ein Frachter kauft 80 Tonnen Wasser für 95 Cr/t und verkauft sie für 155 Cr/t. Wie viel Gewinn macht er insgesamt?', answer: 4800, explanation: '80 x (155 - 95) = 80 x 60 = 4.800 Cr', points: 15, topic: 'Handel' },
        { kind: 'quiz', question: 'Warum kostet der Flug von der Erde zum Mond mehr Energie als der Rückweg?', options: ['Der Mond ist weiter entfernt', 'Man muss das Erdgravitationsfeld überwinden', 'Das Schiff ist schwerer beim Hinflug', 'Der Mond hat eine stärkere Anziehungskraft'], correct: 1, explanation: 'Die Erde hat eine viel stärkere Schwerkraft (9.8 m/s²) — für den Aufstieg braucht man mehr Energie als für die Landung.', points: 20, topic: 'Physik' },
        { kind: 'calc', question: 'Eine Kolonie mit 500 Einwohnern verbraucht 1 Tonne Wasser pro 100 Einwohner pro Stunde. Wie viel Wasser braucht sie in 24 Stunden?', answer: 120, explanation: '500 / 100 x 1 x 24 = 120 Tonnen', points: 15, topic: 'Ressourcen' },
        { kind: 'quiz', question: 'Welche Station im Sonnensystem ist ein reiner Konsument — sie produziert kaum eigene Ressourcen?', options: ['Mond', 'Mars', 'Phobos', 'Erde'], correct: 2, explanation: 'Phobos ist ein kleiner Mond ohne nennenswerte Eigenproduktion — vollständig abhängig von Lieferungen.', points: 20, topic: 'Sonnensystem' },
      ]
      setTask(fallbacks[Math.floor(Math.random() * fallbacks.length)])
    }
    setLoading(false)
  }

  async function checkAnswer(optIdx?: number) {
    if (!task || result !== null) return
    let correct = false
    if (task.kind === 'calc') {
      if (userAnswer.trim() === '') return
      correct = parseInt(userAnswer.trim(), 10) === task.answer
    } else {
      if (optIdx === undefined) return
      setOpt(optIdx)
      correct = optIdx === task.correct
    }
    setResult(correct ? 'correct' : 'wrong')
    if (correct) {
      const dailyMult = showDaily ? 2 : 1
      const bonus = streak >= 2 ? Math.floor(task.points * 1.5 * dailyMult) : Math.floor(task.points * dailyMult)
      setEarned(bonus); setStreak(s => s + 1)
      try {
        const dailyParam = showDaily ? '&daily=true' : ''
        const jwt = await getJwt()
        const r = await fetch(`/api/game/knowledge?action=award&points=${bonus}&reason=school_task&location=${locationSlug}${dailyParam}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        })
        const d = await r.json()
        if (d.knowledge_points != null) { setTotal(d.knowledge_points); onKnowledgeEarned(bonus, d.knowledge_points) }
        if (showDaily) { setDaily({ available: false, completed: true, pointsEarned: bonus }); setShowDaily(false) }
      } catch {}
    } else { setStreak(0) }
  }

  const bg   = ACADEMY_BG[locationSlug]
  const tc   = task ? (TOPIC_COLOR[task.topic] ?? C.accent) : C.accent
  const tcBg = task ? (TOPIC_BG[task.topic]    ?? C.accentLight) : C.accentLight

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', flexDirection: 'column' }}>

      {/* Hintergrundbild — volle Fläche */}
      {bg && (
        <img
          src={bg.src}
          alt={bg.label}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      )}

      {/* Abdunkelung */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,18,28,0.52)' }} />

      {/* Schließen-Button */}
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', zIndex: 10, background: 'rgba(248,245,238,0.92)', border: `1px solid ${C.border}`, borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1rem', color: C.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO }}>
        ✕
      </button>

      {/* Ortsbezeichnung */}
      {bg && (
        <div style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', zIndex: 10, fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'rgba(248,245,238,0.85)', fontFamily: MONO, textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
          {bg.label}
        </div>
      )}

      {/* Helles Panel — untere 58% */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: C.bg, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

        {/* Weicher Übergang oben */}
        <div style={{ position: 'absolute', top: '-40px', left: 0, right: 0, height: '40px', background: `linear-gradient(to bottom, transparent, ${C.bg})`, pointerEvents: 'none', zIndex: 1 }} />

        {/* LINKE SEITE — 40% Aufgaben */}
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, flexShrink: 0 }}>

        {/* Panel-Header mit Tabs */}
        <div style={{ padding: '0.9rem 1.5rem 0', background: C.bg, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '0', marginBottom: '-1px', alignItems: 'flex-end' }}>
            {(['akademie', 'handbuch'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{ padding: '0.5rem 1.25rem', border: `1px solid ${tab === t ? C.border : 'transparent'}`, borderBottom: tab === t ? `1px solid ${C.bg}` : `1px solid ${C.border}`, borderRadius: '6px 6px 0 0', cursor: 'pointer', fontFamily: MONO, fontSize: '0.78rem', fontWeight: 700, background: tab === t ? C.bg : C.bgAlt, color: tab === t ? C.accent : C.textMuted }}>
                {t === 'akademie' ? 'Akademie' : 'Handbuch'}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem' }}>
              {totalKnowledge !== null && (
                <span style={{ fontSize: '0.72rem', padding: '2px 10px', borderRadius: '20px', background: C.goldLight, color: C.gold, fontWeight: 700, fontFamily: MONO, border: '1px solid #e8d8a0' }}>
                  {totalKnowledge} Pkt.
                </span>
              )}
              {streak >= 2 && (
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: C.greenLight, color: C.green, fontFamily: MONO, border: '1px solid #a8dcc0' }}>
                  Serie x{streak}
                </span>
              )}
              {levelInfo && (
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: C.accentLight, color: C.accent, fontWeight: 700, fontFamily: MONO, border: '1px solid #b8cce8' }}>
                  {levelInfo.title}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Handbuch */}
        {tab === 'handbuch' && <ManualTab onClose={onClose} />}

        {/* Akademie */}
        {tab === 'akademie' && (
          <div style={{ flex: 1, overflowY: 'auto' as const, padding: '1rem 1.25rem 1.25rem' }}>

            {levelInfo && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: C.textMuted, marginBottom: '5px', fontFamily: MONO }}>
                  <span style={{ color: C.accent, fontWeight: 700 }}>{levelInfo.title}</span>
                  <span>{levelInfo.pointsToNext != null ? `${levelInfo.pointsToNext} Pkt. bis ${levelInfo.level < 6 ? ['','Händler','Navigator','Ingenieur','Wissenschaftler','Pionier'][levelInfo.level] : 'Max'}` : 'Maximalstufe erreicht'}</span>
                </div>
                <div style={{ height: '5px', background: C.border, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${levelInfo.progress}%`, background: C.accent, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            )}

            {dailyInfo?.available && !showDaily && (
              <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', background: C.orangeLight, border: '1px solid #e8b890', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: C.orange, fontWeight: 700, fontFamily: MONO }}>Tagesaufgabe verfügbar</div>
                  <div style={{ fontSize: '0.68rem', color: '#9a6040' }}>Doppelte Punkte · einmal pro Tag</div>
                </div>
                <button
                  onClick={() => { setShowDaily(true); generateTask() }}
                  style={{ background: C.orange, border: 'none', color: '#fff', borderRadius: '6px', padding: '5px 14px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: MONO }}>
                  Starten →
                </button>
              </div>
            )}
            {showDaily && (
              <div style={{ marginBottom: '0.75rem', padding: '4px 12px', background: C.orangeLight, border: '1px solid #e8b890', borderRadius: '6px', fontSize: '0.68rem', color: C.orange, fontFamily: MONO }}>
                Tagesaufgabe — 2x Punkte
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: C.textMuted, fontSize: '0.85rem', fontFamily: MONO }}>
                Aufgabe wird generiert …
              </div>
            )}

            {!loading && task && (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '20px', background: tcBg, color: tc, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontFamily: MONO, border: `1px solid ${tc}40` }}>
                    {task.topic}
                  </span>
                  <span style={{ fontSize: '0.65rem', padding: '3px 10px', borderRadius: '20px', background: C.bgAlt, color: C.textMuted, fontFamily: MONO, border: `1px solid ${C.border}` }}>
                    {task.kind === 'quiz' ? 'Wissensfrage' : 'Rechenaufgabe'}
                  </span>
                </div>

                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderLeft: `3px solid ${tc}`, borderRadius: '0 8px 8px 0', padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.92rem', lineHeight: 1.7, color: C.text }}>
                  {task.question}
                </div>

                {result === null && (
                  <>
                    {task.kind === 'calc' ? (
                      <>
                        <input
                          ref={inputRef}
                          type="number"
                          placeholder="Deine Antwort …"
                          value={userAnswer}
                          onChange={e => setAnswer(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                          style={{ width: '100%', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: '8px', padding: '0.65rem 0.9rem', color: C.text, fontSize: '1.05rem', fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }}
                        />
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            onClick={() => setShowCalc(c => !c)}
                            style={{ background: 'transparent', border: 'none', color: C.textFaint, fontSize: '0.7rem', cursor: 'pointer', padding: '2px 0', fontFamily: MONO }}>
                            {showCalc ? 'Taschenrechner ausblenden' : 'Taschenrechner'}
                          </button>
                          {showCalc && (
                            <div style={{ marginTop: '0.4rem', background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '0.65rem' }}>
                              <input
                                type="text"
                                placeholder="z.B. 80 * 60"
                                value={calcVal}
                                onChange={e => setCalcVal(e.target.value)}
                                style={{ width: '100%', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '0.4rem 0.6rem', color: C.text, fontSize: '0.85rem', fontFamily: MONO, outline: 'none', boxSizing: 'border-box' as const }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                                <span style={{ fontSize: '0.8rem', color: C.accent, fontWeight: 700, fontFamily: MONO }}>
                                  {(() => { try { const r = Math.round(Function('"use strict"; return (' + calcVal.replace(/[^0-9+\-*/().\s]/g, '') + ')')() * 100) / 100; return isFinite(r) ? '= ' + r.toLocaleString('de') : '' } catch { return '' } })()}
                                </span>
                                <button
                                  onClick={() => { try { const r = Math.round(Function('"use strict"; return (' + calcVal.replace(/[^0-9+\-*/().\s]/g, '') + ')')() * 100) / 100; if (isFinite(r)) setAnswer(String(Math.round(r))) } catch {} }}
                                  style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: '4px', padding: '3px 10px', fontSize: '0.7rem', cursor: 'pointer', fontFamily: MONO }}>
                                  Übernehmen
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => checkAnswer()}
                          disabled={!userAnswer.trim()}
                          style={{ width: '100%', marginTop: '0.85rem', padding: '0.7rem', background: userAnswer.trim() ? C.accent : C.border, color: userAnswer.trim() ? '#fff' : C.textFaint, border: 'none', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 700, cursor: userAnswer.trim() ? 'pointer' : 'not-allowed', fontFamily: MONO }}>
                          Prüfen →
                        </button>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {task.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => checkAnswer(i)}
                            style={{ padding: '0.75rem 1rem', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left' as const, fontFamily: MONO }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = C.accent)}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                            <span style={{ color: C.textFaint, marginRight: '0.75rem', fontWeight: 700 }}>{['A','B','C','D'][i]}</span>
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: '0.65rem', color: C.textFaint, textAlign: 'center', marginTop: '0.6rem', fontFamily: MONO }}>
                      {task.points} Punkte{streak >= 2 ? ` · Serie-Bonus: ${Math.floor(task.points * 1.5)}` : ''}
                    </div>
                  </>
                )}

                {result !== null && task.kind === 'quiz' && selectedOption !== null && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
                    {task.options.map((opt, i) => {
                      const isCorrect  = i === task.correct
                      const isSelected = i === selectedOption
                      const bg2  = isCorrect ? C.greenLight  : isSelected ? C.redLight   : C.bgAlt
                      const bord = isCorrect ? '#a0dcb8'     : isSelected ? '#f0a0a0'    : C.border
                      const col  = isCorrect ? C.green       : isSelected ? C.red        : C.textMuted
                      return (
                        <div key={i} style={{ padding: '0.65rem 1rem', background: bg2, border: `1.5px solid ${bord}`, borderRadius: '8px', fontSize: '0.85rem', color: col, fontFamily: MONO }}>
                          <span style={{ marginRight: '0.75rem', fontWeight: 700 }}>{isCorrect ? '✓' : isSelected ? '✗' : ['A','B','C','D'][i]}</span>
                          {opt}
                        </div>
                      )
                    })}
                  </div>
                )}

                {result === 'correct' && (
                  <div style={{ background: C.greenLight, border: '1px solid #a0dcb8', borderRadius: '8px', padding: '0.85rem 1.1rem' }}>
                    <div style={{ color: C.green, fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', fontFamily: MONO }}>
                      Richtig! {earned != null && <span style={{ color: C.gold }}>+{earned} Punkte</span>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: C.text, lineHeight: 1.65 }}>{task.explanation}</div>
                  </div>
                )}
                {result === 'wrong' && (
                  <div style={{ background: C.redLight, border: '1px solid #f0a0a0', borderRadius: '8px', padding: '0.85rem 1.1rem' }}>
                    <div style={{ color: C.red, fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', fontFamily: MONO }}>Nicht ganz.</div>
                    <div style={{ fontSize: '0.82rem', color: C.text, lineHeight: 1.65 }}>{task.explanation}</div>
                  </div>
                )}

                {result !== null && (
                  <button
                    onClick={generateTask}
                    style={{ width: '100%', marginTop: '1rem', padding: '0.68rem', background: '#fff', border: `1.5px solid ${C.accent}`, color: C.accent, borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', fontFamily: MONO, fontWeight: 700 }}>
                    Nächste Aufgabe →
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div style={{ padding: '0.5rem 1rem', borderTop: `1px solid ${C.border}`, fontSize: '0.6rem', color: C.textFaint, fontFamily: MONO, background: C.bgAlt, flexShrink: 0 }}>
          max. 10 Aufgaben/Stunde
        </div>

        </div>{/* end linke seite */}

        {/* RECHTE SEITE — 60% Kursmaterial mit PDF-Viewer */}
        <div style={{ flex: 1, overflow: 'hidden', background: '#faf7f0', borderLeft: `1px solid ${C.border}` }}>
          <KursPanel topic={task?.topic ?? null} colonyContext={colonyContext} onKnowledgeEarned={onKnowledgeEarned} />
        </div>

      </div>
    </div>
  )
}
