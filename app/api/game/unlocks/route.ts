// app/api/game/unlocks/route.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Player Unlocks API
// Version:      1.0.0
//
// GET — gibt alle Unlocks + Feature-Gates des angemeldeten Spielers zurück
// Wird von DashboardClient beim Load aufgerufen.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getFeatureGates } from '@/lib/knowledge/unlocks'

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('player_unlocks')
    .select('unlock_id, source_module, granted_at')
    .eq('profile_id', user.id)
    .order('granted_at', { ascending: true })

  const unlocks = (data ?? []).map((u: any) => u.unlock_id as string)
  const gates   = getFeatureGates(unlocks)

  return NextResponse.json({ unlocks, gates })
}
