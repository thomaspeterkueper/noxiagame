// app/api/game/school/route.ts
// Erstellt:     20.06.2026
// Aktualisiert: 24.08.2026 — Server-seitige Shape-Validierung der KI-Antwort:
//               JSON.parse allein garantiert nicht, dass das Objekt die von
//               SchoolOverlay erwartete Task-Form hat (z.B. quiz ohne
//               options-Array). Ungültige Form crashte beim Rendern, nicht
//               beim Laden — Server meldete 200, Seite brach erst beim
//               Anzeigen der Aufgabe ab. Fix: isValidTask() prüft die Form
//               vor der Antwort; bei Verstoß Fallback-Task statt Absturz.
// Version:      2.7.0
//
// v2.6.0: POST → GET (Turbopack-POST-Bug, siehe Tech-Setup "Bekannte
// Probleme #2"). Body-Parameter (level, isDaily, seed, colonyContext) sind
// seitdem Query-Parameter.
//
// Prompt Caching: statischer System-Prompt (Spielregeln, JSON-Format) wird
// gecacht. Nur der variable Teil (Kolonie-Kontext, Schwierigkeit, Seed)
// wechselt pro Request → ~10× günstiger nach erstem Call.

import { NextRequest, NextResponse } from 'next/server'

const DIFFICULTY: Record<number, string> = {
  1: 'sehr einfach (Grundschule): nur Addition und Subtraktion, kleine Zahlen',
  2: 'einfach (Klasse 5-6): Multiplikation, Division, Zahlen bis 1000',
  3: 'mittel (Klasse 7-8): Prozentrechnung, Proportionen, mehrstufige Aufgaben',
  4: 'anspruchsvoll (Klasse 8): komplexe Prozente, Kettenrechnungen',
  5: 'schwer (Oberstufe-Niveau): Optimierung, mehrere Variablen, Umwegaufgaben',
  6: 'Experte: knifflige Aufgaben die Überblick über alle Spielmechaniken erfordern',
}

// Fallback, falls die KI-Antwort kein valides JSON oder die falsche Form hat.
// Bewusst dieselben Fragen wie der Client-seitige fallbackTask() in
// SchoolOverlay.tsx — Duplikat statt Import, da Route und Client getrennte
// Bundles sind und dies nur der Notfall-Pfad ist.
function serverFallbackTask() {
  const tasks = [
    { kind: 'calc', question: 'Ein Frachter kauft 80 Tonnen Wasser für 95 Cr/t und verkauft sie für 155 Cr/t. Wie viel Gewinn macht er?', answer: 4800, explanation: '80 × (155 − 95) = 4.800 Cr', points: 15, topic: 'Handel' },
    { kind: 'quiz', question: 'Warum kostet Erde→Mond mehr Energie als Mond→Erde?', options: ['Mond ist weiter weg', 'Erdgravitation muss überwunden werden', 'Mond hat stärkere Gravitation', 'Wasser ist schwerer'], correct: 1, explanation: 'Die Erde besitzt den tieferen Gravitationsbrunnen.', points: 20, topic: 'Physik' },
    { kind: 'calc', question: 'Eine Mine produziert 5 Metall/Tick. Wie viel Metall entsteht in 6 Ticks?', answer: 30, explanation: '5 × 6 = 30 Metall.', points: 10, topic: 'Ressourcen' },
  ]
  return tasks[Math.floor(Math.random() * tasks.length)]
}

// Prüft, ob das geparste Objekt wirklich die Form hat, die SchoolOverlay
// beim Rendern erwartet (CalcTask | QuizTask). JSON.parse allein reicht
// nicht — ein syntaktisch valides Objekt kann trotzdem die falsche Form haben.
function isValidTask(t: any): boolean {
  if (!t || typeof t !== 'object') return false
  if (typeof t.question !== 'string' || !t.question.trim()) return false
  if (typeof t.explanation !== 'string' || !t.explanation.trim()) return false
  if (typeof t.points !== 'number' || !Number.isFinite(t.points)) return false
  if (typeof t.topic !== 'string' || !t.topic.trim()) return false

  if (t.kind === 'calc') {
    return typeof t.answer === 'number' && Number.isFinite(t.answer)
  }
  if (t.kind === 'quiz') {
    return Array.isArray(t.options) && t.options.length >= 2
      && t.options.every((o: any) => typeof o === 'string')
      && typeof t.correct === 'number'
      && Number.isInteger(t.correct)
      && t.correct >= 0 && t.correct < t.options.length
  }
  return false
}

