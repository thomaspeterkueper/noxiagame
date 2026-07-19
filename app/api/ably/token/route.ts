// app/api/ably/token/route.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Ably Token-Endpoint für Client-Auth
// Version:      1.1.0
//
// Client holt sich hier ein kurzlebiges Ably-Token (TTL: 3600s).
// Nur für authentifizierte NOXIA-User.
// ABLY_API_KEY muss als Vercel Environment Variable gesetzt sein.

import { NextRequest, NextResponse } from 'next/server'
import Ably from 'ably'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Ably nicht konfiguriert' },
      { status: 503 }
    )
  }

  // Auth: JWT aus Authorization Header
  const authHeader = req.headers.get('authorization')
  const jwt = authHeader?.replace('Bearer ', '')

  if (!jwt) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  // User aus JWT verifizieren
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) {
    return NextResponse.json({ error: 'Ungültiges Token' }, { status: 401 })
  }

  // Ably Token mit User-ID als clientId erstellen
  const rest = new Ably.Rest({ key: apiKey })
  const tokenRequest = await rest.auth.createTokenRequest({
    clientId: user.id,
    ttl: 3600 * 1000, // 1 Stunde in ms
    capability: {
      'noxia:prices':       ['subscribe'],
      'noxia:transactions': ['subscribe'],
      'noxia:world':        ['subscribe'],
      [`noxia:builds:${user.id}`]: ['subscribe'],
    },
  })

  return NextResponse.json(tokenRequest)
}
