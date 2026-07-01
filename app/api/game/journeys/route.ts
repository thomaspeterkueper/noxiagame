// app/api/game/journeys/route.ts
// Erstellt: 01.07.2026
// Version: 0.1.0

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const JOURNEY_TITLES: Record<string, string> = {
  moon_colony: 'Mondbasis gründen',
  merchant: 'Handel & Logistik',
  research: 'Forschung aufbauen',
  industry: 'Industrie errichten',
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const serviceClient = createServiceClient()
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: journeys, error } = await serviceClient
    .from('player_journeys')
    .select('*')
    .eq('profile_id', user.id)
    .eq('selected', true)
    .order('started_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Journeys konnten nicht geladen werden.', detail: error.message }, { status: 500 })
  }

  const keys = (journeys ?? []).map(j => j.journey_key)
  const { data: steps } = keys.length > 0
    ? await serviceClient
        .from('journey_steps')
        .select('*')
        .in('journey_key', keys)
        .order('step_order', { ascending: true })
    : { data: [] }

  return NextResponse.json({ journeys: journeys ?? [], steps: steps ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const journeyKey = String(body.journeyKey ?? '')
  const title = JOURNEY_TITLES[journeyKey]

  if (!title) {
    return NextResponse.json({ error: 'Unbekannter Weg.' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('player_journeys')
    .upsert({
      profile_id: user.id,
      journey_key: journeyKey,
      title,
      status: 'active',
      selected: true,
      progress: 0,
      progress_max: 100,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,journey_key' })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Weg konnte nicht gestartet werden.', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, journey: data })
}
