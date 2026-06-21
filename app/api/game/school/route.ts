// app/api/game/school/route.ts
// Erstellt: 20.06.2026
//
// Proxy für Aufgaben-Generierung — ruft Anthropic API serverseitig auf
// (API-Key ist nur server-seitig verfügbar, nicht im Browser).
//
// POST body: { prompt: string }
// Response:  { task: Task } | { error: string }

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Kein Prompt' }, { status: 400 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return NextResponse.json({ error: 'API-Fehler' }, { status: 502 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const task = JSON.parse(clean)

    return NextResponse.json({ task })
  } catch (e) {
    console.error('School route error:', e)
    return NextResponse.json({ error: 'Generierung fehlgeschlagen' }, { status: 500 })
  }
}
