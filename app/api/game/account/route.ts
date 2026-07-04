// app/api/game/account/route.ts
// Erstellt:     04.07.2026
// Aktualisiert: 04.07.2026 — Initiale Version: Account-Löschung
// Version:      0.1.0
//
// POST ?action=delete — löscht den Supabase-Auth-Account des Spielers.
// Alle DB-Daten (profiles, tile_entities etc.) werden via CASCADE gelöscht.
// Erfordert gültigen Bearer Token.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action !== 'delete') {
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  }

  // Account löschen — CASCADE entfernt profiles, tile_entities, bank_accounts etc.
  const { error } = await serviceClient.auth.admin.deleteUser(user.id)

  if (error) {
    console.error('account/delete error:', error)
    return NextResponse.json({ error: 'Fehler beim Löschen des Accounts.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
