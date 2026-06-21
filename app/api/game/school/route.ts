// app/api/game/school/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Kein Prompt' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API-Key fehlt' }, { status: 500 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic error:', JSON.stringify(data))
      return NextResponse.json({ error: data.error?.message ?? 'API-Fehler', detail: data }, { status: 502 })
    }

    const text = data.content?.[0]?.text ?? ''
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
