// app/dashboard/KursRenderer.tsx
// Erstellt:     23.06.2026
// Aktualisiert: 11.07.2026 — NOX-0008: kg_path_id im Kurs-Interface
// Version:      1.2.0
//
// Rendert Foundation-Kurse dynamisch aus DB-Daten.
// Folientypen: titel, text, tabelle, zwei_spalten, formel, animation, quiz, video
// Animationen: Platzhalter mit animation_id, werden in 0.3 implementiert.

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Folie {
  id:       string
  position: number
  typ:      string
  titel?:   string
  inhalt:   Record<string, any>
}

interface Kurs {
  id:                 string
  kurs_id:            string
  kg_path_id?:        string   // kanonische KG-Lernpfad-ID (PATH:SSF:*/PATH:NOXIA:*)
  titel:              string
  untertitel?:        string
  niveau:             number
  thema:              string
  thema_farbe:        string
  punkte:             number
  foundation_folien:  Folie[]
}

interface KursRendererProps {
  kursId:     string           // kurs_id (text slug)
  onComplete: (punkte: number) => void
  onClose:    () => void
}

// ── Farben ────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#ffffff',
  bgAlt:    '#f5f5f5',
  bgPanel:  '#eef4fb',
  text:     '#1a1a1a',
  textMid:  '#444444',
  textDim:  '#777777',
  border:   '#dddddd',
  blue:     '#1a4e8a',
  green:    '#1a7a4a',
  gold:     '#a07820',
  red:      '#c0392b',
  orange:   '#b05000',
}

// ── Folientypen ───────────────────────────────────────────────────────────────

