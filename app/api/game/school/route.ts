// app/api/game/school/route.ts
// Erstellt:     20.06.2026
// Aktualisiert: 21.06.2026 — Prompt Caching für statischen System-Prompt
// Version:      2.1.0
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
{"kind":"calc","question":"[1-3 Sätze Deutsch]","answer":[ganze Zahl],"explanation":"[1 Satz Lösung]","points":[10-25],"topic":"[Ressourcen|Handel|Navigation|Bevölkerung|Energie]"}

JSON-FORMAT für Wissensfrage:
{"kind":"quiz","question":"[Frage]","options":["[A]","[B]","[C]","[D]"],"correct":[0-3],"explanation":"[1 Satz]","points":[15-25],"topic":"[Sonnensystem|Physik|Ressourcen|Navigation]"}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { level = 1, isDaily = false, seed = '', colonyContext } = body

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API-Key fehlt' }, { status: 500 })

    const difficulty = DIFFICULTY[Math.min(6, Math.max(1, level))] ?? DIFFICULTY[1]
    const doQuiz     = Math.random() < 0.45
    const dailyHint  = isDaily ? '\nDies ist die TAGESAUFGABE — besonders interessant.' : ''
    const seedHint   = seed ? `\nZufalls-ID: ${seed} (andere Aufgabe als letzte generieren)` : ''

    // Varibler User-Prompt (nicht gecacht)
    const userPrompt = doQuiz
      ? `Erstelle eine Wissensfrage über Sonnensystem, Physik oder Spielmechaniken.
Schwierigkeit: ${difficulty}.
Wähle ein Thema: Sonnensystem, Physik, Ressourcen, Navigation.${dailyHint}${seedHint}`
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
