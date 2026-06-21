'use client'
// app/dashboard/SchoolOverlay.tsx
// Version: 3.0.0 — Zwei Aufgabentypen: Rechnen + Wissensfragen (Multiple Choice)

import { useState, useEffect, useRef } from 'react'

interface ColonyContext {
  locationName: string
  population:   number
  waterStock:   number
  waterCons:    number
  credits:      number
}

interface CalcTask {
  kind:        'calc'
  question:    string
  answer:      number
  explanation: string
  points:      number
  topic:       string
}

interface QuizTask {
  kind:        'quiz'
  question:    string
  options:     string[]   // 4 Antworten
  correct:     number     // Index 0-3
  explanation: string
  points:      number
  topic:       string
}

type Task = CalcTask | QuizTask

interface SchoolOverlayProps {
  locationSlug:      string
  colonyContext:     ColonyContext
  onClose:           () => void
  onKnowledgeEarned: (pts: number, newTotal: number) => void
}

const TOPIC_COLOR: Record<string, string> = {
  'Ressourcen':   '#2f86c9',
  'Handel':       '#c9a961',
  'Navigation':   '#6fcf97',
  'Bevölkerung':  '#b48ce8',
  'Energie':      '#ffd700',
  'Sonnensystem': '#e8702a',
  'Physik':       '#3fb0c9',
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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadKnowledge(); generateTask() }, [])
  useEffect(() => {
    if (!loading && task && result === null && task.kind === 'calc')
      setTimeout(() => inputRef.current?.focus(), 100)
  }, [loading, task, result])

  async function loadKnowledge() {
    try {
      const r = await fetch('/api/game/knowledge')
      const d = await r.json()
      setTotal(d.knowledge_points ?? 0)
    } catch {}
  }

  async function generateTask() {
    setLoading(true); setResult(null); setAnswer(''); setOpt(null); setEarned(null); setTask(null)

    // Abwechselnd Rechnen und Quiz (zufällig 40/60)
    const doQuiz = Math.random() < 0.45

    try {
      const prompt = doQuiz
        ? `Du bist Aufgabengenerator für das Weltraum-Handelsspiel Noxia.
Erstelle eine Wissensfrage über das Sonnensystem, Physik oder Spielmechaniken.
Themen: Sonnensystem (Planeten, Monde, Asteroiden), Physik (Schwerkraft, Energie, Orbits),
Ressourcen (warum braucht Mars Wasser-Import?), Navigation (warum Erde→Mond teurer?).
Niveau: interessant für alle Altersgruppen, nicht zu schwer, nicht trivial.

Antworte NUR mit JSON (kein Markdown):
{"kind":"quiz","question":"[Frage]","options":["[A]","[B]","[C]","[D]"],"correct":[0-3],"explanation":"[1 Satz Erklärung]","points":[15-25],"topic":"[Sonnensystem|Physik|Ressourcen|Navigation]"}`
        : `Du bist Aufgabengenerator für das Weltraum-Handelsspiel Noxia.
Erstelle eine Rechenaufgabe. Schwierigkeit: maximal 8. Schuljahr.
Erlaubt: Addition, Subtraktion, Multiplikation, Division, Prozentrechnung, Proportionen.
NICHT erlaubt: Algebra, Gleichungen, Wurzeln, Potenzen. Antwort = ganze Zahl.

Kontext (für Zahlen, nicht im Output):
Station: ${colonyContext.locationName} · Bevölkerung: ${colonyContext.population}
Wasserlager: ${colonyContext.waterStock}t · Verbrauch: ${colonyContext.waterCons}t/h
Credits: ${colonyContext.credits} Cr

Themen: Ressourcen, Handel, Navigation, Bevölkerung, Energie.
Antworte NUR mit JSON (kein Markdown):
{"kind":"calc","question":"[1-3 Sätze]","answer":[Zahl],"explanation":"[1 Satz]","points":[10-25],"topic":"[Thema]"}`

      const response = await fetch('/api/game/school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await response.json()
      if (!data.task) throw new Error(data.error ?? `HTTP ${response.status}`)
      setTask(data.task)
    } catch (e: any) {
      console.error('School task error:', e?.message ?? e)
      // Fallback: statische Fragen (kein Kolonie-Kontext nötig)
      const fallbacks: Task[] = [
        { kind: 'calc', question: 'Ein Frachter kauft 80 Tonnen Wasser für 95 Cr/t und verkauft sie für 155 Cr/t. Wie viel Gewinn macht er insgesamt?', answer: 4800, explanation: '80 × (155 − 95) = 80 × 60 = 4.800 Cr', points: 15, topic: 'Handel' },
        { kind: 'quiz', question: 'Warum kostet der Flug von der Erde zum Mond mehr Energie als der Rückweg?', options: ['Der Mond ist weiter entfernt', 'Man muss das Erdgravitationsfeld überwinden', 'Das Schiff ist schwerer beim Hinflug', 'Der Mond hat eine stärkere Anziehungskraft'], correct: 1, explanation: 'Die Erde hat eine viel stärkere Schwerkraft (9.8 m/s²) — für den Aufstieg braucht man mehr Energie als für die Landung.', points: 20, topic: 'Physik' },
        { kind: 'calc', question: 'Eine Kolonie mit 500 Einwohnern verbraucht 1 Tonne Wasser pro 100 Einwohner pro Stunde. Wie viel Wasser braucht sie in 24 Stunden?', answer: 120, explanation: '500 ÷ 100 × 1 × 24 = 120 Tonnen', points: 15, topic: 'Ressourcen' },
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
      <div style={{ background: '#0d1a26', border: '1px solid #2a4e7a', borderRadius: '14px', width: 'min(500px, 95vw)', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 48px rgba(0,0,0,0.7)', fontFamily: "'Courier Prime', monospace", color: '#cdd6e0', overflow: 'hidden' }}>

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
              {/* Thema + Typ */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.6rem', padding: '3px 10px', borderRadius: '20px', background: `${tc}20`, color: tc, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const }}>{task.topic}</span>
                <span style={{ fontSize: '0.6rem', padding: '3px 8px', borderRadius: '20px', background: 'rgba(42,78,122,0.2)', color: '#5a7a9a' }}>
                  {task.kind === 'quiz' ? '❓ Wissensfrage' : '🔢 Rechenaufgabe'}
                </span>
              </div>

              {/* Frage */}
              <div style={{ background: 'rgba(42,78,122,0.15)', border: `1px solid ${tc}40`, borderRadius: '10px', padding: '1.1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.9rem', lineHeight: 1.65, color: '#e8f0f8' }}>
                {task.question}
              </div>

              {/* Antwort-Interface */}
              {result === null && (
                <>
                  {task.kind === 'calc' ? (
                    <>
                      <input ref={inputRef} type="number" placeholder="Deine Antwort …" value={userAnswer}
                        onChange={e => setAnswer(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                        style={{ width: '100%', background: '#0a1520', border: '2px solid #2a4e7a', borderRadius: '8px', padding: '0.65rem 0.9rem', color: '#cdd6e0', fontSize: '1.1rem', fontFamily: "'Courier Prime', monospace", outline: 'none', boxSizing: 'border-box' as const }} />
                      <button onClick={() => checkAnswer()} disabled={!userAnswer.trim()}
                        style={{ width: '100%', marginTop: '0.75rem', padding: '0.7rem', background: userAnswer.trim() ? '#2a4e7a' : '#1a2a3a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: userAnswer.trim() ? 'pointer' : 'not-allowed' }}>
                        Prüfen →
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {task.options.map((opt, i) => (
                        <button key={i} onClick={() => checkAnswer(i)}
                          style={{ padding: '0.75rem 1rem', background: 'rgba(42,78,122,0.15)', border: '1px solid #2a4e7a', borderRadius: '8px', color: '#cdd6e0', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(42,78,122,0.35)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(42,78,122,0.15)')}>
                          <span style={{ color: '#5a7a9a', marginRight: '0.75rem' }}>{['A','B','C','D'][i]}</span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: '0.6rem', color: '#3a5a7a', textAlign: 'center', marginTop: '0.5rem' }}>
                    {task.points} Punkte{streak >= 2 ? ` · Serie-Bonus: ${Math.floor(task.points * 1.5)}` : ''}
                  </div>
                </>
              )}

              {/* Ergebnis */}
              {result !== null && task.kind === 'quiz' && selectedOption !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  {task.options.map((opt, i) => {
                    const isCorrect = i === task.correct
                    const isSelected = i === selectedOption
                    const bg = isCorrect ? 'rgba(111,207,151,0.15)' : isSelected ? 'rgba(231,76,60,0.1)' : 'rgba(42,78,122,0.1)'
                    const border = isCorrect ? '1px solid #6fcf97' : isSelected ? '1px solid #e74c3c' : '1px solid #1a2a3a'
                    return (
                      <div key={i} style={{ padding: '0.6rem 1rem', background: bg, border, borderRadius: '8px', fontSize: '0.82rem', color: isCorrect ? '#6fcf97' : isSelected ? '#e74c3c' : '#5a7a9a' }}>
                        <span style={{ marginRight: '0.75rem' }}>{isCorrect ? '✓' : isSelected ? '✗' : ' '}</span>
                        {['A','B','C','D'][i]} · {opt}
                      </div>
                    )
                  })}
                </div>
              )}

              {result === 'correct' && (
                <div style={{ background: 'rgba(111,207,151,0.12)', border: '1px solid #6fcf97', borderRadius: '10px', padding: '0.85rem 1.1rem' }}>
                  <div style={{ color: '#6fcf97', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem' }}>✓ Richtig! {earned != null && <span style={{ color: '#c9a961' }}>+{earned} 🧠</span>}</div>
                  <div style={{ fontSize: '0.75rem', color: '#8ab0d0' }}>{task.explanation}</div>
                </div>
              )}
              {result === 'wrong' && (
                <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid #e74c3c', borderRadius: '10px', padding: '0.85rem 1.1rem' }}>
                  <div style={{ color: '#e74c3c', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem' }}>✗ Nicht ganz.</div>
                  <div style={{ fontSize: '0.75rem', color: '#8ab0d0' }}>{task.explanation}</div>
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
