'use client'

// app/dashboard/WelcomeSetup.tsx
// Erstellt:     07.06.2026
// Aktualisiert: 22.09.2026 — Playability: Earth-Starttext und erster Journey-CTA\n//               an den tatsächlichen Earth/Selmecke-Einstieg angeglichen.\n// Vorher:       16.09.2026 — Bugfix: Name wurde erneut leer abgefragt, obwohl
//               er bereits bei der Registrierung vergeben wurde; jetzt über
//               initialUsername vorbefüllt (Prop kommt aus DashboardGate.tsx,
//               dort ohnehin schon aus /api/game/profile geladen). Tutorial-
//               Karten von Mond- auf Erde-Start umgestellt (neuer Startort,
//               s. Migration fix_new_player_starting_location_earth_not_moon).
// Vorher:       09.07.2026 — onDone mit openJourney-Flag für vertikalen Spielpfad
// Version:      0.3.1
// Erst-Login-Onboarding: Name (vorbefüllt) + Avatar wählen, dann drei
// Einweisungskarten. Erscheint wenn profiles.onboarded = false, jetzt
// exklusiv gesteuert über DashboardGate.tsx. Dark-UI-Stil (Transit-Ästhetik).

import React from 'react'

import { useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

const C = {
  bg:    '#020408',
  panel: '#0a1018',
  line:  '#1c2836',
  text:  '#aab8c8',
  dim:   '#5a6878',
  gold:  '#c9a961',
  blue:  '#4a7eba',
  red:   '#c96161',
}

const AVATARS = Array.from({ length: 12 }, (_, i) => `pilot_${String(i + 1).padStart(2, '0')}`)

// Die drei Einweisungskarten: der Kernloop als Dreizeiler, Noxia-Ton.
const CARDS = [
  { icon: '🌍', title: 'Starte auf der Erde', text: 'Hier beginnt alles. Sieh dich um, bau deine erste Anlage, finde deinen Rhythmus.' },
  { icon: '🔴', title: 'Flieg zum Mars', text: 'Dort ist Wasser knapp — und Knappheit hat ihren Preis.' },
  { icon: '📈', title: 'Verkauf mit Gewinn', text: 'Und sieh zu, wie die Kolonie wächst. Sie wird sich erinnern.' },
]

type QuizQuestion = { domain: string; question: string; options: string[] }

export default function WelcomeSetup({ initialUsername, onDone }: { initialUsername?: string; onDone: (opts?: { openJourney?: boolean }) => void }) {
  const [step, setStep]       = useState<'setup' | 'quiz' | 'cards'>('setup')
  const [name, setName]       = useState(initialUsername ?? '')
  const [avatar, setAvatar]   = useState<string | null>(null)
  const [cardIdx, setCardIdx] = useState(0)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // ── Onboarding-Kalibrierungsquiz ──────────────────────────────────────────
  // Rein diagnostisch (siehe app/api/game/onboarding-quiz/route.ts) — kalibriert
  // nur profiles.knowledge_level, vergibt keine Unlocks. Jederzeit überspringbar.
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError]     = useState<string | null>(null)
  const [attemptId, setAttemptId]     = useState<string | null>(null)
  const [questions, setQuestions]     = useState<QuizQuestion[]>([])
  const [qIdx, setQIdx]               = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizSubmitting, setQuizSubmitting] = useState(false)

  const mono: React.CSSProperties = { fontFamily: "'Courier Prime', 'Courier New', monospace" }
  const canSave = name.trim().length >= 2 && avatar !== null

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true); setError(null)
    const token = await getToken()
    const res = await fetch(
      `/api/game/profile?action=setup&username=${encodeURIComponent(name.trim())}&avatar=${avatar}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    setSaving(false)
    if (data.error) { setError(data.error); return }
    setStep('quiz')
    loadQuiz()
  }

  async function loadQuiz() {
    setQuizLoading(true); setQuizError(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/game/onboarding-quiz', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.error || !Array.isArray(data.questions)) {
        setQuizError(data.error ?? 'Quiz nicht verfügbar.')
      } else {
        setAttemptId(data.attemptId)
        setQuestions(data.questions)
        setQuizAnswers(new Array(data.questions.length).fill(-1))
        setQIdx(0)
      }
    } catch {
      setQuizError('Quiz nicht verfügbar.')
    }
    setQuizLoading(false)
  }

  function answerQuiz(optionIdx: number) {
    const next = [...quizAnswers]
    next[qIdx] = optionIdx
    setQuizAnswers(next)
    if (qIdx < questions.length - 1) {
      setQIdx(qIdx + 1)
    } else {
      submitQuiz(next)
    }
  }

  async function submitQuiz(finalAnswers: number[]) {
    if (!attemptId || quizSubmitting) { setStep('cards'); return }
    setQuizSubmitting(true)
    try {
      const token = await getToken()
      await fetch('/api/game/onboarding-quiz', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, answers: finalAnswers }),
      })
    } catch {
      // Diagnostisch, nicht blockierend — bei Fehler trotzdem weiter.
    }
    setQuizSubmitting(false)
    setStep('cards')
  }

  function skipQuiz() {
    setStep('cards')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        {/* Logo-Zeile */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontWeight: 300, letterSpacing: '0.14em', color: C.gold, fontSize: '1.6rem' }}>
            noχ<sup style={{ fontSize: '0.45em' }}>1</sup>ᐃ
          </span>
        </div>

        {step === 'setup' && (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '1.8rem' }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: '0.2em', color: C.dim, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Pilotenregistrierung · Erde
            </div>
            <div style={{ ...mono, fontSize: 13, color: C.text, marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Ein Frachter wartet im Dock. 5.000 Credits auf dem Konto.
              Das Sonnensystem braucht Versorger.
            </div>

            {/* Name */}
            <label style={{ ...mono, fontSize: 10, letterSpacing: '0.15em', color: C.dim, textTransform: 'uppercase' }}>
              Rufzeichen
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              placeholder="Dein Pilotenname"
              style={{
                ...mono, display: 'block', width: '100%', boxSizing: 'border-box',
                marginTop: '0.4rem', marginBottom: '1.4rem', padding: '0.65rem 0.8rem',
                background: C.bg, border: `1px solid ${C.line}`, color: C.gold,
                fontSize: 15, outline: 'none', letterSpacing: '0.05em',
              }}
            />

            {/* Avatar-Raster */}
            <label style={{ ...mono, fontSize: 10, letterSpacing: '0.15em', color: C.dim, textTransform: 'uppercase' }}>
              Dienstfoto
            </label>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px',
              marginTop: '0.5rem', marginBottom: '1.4rem',
            }}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => setAvatar(a)} style={{
                  padding: 0, cursor: 'pointer', background: 'none',
                  border: avatar === a ? `2px solid ${C.gold}` : `2px solid ${C.line}`,
                  borderRadius: '4px', overflow: 'hidden', lineHeight: 0,
                  opacity: avatar === null || avatar === a ? 1 : 0.45,
                  transition: 'opacity 0.15s, border-color 0.15s',
                }}>
                  <img src={`/images/avatars/${a}.png`} alt={a} style={{ width: '100%', display: 'block' }} />
                </button>
              ))}
            </div>

            {error && (
              <div style={{ ...mono, fontSize: 11, color: C.red, marginBottom: '0.9rem' }}>{error}</div>
            )}

            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              style={{
                ...mono, width: '100%', padding: '0.8rem',
                background: canSave ? 'transparent' : 'transparent',
                border: `1px solid ${canSave ? C.gold : C.line}`,
                color: canSave ? C.gold : C.dim,
                fontSize: 13, letterSpacing: '0.1em', cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? '…' : 'Registrierung abschließen'}
            </button>
          </div>
        )}

        {step === 'quiz' && (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '1.8rem' }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: '0.2em', color: C.dim, textTransform: 'uppercase', marginBottom: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Kurzer Einstiegstest</span>
              <button onClick={skipQuiz} style={{ ...mono, background: 'none', border: 'none', color: C.dim, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'underline' }}>
                Überspringen →
              </button>
            </div>

            {quizLoading && (
              <div style={{ ...mono, fontSize: 13, color: C.dim }}>Fragen werden vorbereitet …</div>
            )}

            {!quizLoading && quizError && (
              <div>
                <div style={{ ...mono, fontSize: 12, color: C.dim, marginBottom: '1rem' }}>{quizError}</div>
              </div>
            )}

            {!quizLoading && !quizError && questions.length > 0 && (
              <>
                {qIdx === 0 && (
                  <div style={{ ...mono, fontSize: 13, color: C.text, marginBottom: '1.4rem', lineHeight: 1.6 }}>
                    Ein paar Fragen aus ganz unterschiedlichen Gebieten – hilft uns, die Akademie passend für dich einzustellen.
                  </div>
                )}

                <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.dim, marginBottom: '0.6rem', textTransform: 'uppercase' }}>
                  Frage {qIdx + 1} / {questions.length} · {questions[qIdx].domain}
                </div>
                <div style={{ ...mono, fontSize: 14, color: C.text, marginBottom: '1.2rem', lineHeight: 1.6 }}>
                  {questions[qIdx].question}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {questions[qIdx].options.map((opt, i) => (
                    <button
                      key={i}
                      disabled={quizSubmitting}
                      onClick={() => answerQuiz(i)}
                      style={{
                        ...mono, textAlign: 'left', padding: '0.65rem 0.9rem',
                        background: 'transparent', border: `1px solid ${C.line}`, color: C.text,
                        fontSize: 13, cursor: quizSubmitting ? 'default' : 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '1.2rem' }}>
                  {questions.map((_, i) => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: i === qIdx ? C.gold : (i < qIdx ? C.blue : C.line),
                    }} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {step === 'cards' && (
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, padding: '1.8rem', textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: '0.2em', color: C.dim, textTransform: 'uppercase', marginBottom: '1.6rem' }}>
              Einweisung {cardIdx + 1} / {CARDS.length}
            </div>

            <div style={{ fontSize: '2.2rem', marginBottom: '0.8rem' }}>{CARDS[cardIdx].icon}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', color: C.gold, marginBottom: '0.6rem' }}>
              {CARDS[cardIdx].title}
            </div>
            <div style={{ ...mono, fontSize: 13, color: C.text, lineHeight: 1.7, maxWidth: '380px', margin: '0 auto 1.8rem' }}>
              {CARDS[cardIdx].text}
            </div>

            {/* Fortschritts-Punkte */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1.6rem' }}>
              {CARDS.map((_, i) => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: i === cardIdx ? C.gold : C.line,
                }} />
              ))}
            </div>

            <button
              onClick={() => cardIdx < CARDS.length - 1 ? setCardIdx(cardIdx + 1) : onDone({ openJourney: true })}
              style={{
                ...mono, padding: '0.75rem 2.5rem',
                background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
                fontSize: 13, letterSpacing: '0.1em', cursor: 'pointer',
              }}
            >
              {cardIdx < CARDS.length - 1 ? 'Weiter →' : 'Nach Selmecke — Einstieg starten'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
