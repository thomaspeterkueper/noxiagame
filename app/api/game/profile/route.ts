// route.ts
// Aktualisiert: 23.06.2026 — flight_count im Profil ausgeben
// Version:      0.3.0
// app/api/game/profile/route.ts
// Erstellt:     07.06.2026
// Aktualisiert: 23.06.2026 17:05 — flight_count im Profil ausgeben
// Profil laden + Onboarding-Setup (Name, Avatar) + Erstauftrag erzeugen
// Pattern wie alle Game-Routes: GET mit Query-Parametern, Bearer-Auth.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AVATARS = Array.from({ length: 12 }, (_, i) => `pilot_${String(i + 1).padStart(2, '0')}`)

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // ── Profil laden ──
  if (!action) {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, username, avatar, onboarded, credits, flight_count')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ profile })
  }

  // ── Setup: Name + Avatar speichern, Erstauftrag erzeugen ──
  if (action === 'setup') {
    const username = (searchParams.get('username') ?? '').trim()
    const avatar   = searchParams.get('avatar') ?? ''

    // Validierung
    if (username.length < 2 || username.length > 20) {
      return NextResponse.json({ error: 'Name muss 2–20 Zeichen lang sein.' }, { status: 400 })
    }
    if (!/^[\p{L}\p{N} _\-]+$/u.test(username)) {
      return NextResponse.json({ error: 'Name enthält ungültige Zeichen.' }, { status: 400 })
    }
    if (!AVATARS.includes(avatar)) {
      return NextResponse.json({ error: 'Ungültiger Avatar.' }, { status: 400 })
    }

    // Name eindeutig? (case-insensitive, eigener Account ausgenommen)
    const { data: taken } = await serviceClient
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .neq('id', user.id)
      .limit(1)

    if (taken && taken.length > 0) {
      return NextResponse.json({ error: 'Dieser Name ist bereits vergeben.' }, { status: 400 })
    }

    const { error: updErr } = await serviceClient
      .from('profiles')
      .update({ username, avatar, onboarded: true })
      .eq('id', user.id)

    if (updErr) {
      return NextResponse.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 })
    }

    // ── Startpunkt Erde + Startenergie (20t Subvention) ──────────────────────
    const { data: playerShip } = await serviceClient
      .from('ships')
      .select('id')
      .eq('profile_id', user.id)
      .single()

    if (playerShip) {
      // Schiff auf Erde setzen + als aktives Schiff markieren
      await serviceClient
        .from('ships')
        .update({ location: 'earth', is_active: true })
        .eq('id', playerShip.id)

      // active_ship_id in profiles setzen
      await serviceClient
        .from('profiles')
        .update({ active_ship_id: playerShip.id })
        .eq('id', user.id)

      // 20t Startenergie (Erdsubvention für ersten Flug Erde→Mond)
      await serviceClient.rpc('grant_starting_energy', { p_ship_id: playerShip.id })
    }

    // ── Erstauftrag erzeugen (genau einmal) ──
    // 20t Wasser nach Phobos. Mit Startkapital (5.000 Cr) sicher machbar:
    // Einkauf Mond ~90 Cr × 20t = 1.800 Cr. Belohnung: Phobos-Verkaufspreis × 1.3.
    const { data: existing } = await serviceClient
      .from('trade_orders')
      .select('id')
      .eq('for_profile_id', user.id)
      .limit(1)

    if (!existing || existing.length === 0) {
      const { data: phobos } = await serviceClient
        .from('locations')
        .select('id')
        .eq('slug', 'phobos')
        .single()

      if (phobos) {
        const { data: price } = await serviceClient
          .from('market_prices')
          .select('sell_price')
          .eq('location_id', phobos.id)
          .eq('resource', 'water')
          .single()

        const reward = Math.round((price?.sell_price ?? 75) * 1.3)
        const expires = new Date()
        expires.setDate(expires.getDate() + 7)   // großzügig: 7 Tage statt 24h

        await serviceClient.from('trade_orders').insert({
          location_id:    phobos.id,
          resource:       'water',
          amount:         20,
          reward,                                  // Cr pro Tonne
          status:         'open',
          expires_at:     expires.toISOString(),
          for_profile_id: user.id,
        })
      }
    }

    // ── moon_colony Journey automatisch starten ──────────────────────────────
    // Spieler startet immer mit dem vertikalen Pfad Erde → Mond.
    // Nur wenn noch keine Journey existiert (idempotent).
    const { data: existingJourney } = await serviceClient
      .from('player_journeys')
      .select('id')
      .eq('profile_id', user.id)
      .eq('journey_key', 'moon_colony')
      .limit(1)

    if (!existingJourney || existingJourney.length === 0) {
      await serviceClient.from('player_journeys').insert({
        profile_id:  user.id,
        journey_key: 'moon_colony',
        title:       'Mondbasis gründen',
        status:      'active',
        selected:    true,
        progress:    0,
        progress_max: 4,
        started_at:  new Date().toISOString(),
      })
    }

    return NextResponse.json({ ok: true, username, avatar })
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
}