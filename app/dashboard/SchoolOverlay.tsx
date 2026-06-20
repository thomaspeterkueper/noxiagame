'use client'
// app/dashboard/SchoolOverlay.tsx
// Erstellt: 20.06.2026
//
// Schul-Overlay — Aufgaben lösen → knowledge_points verdienen.
// Aufgaben werden von Claude dynamisch generiert, thematisch verankert
// in der aktuellen Kolonie-Situation (Verbrauch, Handelsmargen, Lager).
// Schwierigkeit: max. 8. Schuljahr (Grundrechenarten, Prozent, einfache
// Proportionen). Keine Algebra, keine Formeln — Kopfrechnen mit Kontext.

import { useState, useEffect } from 'react'

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
}

interface SchoolOverlayProps {
  locationSlug:      string
  colonyContext:     ColonyContext
  onClose:           () => void
  onKnowledgeEarned: (pts: number, newTotal: number) => void
}

const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(2,4,8,0.80)',
    zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    background: '#0d1a26', border: '1px solid #2a4e7a', borderRadius: '12px',
    width: 'min(520px, 95vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 40px rgba(0,0,0,0.7)', fontFamily: "'Courier Prime', monospace",
    color: '#cdd6e0', overflow: 'hidden',
  },
  header: {
    padding: '1rem 1.25rem 0.75rem',
    borderBottom: '1px solid rgba(42,78,122,0.5)',
    background: 'linear-gradient(180deg, #0a1520 0%, #0d1a26 100%)',
  },
  body: { flex: 1, overflow: 'auto', padding: '1.25rem' },
  questionBox: {
    background: 'rgba(42,78,122,0.2)', border: '1px solid rgba(42,78,122,0.5)',
    borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.25rem',
    fontSize: '0.9rem', lineHeight: 1.6, color: '#e8f0f8',
  },
  input: {
    width: '100%', background: '#0a1520', border: '2px solid #2a4e7a',
    borderRadius: '6px', padding: '0.6rem 0.8rem', color: '#cdd6e0',
    fontSize: '1rem', fontFamily: "'Courier Prime', monospace",
    outline: 'none', boxSizing: 'border-box' as const,
  },
  btnPrimary: {
    background: '#2a6ab5', color: '#fff', border: 'none',
    padding: '0.6rem 1.5rem', borderRadius: '6px', fontSize: '0.8rem',
    fontWeight: 700, cursor: 'pointer', marginTop: '0.75rem',
  },
  btnSecondary: {
    background: 'transparent', color: '#5a7a9a', border: '1px solid #2a4e7a',
    padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.75rem',
    cursor: 'pointer', marginTop: '0.5rem',
  },
  correct: {
    background: 'rgba(111,207,151,0.15)', border: '1px solid #6fcf97',
    borderRadius: '8px', padding: '0.75rem 1rem', marginTop: '0.75rem',
    color: '#6fcf97', fontSize: '0.8rem',
  },
  wrong: {
    background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c',
    borderRadius: '8px', padding: '0.75rem 1rem', marginTop: '0.75rem',
    color: '#e74c3c', fontSize: '0.8rem',
  },
}

