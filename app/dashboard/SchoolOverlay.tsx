'use client'
// app/dashboard/SchoolOverlay.tsx
// Version: 2.0.0 — Fokus auf Lernumgebung, keine Stationsstatistik

import { useState, useEffect, useRef } from 'react'

interface ColonyContext {
  locationName: string
  population:   number
  waterStock:   number
  waterCons:    number
  credits:      number
}

interface Task {
  question:    string
  answer:      number
  explanation: string
  points:      number
  topic:       string
}

interface SchoolOverlayProps {
  locationSlug:      string
  colonyContext:     ColonyContext
  onClose:           () => void
  onKnowledgeEarned: (pts: number, newTotal: number) => void
}

const TOPIC_COLOR: Record<string, string> = {
  'Ressourcen':  '#2f86c9',
  'Handel':      '#c9a961',
  'Navigation':  '#6fcf97',
  'Bevölkerung': '#b48ce8',
  'Energie':     '#ffd700',
}

export default function SchoolOverlay({
  locationSlug, colonyContext, onClose, onKnowledgeEarned
}: SchoolOverlayProps) {
  const [task, setTask]            = useState<Task | null>(null)
  const [loading, setLoading]      = useState(false)
  const [userAnswer, setAnswer]    = useState('')
  const [result, setResult]        = useState<'correct' | 'wrong' | null>(null)
  const [totalKnowledge, setTotal] = useState<number | null>(null)
  const [streak, setStreak]        = useState(0)
  const [earned, setEarned]        = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadKnowledge(); generateTask() }, [])
  useEffect(() => {
    if (!loading && task && result === null) setTimeout(() => inputRef.current?.focus(), 100)
  }, [loading, task, result])

  async function loadKnowledge() {
    try {
      const r = await fetch('/api/game/knowledge')
      const d = await r.json()
      setTotal(d.knowledge_points ?? 0)
    } catch {}
  }

  async function generateTask() {
    setLoading(true); setResult(null); setAnswer(''); setEarned(null); setTask(null)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: `Du bist Aufgabengenerator für das Weltraum-Handelsspiel Noxia.
Erstelle eine EINZELNE Rechenaufgabe. Schwierigkeit: maximal 8. Schuljahr.
Erlaubt: Addition, Subtraktion, Multiplikation, Division, Prozentrechnung, Proportionen.
NICHT erlaubt: Algebra, Gleichungen, Wurzeln, Potenzen.

Kolonie-Kontext (für realistische Zahlen, NICHT im Output anzeigen):
Station: ${colonyContext.locationName} · Bevölkerung: ${colonyContext.population}
Wasserlager: ${colonyContext.waterStock}t · Verbrauch: ${colonyContext.waterCons}t/h
Credits: ${colonyContext.credits} Cr

Wähle ZUFÄLLIG ein Thema: Ressourcen, Handel, Navigation, Bevölkerung, Energie.
Verwende die echten Zahlen. Die Antwort MUSS eine ganze Zahl sein.

Antworte NUR mit JSON (kein Markdown):
{"question":"[1-3 Sätze Deutsch]","answer":[Zahl],"explanation":"[1 Satz Lösung]","points":[10-25],"topic":"[Thema]"}` }],
        }),
      })
      const data = await response.json()
      const text = data.content?.[0]?.text ?? ''
      setTask(JSON.parse(text.replace(/```json|```/g, '').trim()))
    } catch {
      const h = Math.floor(colonyContext.waterStock / Math.max(1, colonyContext.waterCons))
      setTask({ question: `Das Wasserlager auf ${colonyContext.locationName} hat ${colonyContext.waterStock}t. Verbrauch: ${colonyContext.waterCons}t/h. Wie viele Stunden reicht der Vorrat?`, answer: h, explanation: `${colonyContext.waterStock} ÷ ${colonyContext.waterCons} = ${h}`, points: 15, topic: 'Ressourcen' })
    }
    setLoading(false)
  }

  async function checkAnswer() {
    if (!task || userAnswer.trim() === '' || result !== null) return
    const correct = parseInt(userAnswer.trim(), 10) === task.answer
    setResult(correct ? 'correct' : 'wrong')
    if (correct) {
      const bonus = streak >= 2 ? Math.floor(task.points * 1.5) : task.points
      setEarned(bonus); setStreak(s => s + 1)
      try {
        const r = await fetch(`/api/game/knowledge?action=award&points=${bonus}&reason=school_task&location=${locationSlug}`)
        const d = await r.json()
        if (d.knowledge_points != null) { setTotal(d.knowledge_points); onKnowledgeEarned(bonus, d.knowledge_points) }
      } catch {}
    } else { setStreak(0) }
  }

  const tc = task ? (TOPIC_COLOR[task.topic] ?? '#8ab0d0') : '#8ab0d0'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d1a26', border: '1px solid #2a4e7a', borderRadius: '14px', width: 'min(480px, 95vw)', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 48px rgba(0,0,0,0.7)', fontFamily: "'Courier Prime', monospace", color: '#cdd6e0', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', background: '#0a1520', borderBottom: '1px solid rgba(42,78,122,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.55rem', color: '#2a6ab5', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase' }}>🎓 Akademie · {colonyContext.locationName}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#cdd6e0', marginTop: '2px' }}>Wissens-Terminal</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: '20px', background: 'rgba(201,169,97,0.15)', color: '#c9a961', fontWeight: 700 }}>🧠 {totalKnowledge ?? '…'}</div>
            {streak >= 2 && <div style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '20px', background: 'rgba(111,207,151,0.15)', color: '#6fcf97' }}>🔥 ×{streak}</div>}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a7a9a', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem 1.25rem' }}>
          {loading && (
            <div style={{ color: '#5a7a9a', textAlign: 'center', padding: '2.5rem', fontSize: '0.8rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
              Aufgabe wird generiert …
            </div>
          )}

          {!loading && task && (
            <>
              {/* Thema */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.6rem', padding: '3px 10px', borderRadius: '20px', background: `${tc}20`, color: tc, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const }}>{task.topic}</span>
              </div>

              {/* Aufgabe */}
              <div style={{ background: 'rgba(42,78,122,0.15)', border: `1px solid ${tc}40`, borderRadius: '10px', padding: '1.1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.9rem', lineHeight: 1.65, color: '#e8f0f8' }}>
                {task.question}
              </div>

              {/* Eingabe */}
              {result === null && (
                <>
                  <input ref={inputRef} type="number" placeholder="Deine Antwort …" value={userAnswer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                    style={{ width: '100%', background: '#0a1520', border: '2px solid #2a4e7a', borderRadius: '8px', padding: '0.65rem 0.9rem', color: '#cdd6e0', fontSize: '1.1rem', fontFamily: "'Courier Prime', monospace", outline: 'none', boxSizing: 'border-box' as const }} />
                  <button onClick={checkAnswer} disabled={!userAnswer.trim()}
                    style={{ width: '100%', marginTop: '0.75rem', padding: '0.7rem', background: userAnswer.trim() ? '#2a4e7a' : '#1a2a3a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: userAnswer.trim() ? 'pointer' : 'not-allowed' }}>
                    Prüfen →
                  </button>
                  <div style={{ fontSize: '0.6rem', color: '#3a5a7a', textAlign: 'center', marginTop: '0.5rem' }}>
                    {task.points} Punkte{streak >= 2 ? ` · Serie-Bonus: ${Math.floor(task.points * 1.5)}` : ''}
                  </div>
                </>
              )}

              {/* Ergebnis */}
              {result === 'correct' && (
                <div style={{ background: 'rgba(111,207,151,0.12)', border: '1px solid #6fcf97', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                  <div style={{ color: '#6fcf97', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.3rem' }}>✓ Richtig! {earned != null && <span style={{ color: '#c9a961' }}>+{earned} 🧠</span>}</div>
                  <div style={{ fontSize: '0.78rem', color: '#8ab0d0' }}>{task.explanation}</div>
                </div>
              )}
              {result === 'wrong' && (
                <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid #e74c3c', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                  <div style={{ color: '#e74c3c', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.3rem' }}>✗ Nicht ganz.</div>
                  <div style={{ fontSize: '0.78rem', color: '#8ab0d0' }}>{task.explanation}</div>
                </div>
              )}

              {result !== null && (
                <button onClick={generateTask}
                  style={{ width: '100%', marginTop: '1rem', padding: '0.65rem', background: 'transparent', border: '1px solid #2a4e7a', color: '#8ab0d0', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Nächste Aufgabe →
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.6rem 1.25rem', borderTop: '1px solid rgba(42,78,122,0.3)', fontSize: '0.58rem', color: '#2a4e7a', textAlign: 'center' }}>
          Wissen wirkt dort, wo du eine Akademie gebaut hast · max. 10 Aufgaben/Stunde
        </div>
      </div>
    </div>
  )
}
