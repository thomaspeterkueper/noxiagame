// app/api/game/onboarding-quiz/route.ts
// Onboarding-Kalibrierungsquiz: 6-7 von Claude generierte, fachlich
// unterschiedliche Allgemeinwissensfragen direkt nach der Registrierung.
// Rein diagnostisch, nicht spielbezogen -- anders als app/api/game/school/
// route.ts, das denselben Claude-Aufruf-Mechanismus fuer laufende
// Akademie-Aufgaben nutzt. Ergebnis kalibriert nur profiles.knowledge_level
// (die Akademie-Schwierigkeitsstufe 1-6), vergibt KEINE UNL:NOX:*-Unlocks --
// das bleibt getrennt (siehe lib/knowledge/unlockRegistry.ts).
//
// GET  erzeugt einen Versuch: Fragen (inkl. Loesung) liegen serverseitig in
//      onboarding_quiz_attempts, der Client bekommt nur die Fragen OHNE
//      Loesung zurueck.
// POST wertet einen Versuch aus: vergleicht die eingereichten Antworten mit
//      der serverseitig gespeicherten Loesung, leitet eine Stufe 1-6 ab und
//      schreibt sie nach profiles.knowledge_level (+ optional age_range).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const QUESTION_COUNT = 7

const DOMAINS = [
  'Mathematik (Kopfrechnen, keine Algebra)',
  'Physik (Alltagsphaenomene, keine Formeln)',
  'Chemie/Biologie (Grundlagen)',
  'Astronomie/Geographie (Sonnensystem, Planeten, Erde)',
  'Geschichte (grosse Linien, keine Jahreszahlen-Details)',
  'Logik/Allgemeinwissen (Schlussfolgern, Alltagswissen)',
  'Sprache/Mathematik gemischt (z.B. einfache Potenzen, Verhaeltnisse)',
]

type RawQuestion = { domain: string; question: string; options: string[]; correct: number }

async function getUserFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function fallbackQuestions(): RawQuestion[] {
  // Notfall-Satz, falls die KI-Antwort fehlschlaegt -- bewusst breit gestreut,
  // damit auch der Fallback "wirklich aus unterschiedlichen Gebieten" ist.
  return [
    { domain: 'Mathematik', question: 'Was ist 3 hoch 3?', options: ['9', '27', '33', '81'], correct: 1 },
    { domain: 'Astronomie', question: 'Welcher Planet liegt zwischen Merkur und der Erde?', options: ['Mars', 'Venus', 'Jupiter', 'Saturn'], correct: 1 },
    { domain: 'Chemie', question: 'Woraus besteht ein Atomkern hauptsächlich?', options: ['Elektronen', 'Protonen und Neutronen', 'Photonen', 'Ionen'], correct: 1 },
    { domain: 'Geographie', question: 'Welcher Ozean ist der größte?', options: ['Atlantik', 'Indischer Ozean', 'Pazifik', 'Nordpolarmeer'], correct: 2 },
    { domain: 'Geschichte', question: 'In welchem Jahrhundert begann die erste bemannte Raumfahrt?', options: ['19. Jahrhundert', '20. Jahrhundert', '21. Jahrhundert', '18. Jahrhundert'], correct: 1 },
    { domain: 'Logik', question: 'Wenn alle Katzen Tiere sind und Minka eine Katze ist, ist Minka dann ein Tier?', options: ['Ja', 'Nein', 'Nicht zu sagen', 'Nur manchmal'], correct: 0 },
    { domain: 'Physik', question: 'Warum schwebt man in der Internationalen Raumstation?', options: ['Es gibt dort keine Schwerkraft', 'Die Station befindet sich im freien Fall um die Erde', 'Die Luft dort ist zu dünn', 'Magnete halten alles in der Schwebe'], correct: 1 },
  ]
}

