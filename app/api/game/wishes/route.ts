// app/api/game/wishes/route.ts
// Wunsch oder Gebet hinterlegen (Thomas, 29.10.2026: Wünsche, die die Welt erhört).
// POST { text, channel, placeRef?, placeName?, tradition?, location? }
// Antwort ohne Entscheidung im Detail – die Welt erklärt nichts. Nur bei einer
// Notlage kommt ein Hinweis auf Hilfe zurück.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { submitWish } from '@/lib/game/wishes/service.server'
import { WISH_CHANNELS, type WishChannel } from '@/lib/game/wishes/rules'

const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const text = clean(body.text, 280)
  if (text.length < 3) return NextResponse.json({ error: 'Bitte ein paar Worte.' }, { status: 400 })
  const channel = (WISH_CHANNELS as readonly string[]).includes(String(body.channel)) ? body.channel as WishChannel : 'fuerbitte'
  const supabase = createServiceClient()
  // Höchstens 10 Wünsche je Spieler und Tag – gegen Überflutung.
  const { count } = await supabase.from('wishes').select('id', { count: 'exact', head: true }).eq('profile_id', profileId).gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
  if ((count ?? 0) >= 10) return NextResponse.json({ ok: true, quiet: true, message: 'Für heute ist genug gesagt. Morgen ist wieder Raum.' })
  try {
    const result = await submitWish(supabase, {
      source: 'player', profileId, channel, text,
      placeRef: clean(body.placeRef, 120) || null, placeName: clean(body.placeName, 120) || null,
      tradition: clean(body.tradition, 40) || null, locationSlug: clean(body.location, 40) || 'earth',
    })
    return NextResponse.json({ ok: true, ...(result.help ? { help: result.help } : {}) })
  } catch (error) {
    console.error('wish submit failed', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Gerade nicht möglich.' }, { status: 500 })
  }
}
