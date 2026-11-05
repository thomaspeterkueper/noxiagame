// app/api/game/readings/route.ts
// Schriften der Begegnungsstätte (05.11.2026). Wortlaut aus buecherwelten, Freigabe aus
// reading_releases (Adminbereich). Leseproben werden hier gekürzt.
// GET                         – Liste der freigegebenen Schriften (ohne Wortlaut)
// GET ?book=<text|work>:<slug> – ein Buch mit den freigegebenen Kapiteln

import { NextRequest, NextResponse } from 'next/server'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { BuecherweltenUnavailable, buecherweltenConfigured } from '@/lib/game/readings/buecherwelten.server'
import { releasedDocument, releasedList } from '@/lib/game/readings/releases.server'

const UNAVAILABLE = { error: 'Die Schriften werden gerade eingeräumt.', code: 'source_unavailable' }

export async function GET(req: NextRequest) {
  if (!await verifiedBearerUserId(req)) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  if (!buecherweltenConfigured()) return NextResponse.json(UNAVAILABLE, { status: 503 })
  const book = req.nextUrl.searchParams.get('book')
  try {
    if (book) {
      const match = /^(text|work):([a-z0-9][a-z0-9-]{0,120})$/.exec(book)
      if (!match) return NextResponse.json({ error: 'Unbekanntes Buch' }, { status: 400 })
      const document = await releasedDocument(match[1] as 'text' | 'work', match[2])
      if (!document) return NextResponse.json({ error: 'Diese Schrift steht hier nicht im Regal.' }, { status: 404 })
      return NextResponse.json({ document }, { headers: { 'Cache-Control': 'private, max-age=300' } })
    }
    return NextResponse.json({ books: await releasedList() }, { headers: { 'Cache-Control': 'private, max-age=120' } })
  } catch (error) {
    if (error instanceof BuecherweltenUnavailable) {
      console.error('[readings] buecherwelten nicht erreichbar:', error.message)
      return NextResponse.json(UNAVAILABLE, { status: 503 })
    }
    console.error('[readings]', error)
    return NextResponse.json({ error: 'Die Schriften sind gerade nicht erreichbar.' }, { status: 500 })
  }
}