// Statischer System-Prompt — wird gecacht (ändert sich nie)
const SYSTEM_PROMPT = `Du bist Aufgabengenerator für das Weltraum-Handelsspiel Noxia.

SPIELKONTEXT:
- Spieler handeln Ressourcen (Wasser, Energie, Metall) zwischen Stationen im Sonnensystem
- Stationen: Erde (Startpunkt, günstig), Mond (Metall-Produzent), Mars (Wasser-Defizit), Phobos (Konsument)
- Frachter fasst max. 100 Tonnen Nutzlast
- Flüge kosten Energie aus dem Laderaum (Erde→Mond: 20t, Mond→Mars: 12t, Mars→Phobos: 4t)
- Beispielpreise: Wasser Mond 130/95 Cr, Mars 200/155 Cr · Metall Mond 35/25 Cr, Mars 75/58 Cr

AUFGABEN-REGELN:
- Antwort NUR als JSON, kein Markdown, keine Erklärung drumherum
- Rechenaufgaben: Antwort MUSS eine ganze Zahl sein
- Mengen in Handelssaufgaben IMMER ≤ 100 Tonnen (Frachterkapazität)
- Keine Algebra, Gleichungen, Wurzeln oder Potenzen

JSON-FORMAT für Rechenaufgabe:
WICHTIG: Rechne das Ergebnis selbst nach bevor du antwortest!
{"kind":"calc","question":"[1-3 Sätze Deutsch]","answer":[ganze Zahl],"explanation":"[1 Satz Lösung]","points":[10-25],"topic":"[Ressourcen|Handel|Navigation|Bevölkerung|Energie]"}

JSON-FORMAT für Wissensfrage:
{"kind":"quiz","question":"[Frage]","options":["[A]","[B]","[C]","[D]"],"correct":[0-3],"explanation":"[1 Satz]","points":[15-25],"topic":"[Sonnensystem|Physik|Ressourcen|Navigation]"}`

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const level    = parseInt(searchParams.get('level') ?? '1', 10) || 1
    const isDaily  = searchParams.get('isDaily') === 'true'
    const seed     = searchParams.get('seed') ?? ''
    const colonyContext = {
      locationName: searchParams.get('locationName') ?? undefined,
      population:   searchParams.get('population')   ? Number(searchParams.get('population'))   : undefined,
      waterStock:   searchParams.get('waterStock')    ? Number(searchParams.get('waterStock'))    : undefined,
      waterCons:    searchParams.get('waterCons')     ? Number(searchParams.get('waterCons'))     : undefined,
      credits:      searchParams.get('credits')       ? Number(searchParams.get('credits'))       : undefined,
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY fehlt')
      return NextResponse.json({ task: serverFallbackTask(), fallbackReason: 'no_api_key' })
    }

    const difficulty = DIFFICULTY[Math.min(6, Math.max(1, level))] ?? DIFFICULTY[1]
    const doQuiz     = Math.random() < 0.60  // 60% Wissensfragen, 40% Rechenaufgaben
    const dailyHint  = isDaily ? '\nDies ist die TAGESAUFGABE — besonders interessant.' : ''
    const seedHint   = seed ? `\nZufalls-ID: ${seed} (andere Aufgabe als letzte generieren)` : ''

    // Varibler User-Prompt (nicht gecacht)
    const userPrompt = doQuiz
      ? `Erstelle eine abwechslungsreiche Wissensfrage. Wähle ZUFÄLLIG eines dieser Themen:
- Sonnensystem: Planeten, Monde, Abstände, Orbits, Gravitationsfelder
- Physik: Escape-Velocity, Treibstoffverbrauch, Trägheit, Strahlung im Weltall
- Geschichte: Raumfahrtmeilensteine, Missionen, Astronauten, Raumstationen
- Biologie: Leben im Weltall, Strahlung, Knochenschwund, Psychologie
- Wirtschaft: Handelsrouten, Arbitrage, Angebot/Nachfrage, Preisentstehung
- Navigation: Lagrange-Punkte, Hohmann-Transfer, Rendezvous, Docking
Schwierigkeit: ${difficulty}. Frage soll überraschend und lehrreich sein.${dailyHint}${seedHint}`
      : `Erstelle eine Rechenaufgabe. Schwierigkeit: ${difficulty}.
Kolonie-Kontext (verwende diese Zahlen, zeige sie nicht als Label):
Station: ${colonyContext?.locationName ?? 'unbekannt'} · Bevölkerung: ${colonyContext?.population ?? 0}
Wasserlager: ${colonyContext?.waterStock ?? 0}t · Verbrauch: ${colonyContext?.waterCons ?? 0}t/h
Credits: ${colonyContext?.credits ?? 0} Cr
Wähle ein Thema: Ressourcen, Handel, Navigation, Bevölkerung, Energie.${dailyHint}${seedHint}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: [
          {
            type:          'text',
            text:          SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },  // gecacht für 5 Minuten
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return NextResponse.json({ task: serverFallbackTask(), fallbackReason: 'api_error' })
    }

    const text  = data.content?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()

    let parsed: any
    try {
      parsed = JSON.parse(clean)
    } catch {
      console.error('JSON parse error:', clean)
      return NextResponse.json({ task: serverFallbackTask(), fallbackReason: 'parse_error' })
    }

    if (!isValidTask(parsed)) {
      console.error('Task-Shape ungültig:', JSON.stringify(parsed))
      return NextResponse.json({ task: serverFallbackTask(), fallbackReason: 'invalid_shape' })
    }

    return NextResponse.json({ task: parsed })

  } catch (e: any) {
    console.error('School route exception:', e)
    return NextResponse.json({ task: serverFallbackTask(), fallbackReason: 'exception' })
  }
}