function FolieText({ folie, accent }: { folie: Folie; accent: string }) {
  const lines: string[] = folie.inhalt.lines ?? []
  return (
    <div style={{ padding: '1.5rem' }}>
      {lines.map((line, i) => {
        if (line === '') return <div key={i} style={{ height: '0.5rem' }} />
        if (line.startsWith('##')) return (
          <div key={i} style={{ fontWeight: 700, fontSize: '1rem', color: accent, marginTop: '0.75rem', marginBottom: '0.25rem' }}>
            {line.slice(2).trim()}
          </div>
        )
        if (line.startsWith('!')) return (
          <div key={i} style={{ fontWeight: 700, color: C.green, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
            {line.slice(1).trim()}
          </div>
        )
        if (line.startsWith('?')) return (
          <div key={i} style={{ fontWeight: 700, color: C.red, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
            {line.slice(1).trim()}
          </div>
        )
        return (
          <div key={i} style={{ fontSize: '0.95rem', color: C.textMid, lineHeight: 1.6, marginBottom: '0.15rem' }}>
            {line}
          </div>
        )
      })}
    </div>
  )
}

function FolieTabelle({ folie, accent }: { folie: Folie; accent: string }) {
  const headers: string[] = folie.inhalt.headers ?? []
  const rows: string[][] = folie.inhalt.rows ?? []
  const hlCol: number = folie.inhalt.highlight_col ?? -1
  return (
    <div style={{ padding: '1.5rem', overflowX: 'auto' as const }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.9rem' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ background: accent, color: '#fff', padding: '0.5rem 0.75rem', textAlign: 'left' as const, fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? C.bgAlt : C.bg }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '0.4rem 0.75rem', color: ci === hlCol ? C.red : C.text, fontWeight: ci === hlCol ? 700 : 400, borderBottom: `1px solid ${C.border}` }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FolieZweiSpalten({ folie, accent }: { folie: Folie; accent: string }) {
  const left  = folie.inhalt.left  ?? { title: '', lines: [] }
  const right = folie.inhalt.right ?? { title: '', lines: [] }
  const la = folie.inhalt.left_accent  ?? C.blue
  const ra = folie.inhalt.right_accent ?? C.green
  return (
    <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem' }}>
      {[{ data: left, col: la }, { data: right, col: ra }].map(({ data, col }, idx) => (
        <div key={idx} style={{ flex: 1, border: `1px solid ${col}`, borderRadius: '8px', overflow: 'hidden' }}>
          {data.title && (
            <div style={{ background: col, color: '#fff', padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '0.9rem' }}>
              {data.title}
            </div>
          )}
          <div style={{ padding: '0.75rem', background: `${col}10` }}>
            {(data.lines ?? []).map((l: string, i: number) => (
              <div key={i} style={{ fontSize: '0.9rem', color: l === '' ? 'transparent' : C.textMid, lineHeight: 1.6, marginBottom: '0.2rem', minHeight: '1rem' }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FolieFormel({ folie, accent }: { folie: Folie; accent: string }) {
  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ background: C.bgPanel, border: `2px solid ${accent}`, borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1rem', textAlign: 'center' as const }}>
        <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 700, color: accent }}>
          {folie.inhalt.formel}
        </div>
      </div>
      <div style={{ fontSize: '0.9rem', color: C.textMid, lineHeight: 1.7, marginBottom: '1rem' }}>
        {folie.inhalt.erklaerung}
      </div>
      {(folie.inhalt.beispiele ?? []).map((b: string, i: number) => (
        <div key={i} style={{ background: C.bgAlt, borderLeft: `3px solid ${accent}`, padding: '0.4rem 0.75rem', marginBottom: '0.4rem', fontSize: '0.9rem', color: C.text, fontFamily: 'monospace' }}>
          {b}
        </div>
      ))}
    </div>
  )
}

function FolieAnimation({ folie, accent }: { folie: Folie; accent: string }) {
  const animId = folie.inhalt.animation_id ?? 'unbekannt'
  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ background: C.bgPanel, border: `1px dashed ${accent}`, borderRadius: '8px', padding: '3rem', textAlign: 'center' as const, color: C.textDim }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎬</div>
        <div style={{ fontWeight: 700, color: accent, marginBottom: '0.5rem' }}>
          Animation: {animId}
        </div>
        <div style={{ fontSize: '0.8rem' }}>
          Interaktive Animation folgt in Solar Academy 0.3
        </div>
      </div>
    </div>
  )
}

function FolieVideo({ folie }: { folie: Folie }) {
  const vid = folie.inhalt.youtube_id
  if (!vid) return null
  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: '8px', overflow: 'hidden' }}>
        <iframe
          src={`https://www.youtube.com/embed/${vid}?start=${folie.inhalt.start_sec ?? 0}`}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}

function FolieQuiz({ folie, onPass, accent }: { folie: Folie; onPass: () => void; accent: string }) {
  const fragen: any[] = folie.inhalt.fragen ?? []
  const [antworten, setAntworten]   = useState<number[]>(Array(fragen.length).fill(-1))
  const [geprueft, setGeprueft]     = useState(false)
  const [bestanden, setBestanden]   = useState(false)

  const pruefen = () => {
    const richtig = fragen.filter((f, i) => antworten[i] === f.richtig).length
    const pass = richtig >= Math.ceil(fragen.length * 0.7)
    setGeprueft(true)
    setBestanden(pass)
    if (pass) onPass()
  }

  const allesBeantwortet = antworten.every(a => a >= 0)

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {fragen.map((frage, fi) => (
        <div key={fi} style={{ border: `1px solid ${geprueft ? (antworten[fi] === frage.richtig ? C.green : C.red) : C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '0.6rem 0.75rem', background: C.bgAlt, fontWeight: 700, fontSize: '0.9rem', color: C.text }}>
            {fi + 1}. {frage.frage}
          </div>
          <div style={{ padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {frage.optionen.map((opt: string, oi: number) => {
              const isSelected = antworten[fi] === oi
              const isCorrect  = oi === frage.richtig
              let bg = C.bg
              if (geprueft && isCorrect) bg = '#e8f5ee'
              else if (geprueft && isSelected && !isCorrect) bg = '#fce4e4'
              else if (isSelected) bg = C.bgPanel
              return (
                <button key={oi} onClick={() => !geprueft && setAntworten(a => { const n=[...a]; n[fi]=oi; return n })}
                  style={{ background: bg, border: `1px solid ${isSelected ? accent : C.border}`, borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: geprueft ? 'default' : 'pointer', textAlign: 'left' as const, fontSize: '0.88rem', color: C.text }}>
                  <span style={{ fontWeight: 700, color: accent, marginRight: '0.5rem' }}>{['A','B','C','D'][oi]}</span>
                  {opt}
                </button>
              )
            })}
            {geprueft && (
              <div style={{ fontSize: '0.78rem', color: C.textDim, marginTop: '0.25rem', fontStyle: 'italic' }}>
                {frage.erklaerung}
              </div>
            )}
          </div>
        </div>
      ))}

      {!geprueft && (
        <button onClick={pruefen} disabled={!allesBeantwortet}
          style={{ padding: '0.7rem', background: allesBeantwortet ? accent : C.bgAlt, color: allesBeantwortet ? '#fff' : C.textDim, border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: allesBeantwortet ? 'pointer' : 'not-allowed' }}>
          Auswerten →
        </button>
      )}

      {geprueft && (
        <div style={{ padding: '0.75rem', background: bestanden ? '#e8f5ee' : '#fce4e4', border: `1px solid ${bestanden ? C.green : C.red}`, borderRadius: '8px', fontWeight: 700, textAlign: 'center' as const, color: bestanden ? C.green : C.red }}>
          {bestanden ? '✓ Quiz bestanden! Kurs abgeschlossen.' : '✗ Nicht bestanden — lies die Erklärungen und versuche es nochmal.'}
        </div>
      )}
    </div>
  )
}

// ── Haupt-KursRenderer ────────────────────────────────────────────────────────

export default function KursRenderer({ kursId, onComplete, onClose }: KursRendererProps) {
  const [kurs, setKurs]         = useState<Kurs | null>(null)
  const [loading, setLoading]   = useState(true)
  const [folie, setFolie]       = useState(0)   // 0-basiert
  const [quizPass, setQuizPass] = useState(false)

  useEffect(() => { loadKurs() }, [kursId])

  async function loadKurs() {
    setLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const token = session?.access_token ?? ''
      const r = await fetch(`/api/game/kurse?id=${kursId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const d = await r.json()
      setKurs(d.kurs)
      setFolie(d.fortschritt?.letzte_folie ? d.fortschritt.letzte_folie - 1 : 0)
    } catch (e) {
      console.error('KursRenderer load error:', e)
    }
    setLoading(false)
  }

  async function complete() {
    if (!kurs) return
    try {
      const { data: { session: s2 } } = await createClient().auth.getSession()
      const token = s2?.access_token ?? ''
      await fetch(`/api/game/kurse?action=complete&kurs_db_id=${kurs.id}&punkte=${kurs.punkte}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      onComplete(kurs.punkte)
    } catch (e) { console.error(e) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.textDim }}>
      <div style={{ textAlign: 'center' as const }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
        Kurs wird geladen …
      </div>
    </div>
  )

  if (!kurs) return (
    <div style={{ padding: '2rem', color: C.red, textAlign: 'center' as const }}>
      Kurs nicht gefunden.
    </div>
  )

  const folien = kurs.foundation_folien
  const aktFolie = folien[folie]
  const accent = kurs.thema_farbe
  const isLast = folie === folien.length - 1
  const isQuizFolie = aktFolie?.typ === 'quiz'

  function renderFolie(f: Folie) {
    switch (f.typ) {
      case 'text':         return <FolieText folie={f} accent={accent} />
      case 'tabelle':      return <FolieTabelle folie={f} accent={accent} />
      case 'zwei_spalten': return <FolieZweiSpalten folie={f} accent={accent} />
      case 'formel':       return <FolieFormel folie={f} accent={accent} />
      case 'animation':    return <FolieAnimation folie={f} accent={accent} />
      case 'video':        return <FolieVideo folie={f} />
      case 'quiz':         return <FolieQuiz folie={f} onPass={() => setQuizPass(true)} accent={accent} />
      default:             return <div style={{ padding: '1.5rem', color: C.textDim }}>Unbekannter Folientyp: {f.typ}</div>
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: accent, color: '#fff', padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '0.6rem', opacity: 0.8, letterSpacing: '2px', textTransform: 'uppercase' as const }}>
            {kurs.thema} · Niveau {kurs.niveau}
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{kurs.titel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
            {folie + 1} / {folien.length}
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div style={{ height: '3px', background: C.border, flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${((folie + 1) / folien.length) * 100}%`, background: accent, transition: 'width 0.3s ease' }} />
      </div>

      {/* Folientitel */}
      {aktFolie?.titel && (
        <div style={{ padding: '0.75rem 1rem 0', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: C.text }}>{aktFolie.titel}</div>
        </div>
      )}

      {/* Folieninhalt scrollbar */}
      <div style={{ flex: 1, overflowY: 'auto' as const }}>
        {aktFolie && renderFolie(aktFolie)}
      </div>

      {/* Navigation */}
      <div style={{ padding: '0.6rem 1rem', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bgAlt, flexShrink: 0 }}>
        <button onClick={() => setFolie(f => Math.max(0, f - 1))} disabled={folie === 0}
          style={{ padding: '0.45rem 1rem', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', cursor: folie === 0 ? 'not-allowed' : 'pointer', color: folie === 0 ? C.textDim : C.text, fontSize: '0.85rem' }}>
          ← Zurück
        </button>

        <span style={{ fontSize: '0.7rem', color: C.textDim }}>
          {kurs.punkte} Wissenspunkte
        </span>

        {isLast && isQuizFolie && quizPass ? (
          <button onClick={complete}
            style={{ padding: '0.45rem 1rem', background: C.green, border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
            Kurs abschliessen ✓
          </button>
        ) : isLast ? (
          <button disabled style={{ padding: '0.45rem 1rem', background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: '6px', cursor: 'not-allowed', color: C.textDim, fontSize: '0.85rem' }}>
            {isQuizFolie ? 'Quiz bestehen →' : 'Ende'}
          </button>
        ) : (
          <button onClick={() => setFolie(f => Math.min(folien.length - 1, f + 1))}
            style={{ padding: '0.45rem 1rem', background: accent, border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
            Weiter →
          </button>
        )}
      </div>
    </div>
  )
}
