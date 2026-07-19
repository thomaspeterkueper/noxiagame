// app/api/game/friends/route.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Freundesliste + Freundschaftsanfragen
// Version:      1.0.0
//
// GET  ?action=list         — eigene Freunde
// GET  ?action=requests     — ausstehende Anfragen
// GET  ?action=search&q=X   — Spieler suchen
// POST action=add            — Freundschaftsanfrage senden
// POST action=accept         — Anfrage annehmen
// POST action=remove         — Freundschaft entfernen

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getUserFromRequest } from '@/lib/supabase/auth'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createServiceClient()
  const action = req.nextUrl.searchParams.get('action') ?? 'list'

  // ── Freundesliste ─────────────────────────────────────────────────────────
  if (action === 'list') {
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:profiles!requester_id(id, username), addressee:profiles!addressee_id(id, username)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted')

    const friends = (data ?? []).map((f: any) => {
      const friend = f.requester_id === user.id ? f.addressee : f.requester
      return { id: friend.id, username: friend.username }
    })

    return NextResponse.json({ friends })
  }

  // ── Ausstehende Anfragen ──────────────────────────────────────────────────
  if (action === 'requests') {
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:profiles!requester_id(id, username)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')

    return NextResponse.json({ requests: data ?? [] })
  }

  // ── Spieler suchen ────────────────────────────────────────────────────────
  if (action === 'search') {
    const q = req.nextUrl.searchParams.get('q')?.trim()
    if (!q || q.length < 2) return NextResponse.json({ results: [] })

    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${q}%`)
      .neq('id', user.id)
      .limit(10)

    return NextResponse.json({ results: data ?? [] })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json() as Record<string, unknown>
  const action = body.action as string

  // ── Freundschaftsanfrage senden ───────────────────────────────────────────
  if (action === 'add') {
    const addresseeId = body.addresseeId as string
    if (!addresseeId) return NextResponse.json({ error: 'addresseeId fehlt' }, { status: 400 })
    if (addresseeId === user.id) return NextResponse.json({ error: 'Kann nicht sich selbst hinzufügen' }, { status: 400 })

    // Prüfen ob bereits vorhanden
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Anfrage bereits vorhanden oder bereits befreundet', status: existing.status }, { status: 409 })
    }

    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' })
    return NextResponse.json({ ok: true })
  }

  // ── Anfrage annehmen ──────────────────────────────────────────────────────
  if (action === 'accept') {
    const requesterId = body.requesterId as string
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', requesterId)
      .eq('addressee_id', user.id)
      .eq('status', 'pending')

    return NextResponse.json({ ok: true })
  }

  // ── Freundschaft entfernen ────────────────────────────────────────────────
  if (action === 'remove') {
    const otherId = body.otherId as string
    await supabase
      .from('friendships')
      .delete()
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${user.id})`)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