const SYSTEM_PROMPT = `Du erstellst ein kurzes, diagnostisches Allgemeinwissens-Quiz fuer ein neues Spielerprofil (nicht spielbezogen).

REGELN:
- Genau ${QUESTION_COUNT} Fragen, JEDE aus einem ANDEREN Fachgebiet -- keine zwei Fragen aus demselben Gebiet.
- Multiple Choice, genau 4 Optionen, genau eine richtig.
- Alltagstauglich, kein Spezialwissen, keine Jahreszahlen-Details, keine Formeln/Algebra.
- Mische leichte und etwas anspruchsvollere Fragen, damit sich grobe Niveauunterschiede zeigen.
- Antwort NUR als JSON-Array, kein Markdown, keine Erklaerung drumherum.
- Format pro Frage: {"domain":"[Fachgebiet]","question":"[Frage]","options":["A","B","C","D"],"correct":[0-3]}
- WICHTIG: "correct" ist der Index der tatsaechlich richtigen Antwort -- pruefe das selbst nach.`

function isValidQuestion(q: any): q is RawQuestion {
  return q && typeof q === 'object'
    && typeof q.domain === 'string' && q.domain.trim()
    && typeof q.question === 'string' && q.question.trim()
    && Array.isArray(q.options) && q.options.length === 4 && q.options.every((o: any) => typeof o === 'string')
    && typeof q.correct === 'number' && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4
}

async function generateQuestions(): Promise<{ questions: RawQuestion[]; fallback: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { questions: fallbackQuestions(), fallback: true }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Erstelle das Quiz. Deck dabei moeglichst diese Gebiete ab (eines pro Frage, Reihenfolge beliebig): ${DOMAINS.join(' / ')}` }],
      }),
    })
    const data = await response.json()
    if (!response.ok) return { questions: fallbackQuestions(), fallback: true }

    const text = data.content?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    if (!Array.isArray(parsed) || parsed.length < 5 || !parsed.every(isValidQuestion)) {
      return { questions: fallbackQuestions(), fallback: true }
    }
    return { questions: parsed.slice(0, QUESTION_COUNT), fallback: false }
  } catch {
    return { questions: fallbackQuestions(), fallback: true }
  }
}

function levelFromScore(score: number, total: number) {
  const ratio = total > 0 ? score / total : 0
  if (ratio >= 0.95) return 6
  if (ratio >= 0.8) return 5
  if (ratio >= 0.6) return 4
  if (ratio >= 0.4) return 3
  if (ratio >= 0.2) return 2
  return 1
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { questions } = await generateQuestions()

  const { data: attempt, error } = await supabase
    .from('onboarding_quiz_attempts')
    .insert({ profile_id: user.id, questions })
    .select('id')
    .single()

  if (error || !attempt) {
    return NextResponse.json({ error: 'Quiz konnte nicht erstellt werden.' }, { status: 503 })
  }

  return NextResponse.json({
    attemptId: attempt.id,
    questions: questions.map(q => ({ domain: q.domain, question: q.question, options: q.options })),
  })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const attemptId = typeof body.attemptId === 'string' ? body.attemptId : null
  const answers: unknown = body.answers
  const ageRange = typeof body.ageRange === 'string' && body.ageRange.trim() ? body.ageRange.trim() : null

  if (!attemptId || !Array.isArray(answers)) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: attempt } = await supabase
    .from('onboarding_quiz_attempts')
    .select('id, profile_id, questions, completed_at')
    .eq('id', attemptId)
    .maybeSingle()

  if (!attempt || attempt.profile_id !== user.id) {
    return NextResponse.json({ error: 'Quiz-Versuch nicht gefunden.' }, { status: 404 })
  }
  if (attempt.completed_at) {
    return NextResponse.json({ error: 'Dieser Versuch wurde bereits ausgewertet.' }, { status: 400 })
  }

  const questions = attempt.questions as RawQuestion[]
  let score = 0
  questions.forEach((q, i) => { if (answers[i] === q.correct) score += 1 })
  const level = levelFromScore(score, questions.length)

  await supabase.from('onboarding_quiz_attempts').update({
    completed_at: new Date().toISOString(),
    score,
    derived_level: level,
  }).eq('id', attemptId)

  await supabase.from('profiles').update({
    knowledge_level: level,
    ...(ageRange ? { age_range: ageRange } : {}),
  }).eq('id', user.id)

  return NextResponse.json({ score, total: questions.length, level })
}
