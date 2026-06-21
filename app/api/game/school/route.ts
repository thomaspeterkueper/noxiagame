// app/api/game/school/route.ts
// Erstellt:     20.06.2026
// Aktualisiert: 21.06.2026 — level-Parameter für Schwierigkeit, daily-Modus
// Version:      2.0.0

import { NextRequest, NextResponse } from 'next/server'

// Schwierigkeitsbeschreibungen je Level
const DIFFICULTY: Record<number, string> = {
  1: 'sehr einfach (Grundschule): nur Addition und Subtraktion, kleine Zahlen',
  2: 'einfach (Klasse 5-6): Multiplikation, Division, Zahlen bis 1000',
  3: 'mittel (Klasse 7-8): Prozentrechnung, Proportionen, mehrstufige Aufgaben',
  4: 'anspruchsvoll (Klasse 8): komplexe Prozente, Kettenrechnungen',
  5: 'schwer (Oberstufe-Niveau): Optimierung, mehrere Variablen, Umwegaufgaben',
  6: 'Experte: knifflige Aufgaben die Überblick über alle Spielmechaniken erfordern',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, level = 1, isDaily = false } = body

    if (!prompt) return NextResponse.json({ error: 'Kein Prompt' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API-Key fehlt' }, { status: 500 })

    // Schwierigkeit in den Prompt einbauen
    const difficulty = DIFFICULTY[Math.min(6, Math.max(1, level))] ?? DIFFICULTY[1]
    const dailyHint  = isDaily ? '\nDies ist die TAGESAUFGABE — besonders interessant und etwas länger als normal.' : ''

    const enrichedPrompt = prompt
      .replace('Schwierigkeit: maximal 8. Schuljahr.', `Schwierigkeit: ${difficulty}.`)
      + dailyHint

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
        messages:   [{ role: 'user', content: enrichedPrompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return NextResponse.json({ error: data.error?.message ?? 'API-Fehler' }, { status: 502 })
    }

    const text  = data.content?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const task = JSON.parse(clean)
      return NextResponse.json({ task })
    } catch {
      console.error('JSON parse error:', clean)
      return NextResponse.json({ error: 'JSON-Parse-Fehler', raw: clean }, { status: 500 })
    }

  } catch (e: any) {
    console.error('School route exception:', e)
    return NextResponse.json({ error: e.message ?? 'Unbekannter Fehler' }, { status: 500 })
  }
}