export default function SchoolOverlay({
  locationSlug, colonyContext, onClose, onKnowledgeEarned
}: SchoolOverlayProps) {
  const [task, setTask]         = useState<Task | null>(null)
  const [loading, setLoading]   = useState(false)
  const [userAnswer, setAnswer] = useState('')
  const [result, setResult]     = useState<'correct' | 'wrong' | null>(null)
  const [explanation, setExp]   = useState('')
  const [totalKnowledge, setTotal] = useState<number | null>(null)
  const [streak, setStreak]     = useState(0)

  useEffect(() => {
    loadKnowledge()
    generateTask()
  }, [])

  async function loadKnowledge() {
    try {
      const r = await fetch('/api/game/knowledge')
      const d = await r.json()
      setTotal(d.knowledge_points ?? 0)
    } catch {}
  }

  async function generateTask() {
    setLoading(true)
    setResult(null)
    setAnswer('')
    setExp('')
    setTask(null)

    try {
      const prompt = `Du bist Spielleiter in einem Weltraum-Handelsspiel namens Noxia.
Generiere eine EINZELNE Rechenaufgabe für einen Spieler. Schwierigkeit: maximal 8. Schuljahr.
Erlaubt: Addition, Subtraktion, Multiplikation, Division, Prozentrechnung, einfache Proportionen.
NICHT erlaubt: Algebra, Gleichungen, Wurzeln, Potenzen.

Aktuelle Spielsituation auf ${colonyContext.locationName}:
- Bevölkerung: ${colonyContext.population} Einwohner
- Wasserlager: ${colonyContext.waterStock}t
- Wasserverbrauch: ${colonyContext.waterCons}t/Stunde
- Spieler-Credits: ${colonyContext.credits} Cr

Verwende diese konkreten Zahlen in der Aufgabe. Beispiel-Themen:
- Wie viele Stunden reicht das Wasserlager?
- Wie viel Gewinn macht man bei einer Handelsroute?
- Wie viele Tonnen braucht man um X Tage zu versorgen?

Antworte NUR mit diesem JSON (kein Markdown, keine Erklärung drumherum):
{"question":"[Aufgabentext auf Deutsch]","answer":[Zahl],"explanation":"[Kurze Erklärung der Lösung]","points":[10-30]}

Die Antwort muss eine ganze Zahl sein. Keine Kommazahlen.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const text = data.content?.[0]?.text ?? ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed: Task = JSON.parse(clean)
      setTask(parsed)
    } catch (e) {
      // Fallback: statische Aufgabe aus Kolonie-Daten
      const hours = Math.floor(colonyContext.waterStock / Math.max(1, colonyContext.waterCons))
      setTask({
        question: `Das Wasserlager auf ${colonyContext.locationName} enthält ${colonyContext.waterStock} Tonnen. Die Kolonie verbraucht ${colonyContext.waterCons} Tonnen pro Stunde. Wie viele Stunden reicht der Vorrat?`,
        answer: hours,
        explanation: `${colonyContext.waterStock} ÷ ${colonyContext.waterCons} = ${hours} Stunden`,
        points: 15,
      })
    }
    setLoading(false)
  }

  async function checkAnswer() {
    if (!task || userAnswer.trim() === '') return
    const given = parseInt(userAnswer.trim(), 10)
    const correct = given === task.answer

    setResult(correct ? 'correct' : 'wrong')
    setExp(task.explanation)

    if (correct) {
      const bonus = streak >= 2 ? Math.floor(task.points * 1.5) : task.points
      setStreak(s => s + 1)
      try {
        const r = await fetch(`/api/game/knowledge?action=award&points=${bonus}&reason=school_task&location=${locationSlug}`)
        const d = await r.json()
        setTotal(d.knowledge_points)
        onKnowledgeEarned(bonus, d.knowledge_points)
      } catch {}
    } else {
      setStreak(0)
    }
  }

  return (
    <div style={S.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.panel}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.6rem', color: '#2a6ab5', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' }}>
                🎓 Akademie · {colonyContext.locationName}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#cdd6e0', marginTop: '3px' }}>
                Wissens-Terminal
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a7a9a', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(201,169,97,0.15)', color: '#c9a961' }}>
              🧠 {totalKnowledge ?? '…'} Wissenspunkte
            </span>
            {streak >= 2 && (
              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(111,207,151,0.15)', color: '#6fcf97' }}>
                🔥 {streak}er Serie · +50% Bonus
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={S.body}>
          {loading && (
            <div style={{ color: '#5a7a9a', textAlign: 'center', padding: '2rem', fontSize: '0.8rem' }}>
              Aufgabe wird generiert …
            </div>
          )}

          {!loading && task && (
            <>
              <div style={S.questionBox}>
                {task.question}
                <div style={{ fontSize: '0.6rem', color: '#5a7a9a', marginTop: '0.5rem' }}>
                  Richtige Antwort: {task.points} Wissenspunkte
                  {streak >= 2 && <span style={{ color: '#c9a961' }}> → {Math.floor(task.points * 1.5)} mit Serie-Bonus</span>}
                </div>
              </div>

              <input
                style={S.input}
                type="number"
                placeholder="Deine Antwort (ganze Zahl)"
                value={userAnswer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && result === null && checkAnswer()}
                disabled={result !== null}
              />

              {result === null && (
                <button style={S.btnPrimary} onClick={checkAnswer}>
                  Antwort prüfen →
                </button>
              )}

              {result === 'correct' && (
                <div style={S.correct}>
                  ✓ Richtig! {explanation}
                </div>
              )}

              {result === 'wrong' && (
                <div style={S.wrong}>
                  ✗ Nicht ganz. {explanation}
                </div>
              )}

              {result !== null && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button style={S.btnPrimary} onClick={generateTask}>
                    Nächste Aufgabe →
                  </button>
                  <button style={S.btnSecondary} onClick={onClose}>
                    Schließen
                  </button>
                </div>
              )}
            </>
          )}

          {/* Erklärung was Wissenspunkte bringen */}
          <div style={{ marginTop: '1.5rem', padding: '0.75rem', borderRadius: '6px', background: 'rgba(42,78,122,0.1)', border: '1px solid rgba(42,78,122,0.3)', fontSize: '0.65rem', color: '#5a7a9a', lineHeight: 1.5 }}>
            <span style={{ color: '#8ab0d0' }}>Wissenspunkte</span> erhöhen das Wachstum deiner Kolonien — aber nur dort, wo du auch eine Schule gebaut hast. Je mehr du weißt und je mehr du investierst, desto schneller wächst deine Station.
          </div>
        </div>
      </div>
    </div>
  )
}
